/**
 * exportSanitizedSupportTickets.ts
 *
 * Rarely-run CLI tool that exports the `supporttickets` and `supportticketmessages`
 * collections from a SOURCE (production) MongoDB, sanitizes them for use in a
 * non-production environment, and writes two `mongoimport`-ready Extended JSON files.
 *
 * What "sanitize" means here:
 *   - Every in-dataset identifier (_id, ticket uuid, message uuid, attachment uuid) is
 *     deterministically regenerated. The ticket<->message join is preserved by remapping
 *     `message.ticket` through the same ticket-uuid map.
 *   - User references (userUUID, senderUUID, assignedUUIDs, attachment.uploadedBy) are
 *     deterministically pseudonymized, so the same real user maps to the same fake uuid
 *     across BOTH collections (authenticated-user linkage survives).
 *   - Structured PII fields (guest name/email/org, cc'd emails, sender email) are replaced
 *     with typed placeholders ([NAME], [EMAIL], [ORG]).
 *   - Access keys (guestAccessKey, ccedEmails[].accessKey) are replaced with fresh tokens.
 *   - Free-text fields (title, description, message, feed action/blame, and metadata string
 *     values) are scanned with Amazon Comprehend DetectPiiEntities and detected spans are
 *     replaced with typed placeholders ([EMAIL], [NAME], [PHONE], ...).
 *   - queue_id is kept as-is (it references the un-exported `supportqueues` config
 *     collection and is non-PII). Override with --regenerate-queue-id if you must.
 *
 * The SOURCE connection is opened on its own mongoose connection and is only ever read
 * from (native driver `find`); this script never writes to the source.
 *
 * Usage:
 *   npm run export:support -- \
 *     --source-uri "mongodb+srv://.../prod" \
 *     --queue-id "<queue_id>" \
 *     --out ./out \
 *     [--limit 25] [--drop-metadata] [--regenerate-queue-id] \
 *     [--comprehend-region us-east-1] [--concurrency 5] [--chunk-bytes 5000] \
 *     [--secret "<stable-hmac-secret>"]
 *
 * Determinism: pass a stable --secret (or set SANITIZE_SECRET) to get identical output
 * across re-runs. Without one, a random per-run key is used (output is internally
 * consistent but not reproducible).
 *
 * AWS credentials & region resolve via the standard AWS SDK chain (env / shared config),
 * the same as the rest of the server's AWS usage.
 */

import "dotenv/config";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import path from "node:path";
import fs from "fs-extra";
import mongoose from "mongoose";
import { EJSON, ObjectId } from "bson";
import async from "async";
import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type PiiEntity,
} from "@aws-sdk/client-comprehend";

// ---------------------------------------------------------------------------
// Types (raw docs are read straight from the driver, so these are intentionally
// loose — we only strongly type the shapes we touch during sanitization).
// ---------------------------------------------------------------------------

type RawDoc = Record<string, any> & { _id: ObjectId };

interface CliOptions {
  sourceUri: string;
  queueId: string;
  out: string;
  limit: number | null;
  dropMetadata: boolean;
  regenerateQueueId: boolean;
  comprehendRegion: string;
  concurrency: number;
  chunkBytes: number;
  secret: string;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseCli(): CliOptions {
  const { values } = parseArgs({
    options: {
      "source-uri": { type: "string" },
      "queue-id": { type: "string" },
      out: { type: "string" },
      limit: { type: "string" },
      "drop-metadata": { type: "boolean" },
      "regenerate-queue-id": { type: "boolean" },
      "comprehend-region": { type: "string" },
      concurrency: { type: "string" },
      "chunk-bytes": { type: "string" },
      secret: { type: "string" },
    },
  });

  const sourceUri = values["source-uri"];
  if (!sourceUri) {
    throw new Error(
      "Missing required --source-uri (the production MongoDB connection string)."
    );
  }

  const queueId = values["queue-id"];
  if (!queueId) {
    throw new Error(
      "Missing required --queue-id (only tickets with this queue_id are exported)."
    );
  }

  const secret = values.secret ?? process.env.SANITIZE_SECRET ?? "";
  if (!secret) {
    console.warn(
      "[warn] No --secret / SANITIZE_SECRET provided. Using a random per-run key: " +
        "output will NOT be reproducible across runs."
    );
  }

  return {
    sourceUri,
    queueId,
    out: values.out ?? "./out",
    limit: values.limit ? Math.max(1, parseInt(values.limit, 10)) : null,
    dropMetadata: Boolean(values["drop-metadata"]),
    regenerateQueueId: Boolean(values["regenerate-queue-id"]),
    comprehendRegion:
      values["comprehend-region"] ?? process.env.AWS_REGION ?? "us-east-1",
    concurrency: values.concurrency ? Math.max(1, parseInt(values.concurrency, 10)) : 5,
    chunkBytes: values["chunk-bytes"] ? Math.max(256, parseInt(values["chunk-bytes"], 10)) : 5000,
    secret: secret || crypto.randomBytes(32).toString("hex"),
  };
}

/** Pull the host:port authority out of a mongodb / mongodb+srv URI for a safety check. */
function mongoHost(uri: string): string | null {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]*@)?([^/?]+)/i);
  return match ? match[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Deterministic pseudonymization helpers (keyed HMAC-SHA256)
// ---------------------------------------------------------------------------

function makeHasher(secret: string) {
  return (namespace: string, value: string): Buffer =>
    crypto.createHmac("sha256", secret).update(`${namespace}:${value}`).digest();
}

type Hasher = ReturnType<typeof makeHasher>;

/** Deterministic, valid ObjectId (first 12 bytes of the namespaced HMAC). */
function fakeObjectId(hash: Hasher, orig: ObjectId | string): ObjectId {
  const key = typeof orig === "string" ? orig : orig.toHexString();
  return new ObjectId(hash("oid", key).subarray(0, 12).toString("hex"));
}

/** Deterministic, RFC-4122 v4-shaped UUID derived from the namespaced HMAC. */
function fakeUuid(hash: Hasher, namespace: string, orig: string): string {
  const b = Buffer.from(hash(namespace, orig).subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Deterministic opaque token (for access keys). */
function fakeToken(hash: Hasher, orig: string): string {
  return hash("token", orig).subarray(0, 16).toString("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Comprehend free-text redaction
// ---------------------------------------------------------------------------

/** Split a string into chunks each <= maxBytes UTF-8 bytes, never splitting a code point. */
function chunkByBytes(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of text) {
    const b = Buffer.byteLength(ch, "utf8");
    if (curBytes + b > maxBytes && cur) {
      chunks.push(cur);
      cur = ch;
      curBytes = b;
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

class Redactor {
  private client: ComprehendClient;
  private cache = new Map<string, string>();
  public calls = 0;

  constructor(region: string, private chunkBytes: number) {
    this.client = new ComprehendClient({ region });
  }

  private async detect(text: string): Promise<PiiEntity[]> {
    // Retry with exponential backoff on Comprehend throttling.
    let attempt = 0;
    for (;;) {
      try {
        this.calls += 1;
        const res = await this.client.send(
          new DetectPiiEntitiesCommand({ Text: text, LanguageCode: "en" })
        );
        return res.Entities ?? [];
      } catch (err: any) {
        const name = err?.name ?? "";
        const retryable =
          name === "ThrottlingException" ||
          name === "TooManyRequestsException" ||
          err?.$metadata?.httpStatusCode === 429;
        if (!retryable || attempt >= 6) throw err;
        const wait = Math.min(30_000, 2 ** attempt * 500) + Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, wait));
        attempt += 1;
      }
    }
  }

  private replaceSpans(chunk: string, entities: PiiEntity[]): string {
    // Apply back-to-front so earlier offsets stay valid.
    const sorted = [...entities].sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0));
    let out = chunk;
    for (const e of sorted) {
      const begin = e.BeginOffset ?? -1;
      const end = e.EndOffset ?? -1;
      if (begin < 0 || end <= begin || end > out.length) continue;
      out = out.slice(0, begin) + `[${e.Type ?? "PII"}]` + out.slice(end);
    }
    return out;
  }

  /** Redact a single free-text string. Cached, so identical inputs cost one API call. */
  async redact(text: string | undefined | null): Promise<string | undefined | null> {
    if (text === undefined || text === null) return text;
    if (!text.trim()) return text;
    const cached = this.cache.get(text);
    if (cached !== undefined) return cached;

    const chunks = chunkByBytes(text, this.chunkBytes);
    const redactedChunks: string[] = [];
    for (const chunk of chunks) {
      const entities = await this.detect(chunk);
      redactedChunks.push(entities.length ? this.replaceSpans(chunk, entities) : chunk);
    }
    const result = redactedChunks.join("");
    this.cache.set(text, result);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Free-text collection (pass 1): gather every unique string that needs Comprehend
// ---------------------------------------------------------------------------

/**
 * True only for plain `{}` objects. BSON leaves (ObjectId, Date, Buffer, Decimal128,
 * etc.) are NOT plain, so the metadata walkers below leave them untouched instead of
 * recursing into their internals and corrupting them.
 */
function isPlainObject(value: any): value is Record<string, any> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Recursively collect string leaves from an arbitrary metadata value. */
function collectStrings(value: any, sink: Set<string>): void {
  if (typeof value === "string") {
    if (value.trim()) sink.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, sink);
  } else if (isPlainObject(value)) {
    for (const v of Object.values(value)) collectStrings(v, sink);
  }
}

/** Rebuild a metadata value, swapping each string leaf for its redacted form. */
function applyRedaction(value: any, map: Map<string, string>): any {
  if (typeof value === "string") return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => applyRedaction(v, map));
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = applyRedaction(v, map);
    return out;
  }
  return value;
}

function collectTicketTexts(t: RawDoc, sink: Set<string>, dropMetadata: boolean): void {
  if (typeof t.title === "string" && t.title.trim()) sink.add(t.title);
  if (typeof t.description === "string" && t.description.trim()) sink.add(t.description);
  if (Array.isArray(t.feed)) {
    for (const f of t.feed) {
      if (typeof f?.action === "string" && f.action.trim()) sink.add(f.action);
      if (typeof f?.blame === "string" && f.blame.trim()) sink.add(f.blame);
    }
  }
  if (!dropMetadata && t.metadata) collectStrings(t.metadata, sink);
}

function collectMessageTexts(m: RawDoc, sink: Set<string>): void {
  if (typeof m.message === "string" && m.message.trim()) sink.add(m.message);
}

// ---------------------------------------------------------------------------
// Sanitization (pass 2)
// ---------------------------------------------------------------------------

interface Maps {
  hash: Hasher;
  ticketUuid: Map<string, string>; // orig ticket uuid -> fake uuid (shared join key)
  text: Map<string, string>; // orig free-text -> redacted
}

function redacted(map: Map<string, string>, text: any): any {
  return typeof text === "string" && text.trim() ? map.get(text) ?? text : text;
}

/** Strip query string + fragment from a captured URL (common PII carriers). */
function stripUrl(url: unknown): unknown {
  if (typeof url !== "string" || !url) return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0].split("#")[0];
  }
}

function mapUploadedBy(hash: Hasher, uploadedBy: unknown): string {
  if (typeof uploadedBy !== "string") return "[USER]";
  return EMAIL_RE.test(uploadedBy) ? "[EMAIL]" : fakeUuid(hash, "user", uploadedBy);
}

function sanitizeTicket(t: RawDoc, opts: CliOptions, maps: Maps): RawDoc {
  const { hash } = maps;
  const newUuid = maps.ticketUuid.get(t.uuid)!;

  const guest = t.guest
    ? {
        firstName: t.guest.firstName ? "[NAME]" : t.guest.firstName,
        lastName: t.guest.lastName ? "[NAME]" : t.guest.lastName,
        email: t.guest.email ? "[EMAIL]" : t.guest.email,
        organization: t.guest.organization ? "[ORG]" : t.guest.organization,
      }
    : t.guest;

  return {
    ...t,
    _id: fakeObjectId(hash, t._id),
    uuid: newUuid,
    uuidShort: newUuid.slice(-7),
    queue_id: opts.regenerateQueueId ? fakeUuid(hash, "queue", t.queue_id) : t.queue_id,
    title: redacted(maps.text, t.title),
    description: redacted(maps.text, t.description),
    guestAccessKey: t.guestAccessKey ? fakeToken(hash, t.guestAccessKey) : t.guestAccessKey,
    capturedURL: stripUrl(t.capturedURL),
    assignedUUIDs: Array.isArray(t.assignedUUIDs)
      ? t.assignedUUIDs.map((u: string) => fakeUuid(hash, "user", u))
      : t.assignedUUIDs,
    ccedEmails: Array.isArray(t.ccedEmails)
      ? t.ccedEmails.map((c: any) => ({
          ...c,
          email: c?.email ? "[EMAIL]" : c?.email,
          accessKey: c?.accessKey ? fakeToken(hash, c.accessKey) : c?.accessKey,
        }))
      : t.ccedEmails,
    userUUID: t.userUUID ? fakeUuid(hash, "user", t.userUUID) : t.userUUID,
    guest,
    feed: Array.isArray(t.feed)
      ? t.feed.map((f: any) => ({
          ...f,
          action: redacted(maps.text, f?.action),
          blame: redacted(maps.text, f?.blame),
        }))
      : t.feed,
    attachments: Array.isArray(t.attachments)
      ? t.attachments.map((a: any, i: number) => ({
          ...a,
          name: renameAttachment(a?.name, i),
          uuid: a?.uuid ? fakeUuid(hash, "att", a.uuid) : a?.uuid,
          uploadedBy: mapUploadedBy(hash, a?.uploadedBy),
        }))
      : t.attachments,
    metadata: opts.dropMetadata
      ? undefined
      : t.metadata
      ? applyRedaction(t.metadata, maps.text)
      : t.metadata,
  };
}

function renameAttachment(name: unknown, index: number): string {
  const ext = typeof name === "string" ? path.extname(name) : "";
  return `attachment-${index + 1}${ext}`;
}

function sanitizeMessage(m: RawDoc, opts: CliOptions, maps: Maps): RawDoc | null {
  const { hash } = maps;
  const newTicket = maps.ticketUuid.get(m.ticket);
  if (!newTicket) return null; // orphan — ticket not part of this export

  return {
    ...m,
    _id: fakeObjectId(hash, m._id),
    uuid: m.uuid ? fakeUuid(hash, "msg", m.uuid) : m.uuid,
    ticket: newTicket,
    message: redacted(maps.text, m.message),
    attachments: Array.isArray(m.attachments)
      ? m.attachments.map((a: string) => (typeof a === "string" ? fakeUuid(hash, "att", a) : a))
      : m.attachments,
    senderUUID: m.senderUUID ? fakeUuid(hash, "user", m.senderUUID) : m.senderUUID,
    senderEmail: m.senderEmail ? "[EMAIL]" : m.senderEmail,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseCli();

  // Safety guardrail: never treat the dev cluster as the "source" to export FROM.
  const devUri = process.env.MONGOOSEURI ?? "";
  if (devUri && mongoHost(devUri) && mongoHost(devUri) === mongoHost(opts.sourceUri)) {
    throw new Error(
      "--source-uri host matches your local MONGOOSEURI (dev) host. Refusing to run: " +
        "point --source-uri at the production cluster you want to export FROM."
    );
  }

  const hash = makeHasher(opts.secret);
  const redactor = new Redactor(opts.comprehendRegion, opts.chunkBytes);

  console.log(`[info] Connecting to source (read-only)...`);
  const conn = await mongoose.createConnection(opts.sourceUri).asPromise();

  try {
    const ticketsCol = conn.collection("supporttickets");
    const messagesCol = conn.collection("supportticketmessages");

    // ---- Fetch tickets (only those in the requested queue) ----
    const ticketCursor = ticketsCol.find(
      { queue_id: opts.queueId },
      opts.limit ? { limit: opts.limit } : {}
    );
    const tickets = (await ticketCursor.toArray()) as unknown as RawDoc[];
    console.log(
      `[info] Read ${tickets.length} ticket(s) for queue_id "${opts.queueId}" from source.`
    );

    // Build the shared ticket-uuid map (the ticket<->message join key).
    const ticketUuid = new Map<string, string>();
    for (const t of tickets) ticketUuid.set(t.uuid, fakeUuid(hash, "ticket", t.uuid));

    // ---- Fetch messages (only those belonging to the exported tickets) ----
    const ticketUuids = [...ticketUuid.keys()];
    const messages: RawDoc[] = [];
    const BATCH = 500;
    for (let i = 0; i < ticketUuids.length; i += BATCH) {
      const slice = ticketUuids.slice(i, i + BATCH);
      const batch = (await messagesCol
        .find({ ticket: { $in: slice } })
        .toArray()) as unknown as RawDoc[];
      messages.push(...batch);
    }
    console.log(`[info] Read ${messages.length} message(s) for those tickets.`);

    // ---- Pass 1: collect unique free-text, redact via Comprehend ----
    const texts = new Set<string>();
    for (const t of tickets) collectTicketTexts(t, texts, opts.dropMetadata);
    for (const m of messages) collectMessageTexts(m, texts);
    const uniqueTexts = [...texts];
    console.log(
      `[info] Redacting ${uniqueTexts.length} unique free-text value(s) via Comprehend ` +
        `(region ${opts.comprehendRegion}, concurrency ${opts.concurrency})...`
    );

    const textMap = new Map<string, string>();
    await async.mapLimit(uniqueTexts, opts.concurrency, async (original: string) => {
      const red = await redactor.redact(original);
      textMap.set(original, red as string);
    });

    const maps: Maps = { hash, ticketUuid, text: textMap };

    // ---- Pass 2: sanitize ----
    const sanitizedTickets = tickets.map((t) => sanitizeTicket(t, opts, maps));
    const sanitizedMessages = messages
      .map((m) => sanitizeMessage(m, opts, maps))
      .filter((m): m is RawDoc => m !== null);
    const droppedMessages = messages.length - sanitizedMessages.length;

    // ---- Write EJSON (canonical: preserves ObjectId/Date through mongoimport) ----
    await fs.ensureDir(opts.out);
    const ticketsPath = path.join(opts.out, "supporttickets.json");
    const messagesPath = path.join(opts.out, "supportticketmessages.json");
    await fs.writeFile(ticketsPath, EJSON.stringify(sanitizedTickets, undefined, 2, { relaxed: false }));
    await fs.writeFile(messagesPath, EJSON.stringify(sanitizedMessages, undefined, 2, { relaxed: false }));

    // ---- Summary ----
    console.log("\n===== Export summary =====");
    console.log(`Tickets exported:        ${sanitizedTickets.length}`);
    console.log(`Messages exported:       ${sanitizedMessages.length}`);
    console.log(`Messages dropped (orphan): ${droppedMessages}`);
    console.log(`Comprehend API calls:    ${redactor.calls}`);
    console.log(`Output:`);
    console.log(`  ${ticketsPath}`);
    console.log(`  ${messagesPath}`);
    console.log(
      `\nImport with:\n` +
        `  mongoimport --uri "<dev-uri>" --collection supporttickets --jsonArray --file "${ticketsPath}"\n` +
        `  mongoimport --uri "<dev-uri>" --collection supportticketmessages --jsonArray --file "${messagesPath}"`
    );
  } finally {
    await conn.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n[fatal] ${err?.stack ?? err}`);
    process.exit(1);
  });
