/**
 * Deterministic pseudonymisation for non-production Studio imports.
 *
 * The goal is dev data that behaves like production without containing anyone's
 * identity. Pseudonyms are derived with a keyed HMAC, so the same real person
 * always maps to the same fake person: the author who owns 9,191 activities
 * still owns 9,191 in dev, collaborator graphs stay intact, and anything that
 * depends on the shape of the data behaves the way it will in production.
 *
 * A keyed HMAC rather than a plain hash, because LibreOne UUIDs are an
 * enumerable input space. Anyone holding the production list could reverse a
 * bare SHA-256 by brute force; without the key they cannot.
 *
 * ## The salt
 *
 * The salt is a secret and is read from `STUDIO_PSEUDONYM_SALT`. Supply it by
 * running the importer under `asm-exec` with a resolve token, so the value is
 * injected at runtime and never pasted into a shell, a file, or a log:
 *
 *   STUDIO_PSEUDONYM_SALT='{{resolve:secretsmanager:studio/migration:SecretString:pseudonymSalt}}' \
 *     asm-exec npx tsx server/migrations/StudioImportActivities.ts
 *
 * Never commit it, never echo it, and never copy it into a dev environment:
 * the salt sitting next to the pseudonymised data would defeat the point. If a
 * dev environment is ever exposed, rotate the salt and re-import.
 */
import crypto from "node:crypto";

/**
 * Reserved by RFC 2606 and guaranteed never to resolve, so generated addresses
 * are undeliverable by construction rather than by convention. A typo'd real
 * domain could receive mail; `.invalid` cannot.
 */
const SYNTHETIC_EMAIL_DOMAIN = "dev.invalid";

const FIRST_NAMES = [
  "Avery", "Blair", "Casey", "Darcy", "Ellis", "Finley", "Harper", "Indigo",
  "Jordan", "Kai", "Lennox", "Marlow", "Noor", "Oakley", "Paz", "Quinn",
  "Reese", "Sage", "Tatum", "Umber", "Vale", "Wren", "Xan", "Yuri", "Zephyr",
];

const LAST_NAMES = [
  "Alder", "Brooks", "Calder", "Dunne", "Ellery", "Fairbank", "Glass",
  "Hollis", "Ingram", "Jessop", "Kestrel", "Lowry", "Mercer", "Northcote",
  "Orford", "Pike", "Quill", "Rowan", "Sorrel", "Thorne", "Upton", "Vance",
  "Whitlock", "Yardley", "Zinn",
];

/** Matches most real-world addresses well enough to redact them from prose. */
const EMAIL_IN_TEXT =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export default class StudioPseudonymizer {
  private readonly key: Buffer;

  constructor(salt: string) {
    if (!salt || salt.length < 16) {
      throw new Error(
        "STUDIO_PSEUDONYM_SALT must be set to at least 16 characters. " +
          "Supply it via asm-exec with a secretsmanager resolve token."
      );
    }
    this.key = Buffer.from(salt, "utf-8");
  }

  /** Keyed digest of one input, scoped so different fields never collide. */
  private digest(scope: string, value: string): Buffer {
    return crypto
      .createHmac("sha256", this.key)
      .update(`${scope}:${value}`)
      .digest();
  }

  /**
   * Derives a syntactically valid UUIDv4 to stand in for a LibreOne UUID.
   *
   * Version and variant bits are forced so the result passes the same UUID
   * validation as a real one. A pseudonym that failed `z.string().uuid()`
   * would make dev behave differently from production, which is the one thing
   * this is supposed to prevent.
   */
  centralID(realCentralID: string): string {
    return this.uuidFrom("centralID", realCentralID);
  }

  /**
   * Pseudonym for a Conductor-local user uuid.
   *
   * Scoped separately from `centralID` so the two identifiers for one person
   * stay distinct, exactly as they are in production.
   */
  localUUID(realConductorUUID: string): string {
    return this.uuidFrom("localUUID", realConductorUUID);
  }

  /** Derives a syntactically valid UUIDv4 from any scoped input. */
  uuidFrom(scope: string, value: string): string {
    const h = this.digest(scope, value);
    const b = Buffer.from(h.subarray(0, 16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const hex = b.toString("hex");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join("-");
  }

  /** Stable fake name for a real identifier. */
  name(realCentralID: string): { firstName: string; lastName: string } {
    const h = this.digest("name", realCentralID);
    return {
      firstName: FIRST_NAMES[h.readUInt16BE(0) % FIRST_NAMES.length],
      lastName: LAST_NAMES[h.readUInt16BE(2) % LAST_NAMES.length],
    };
  }

  /**
   * Stable undeliverable address. The short digest suffix keeps addresses
   * unique when two pseudonyms draw the same name pair.
   */
  email(realCentralID: string): string {
    const { firstName, lastName } = this.name(realCentralID);
    const suffix = this.digest("email", realCentralID)
      .toString("hex")
      .slice(0, 8);
    return `${firstName}.${lastName}.${suffix}@${SYNTHETIC_EMAIL_DOMAIN}`.toLowerCase();
  }

  /**
   * Redacts addresses from free text.
   *
   * Identity is not the only carrier. `h5p_content.authors` is free text typed
   * by content creators and routinely holds real names and addresses, and node
   * bodies contain instructor contact details. Names in prose cannot be found
   * reliably, so the honest position is that this reduces exposure rather than
   * eliminating it, which is one more reason dev keeps production-grade access
   * control.
   */
  scrubText(text: string | null | undefined): string | undefined {
    if (!text) return undefined;
    return text.replace(EMAIL_IN_TEXT, "redacted@dev.invalid");
  }

  /**
   * Replaces the H5P metadata author list wholesale.
   *
   * Stored as a JSON array of `{name, role}`. The names are real and there is
   * no safe partial redaction, so the structure is preserved and the content
   * replaced.
   */
  h5pAuthors(
    raw: string | null | undefined,
    realCentralID: string
  ): string | undefined {
    if (!raw) return undefined;
    const { firstName, lastName } = this.name(realCentralID);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return undefined;
      return JSON.stringify(
        parsed.map((entry: any, i: number) => ({
          name: i === 0 ? `${firstName} ${lastName}` : `Contributor ${i + 1}`,
          ...(entry?.role ? { role: entry.role } : {}),
        }))
      );
    } catch {
      // Malformed JSON in production data is not worth guessing at.
      return undefined;
    }
  }
}
