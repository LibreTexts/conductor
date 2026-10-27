import { SignJWT, importJWK, type KeyLike } from "jose";
import { randomUUID } from "node:crypto";
import { childLogger } from "../../logger.js";

const log = childLogger("h5p-authoring");

/**
 * Conductor's half of H5P authoring: signing the capability tokens the H5P
 * service accepts, and the two server-to-server calls Conductor makes to it.
 *
 * Conductor decides who may do what to which activity. The H5P service owns
 * the content and verifies only that a token was signed by Conductor and
 * grants the action on that content id. See H5P_AUTHORING_DESIGN.md in the
 * migration workspace.
 *
 * Configuration, read when first needed rather than at boot, so an instance
 * without authoring configured starts normally and answers authoring requests
 * with a clear "not available":
 *
 * - `H5P_CAPABILITY_PRIVATE_KEY`: the Ed25519 signing key as a JWK, with a
 *   `kid`. A secret, injected from Secrets Manager. The H5P service holds the
 *   matching public key in `CAPABILITY_TOKEN_PUBLIC_KEYS`.
 * - `H5P_SERVICE_URL`: the H5P service origin for server-to-server calls.
 */

const ISSUER = "conductor";
const AUDIENCE = "h5p-service";

/** Lifetime of an editor token. The editor asks for a new one before expiry. */
export const EDITOR_TOKEN_TTL_SECONDS = 15 * 60;

/** Lifetime of a token for one server-to-server call. */
const SERVICE_TOKEN_TTL_SECONDS = 60;

/** Subject of tokens Conductor's server uses for its own calls. */
const SERVICE_SUBJECT = "conductor-service";

const SERVICE_TIMEOUT_MS = 10_000;

export type CapabilityAction = "edit" | "create" | "delete" | "allocate";

export class AuthoringNotConfiguredError extends Error {}

export class H5PServiceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

let signer: { key: KeyLike | Uint8Array; kid: string } | null = null;

/** Whether this instance has what authoring needs. */
export function isAuthoringConfigured(): boolean {
  return Boolean(process.env.H5P_CAPABILITY_PRIVATE_KEY && process.env.H5P_SERVICE_URL);
}

async function getSigner(): Promise<{ key: KeyLike | Uint8Array; kid: string }> {
  if (signer) return signer;
  const raw = process.env.H5P_CAPABILITY_PRIVATE_KEY;
  if (!raw) throw new AuthoringNotConfiguredError("H5P_CAPABILITY_PRIVATE_KEY is not set");
  let jwk: any;
  try {
    jwk = JSON.parse(raw);
  } catch {
    throw new AuthoringNotConfiguredError("H5P_CAPABILITY_PRIVATE_KEY is not valid JSON");
  }
  if (jwk?.kty !== "OKP" || jwk?.crv !== "Ed25519" || typeof jwk?.d !== "string" || typeof jwk?.x !== "string") {
    throw new AuthoringNotConfiguredError("H5P_CAPABILITY_PRIVATE_KEY must be an Ed25519 private JWK");
  }
  if (typeof jwk.kid !== "string" || !jwk.kid) {
    throw new AuthoringNotConfiguredError("H5P_CAPABILITY_PRIVATE_KEY needs a kid matching the H5P service's public key");
  }
  signer = { key: await importJWK(jwk, "EdDSA"), kid: jwk.kid };
  return signer;
}

function serviceUrl(): string {
  const url = process.env.H5P_SERVICE_URL;
  if (!url) throw new AuthoringNotConfiguredError("H5P_SERVICE_URL is not set");
  return url.replace(/\/+$/, "");
}

/**
 * Signs a capability token. `contentId` scopes `edit` and `delete` to one
 * activity's H5P content; the H5P service refuses either without it.
 */
export async function signCapabilityToken(params: {
  subject: string;
  actions: CapabilityAction[];
  contentId?: number;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresAt: Date; tokenId: string }> {
  const { key, kid } = await getSigner();
  const now = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? EDITOR_TOKEN_TTL_SECONDS;
  const tokenId = randomUUID();
  const token = await new SignJWT({
    act: params.actions,
    ...(params.contentId !== undefined ? { cid: String(params.contentId) } : {}),
  })
    .setProtectedHeader({ alg: "EdDSA", kid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(params.subject)
    .setJti(tokenId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
  return { token, expiresAt: new Date((now + ttl) * 1000), tokenId };
}

async function callService(method: string, path: string, actions: CapabilityAction[], contentId?: number) {
  const { token, tokenId } = await signCapabilityToken({
    subject: SERVICE_SUBJECT,
    actions,
    contentId,
    ttlSeconds: SERVICE_TOKEN_TTL_SECONDS,
  });
  try {
    const res = await fetch(`${serviceUrl()}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    });
    return { res, tokenId };
  } catch (err) {
    if (err instanceof AuthoringNotConfiguredError) throw err;
    throw new H5PServiceError(`H5P service unreachable: ${(err as Error).message}`);
  }
}

/**
 * Takes the next H5P content id for a new activity. The H5P service never
 * hands out an id twice, so an id allocated and never saved is simply skipped.
 */
export async function allocateH5PContentId(): Promise<number> {
  const { res, tokenId } = await callService("POST", "/h5p/service/allocate", ["allocate"]);
  const body: any = await res.json().catch(() => ({}));
  const id = Number(body?.contentId);
  if (res.status !== 201 || !Number.isInteger(id) || id <= 0) {
    throw new H5PServiceError(`allocate returned ${res.status}`, res.status);
  }
  log.info({ contentId: id, jti: tokenId }, "Allocated H5P content id");
  return id;
}

/**
 * Deletes an activity's H5P content and files. A 404 counts as done: content
 * that was allocated but never saved does not exist on the H5P service.
 */
export async function deleteH5PContent(contentId: number): Promise<"deleted" | "absent"> {
  const { res, tokenId } = await callService("DELETE", `/h5p/service/content/${contentId}`, ["delete"], contentId);
  if (res.status === 204) {
    log.info({ contentId, jti: tokenId }, "Deleted H5P content");
    return "deleted";
  }
  if (res.status === 404) return "absent";
  throw new H5PServiceError(`delete returned ${res.status}`, res.status);
}
