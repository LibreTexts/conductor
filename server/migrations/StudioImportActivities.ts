/**
 * Studio -> Conductor activity import. DRY RUN BY DEFAULT.
 *
 * Creates the Conductor `Activity` records for H5P activities migrated from
 * LibreTexts Studio. Reads Studio MySQL read-only and writes nothing unless
 * `--commit` is passed; without it the script reports exactly what it would do
 * and exits.
 *
 * This is one of three migration phases and the only one that touches
 * Conductor:
 *
 *   A. Content and library FILES  -> `aws s3 sync` into the h5p-service bucket
 *   B. H5P content and library RECORDS -> h5p-service Mongo, via its own
 *      storage classes so ids are preserved through `addContent(..., id)`
 *   C. Conductor `Activity` records -> this script
 *
 * A and B make embeds work and are what lets the Studio host be shut down. C
 * makes activities appear in the Commons catalog. They are independent and can
 * run in any order.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   npx tsx --env-file=.env server/migrations/StudioImportActivities.ts
 *   #                                                            ... --commit
 *
 * Decisions this implements, all settled by the 2026-10-22 production survey:
 *
 *   Author resolution runs in four tiers. `authorCentralID` is the
 *   authoritative author field and is always set when known;
 *   `createdBy` (Conductor-local uuid) is filled in only when a local User
 *   exists, because 87 authors have a valid LibreOne identity and no Conductor
 *   account. Provisioning accounts here would be the wrong trade.
 *
 *   674 content ids are referenced by more than one live node. Studio already
 *   treats the content id as the identity (both the public page and the embed
 *   resolve by it), so one canonical node wins per content id and the rest are
 *   reported with their nids so inbound links can be redirected. Tie-break:
 *   published, then has an ADAPT id, then lowest nid.
 *
 *   258 content rows have no node and are deliberately NOT imported here. They
 *   stay embeddable via phase B, which is their current state in Studio, but
 *   there is no node to build a catalog record from. 66 nodes point at missing
 *   content and are skipped, since there is nothing to serve.
 *
 * Idempotent: records are upserted on `h5pContentID`, and an existing
 * `activityID` is reused so reruns do not churn public identifiers.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import mysql from "mysql2/promise";
import b62 from "base62-random";
import logger, { childLogger } from "../logger.js";
import Activity from "../models/activity.js";
import User from "../models/user.js";
import StudioPseudonymizer from "./StudioPseudonymizer.js";
import dotenv from "dotenv";
dotenv.config();

const log = childLogger("studio-import");

const COMMIT = process.argv.includes("--commit");
const WITH_IDENTITIES = process.argv.includes("--with-identities");
const FULL = process.argv.includes("--full");
const IS_PRODUCTION = (process.env.APP_ENV ?? "production") === "production";

/**
 * Default sample size for non-production imports.
 *
 * Big enough to exercise pagination, search and the catalog realistically,
 * small enough to re-seed quickly. `--full` overrides it.
 */
const DEFAULT_SAMPLE = 2500;

function parseSampleSize(): number {
  if (FULL) return Infinity;
  const arg = process.argv.find((a) => a.startsWith("--sample="));
  if (arg) {
    const n = parseInt(arg.split("=")[1], 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("--sample= requires a positive integer.");
    }
    return n;
  }
  return WITH_IDENTITIES ? Infinity : DEFAULT_SAMPLE;
}

/**
 * Decides whether this run produces real or pseudonymised identities, and
 * refuses the two combinations that would cross the dev/production line.
 *
 * `APP_ENV` defaults to "production" when unset, so it cannot be the only
 * guard: an unconfigured box would read as production and happily import real
 * identities. Real data therefore needs the explicit flag AND the environment,
 * and the default with no flag is always pseudonymised.
 */
export function resolveMode(): { anonymize: boolean; dataClass: "production" | "synthetic" } {
  if (WITH_IDENTITIES && !IS_PRODUCTION) {
    throw new Error(
      "Refusing to import real identities outside production. " +
        `APP_ENV is "${process.env.APP_ENV ?? "(unset)"}". Drop --with-identities.`
    );
  }
  if (!WITH_IDENTITIES && IS_PRODUCTION && COMMIT) {
    throw new Error(
      "Refusing to write synthetic records to production. " +
        "Pass --with-identities for a production import, or set APP_ENV for a non-production target."
    );
  }
  return WITH_IDENTITIES
    ? { anonymize: false, dataClass: "production" }
    : { anonymize: true, dataClass: "synthetic" };
}

/** Studio row shapes, as the queries below return them. */
type StudioNode = {
  nid: number;
  uid: number;
  status: number;
  title: string | null;
  created: number | null;
  changed: number | null;
  uuid: string | null;
  h5p_content_id: number;
};

type StudioContent = {
  id: number;
  title: string | null;
  library_id: number;
  authors: string | null;
  source: string | null;
  license: string | null;
  license_version: string | null;
  license_extras: string | null;
  default_language: string | null;
  library_title: string | null;
};

export type AuthorResolution = {
  centralID?: string;
  conductorUUID?: string;
  tier: 1 | 2 | 3 | 4 | 0;
};

/**
 * Loads one Drupal field table into a map keyed by node id.
 *
 * Wrapped so a field table that does not exist, or whose column name differs
 * from what was inferred, degrades to "this field is missing" rather than
 * aborting an import of 30,000 records.
 */
export async function loadFieldMap<T>(
  conn: mysql.Connection,
  label: string,
  sql: string,
  pick: (row: any) => [number, T]
): Promise<Map<number, T[]>> {
  const map = new Map<number, T[]>();
  try {
    const [rows] = await conn.query(sql);
    for (const row of rows as any[]) {
      const [nid, value] = pick(row);
      const list = map.get(nid);
      if (list) list.push(value);
      else map.set(nid, [value]);
    }
    log.info({ field: label, nodes: map.size }, "Loaded field table");
  } catch (err) {
    log.warn({ field: label, err }, "Field table unavailable; skipping");
  }
  return map;
}

/**
 * Builds the Studio-uid to Conductor-identity map.
 *
 * Tier 1 is the LibreOne UUID stored as the Drupal username. Tier 2 recovers
 * pre-CAS accounts through the one-time mapping file Studio shipped. Tier 3 is
 * a valid LibreOne identity with no Conductor account yet. Tier 4 falls back to
 * email. Tier 0 means unresolvable.
 */
export async function buildAuthorMap(
  conn: mysql.Connection,
  casCsvPath: string
): Promise<Map<number, AuthorResolution>> {
  const [userRows] = await conn.query(
    `SELECT uid, name, mail FROM users_field_data WHERE default_langcode = 1`
  );
  const users = userRows as { uid: number; name: string; mail: string }[];

  const isUUID = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      v || ""
    );

  // The pre-CAS username to LibreOne UUID mapping Studio shipped. Absent in
  // most environments, which only costs tier 2.
  const cas = new Map<string, string>();
  try {
    const raw = fs.readFileSync(casCsvPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const [name, uuid] = line.split(",");
      if (name?.trim() && uuid?.trim()) {
        cas.set(name.trim().toLowerCase(), uuid.trim());
      }
    }
    log.info({ entries: cas.size, casCsvPath }, "Loaded CAS username map");
  } catch {
    log.warn({ casCsvPath }, "CAS username map not found; tier 2 unavailable");
  }

  // Candidate centralIDs, then one lookup against Conductor rather than
  // 784 round trips.
  const candidates = new Set<string>();
  const emails = new Set<string>();
  for (const u of users) {
    if (isUUID(u.name)) candidates.add(u.name);
    else {
      const mapped = cas.get((u.name || "").toLowerCase());
      if (mapped) candidates.add(mapped);
    }
    if (u.mail) emails.add(u.mail.toLowerCase());
  }

  const byCentralID = new Map<string, string>();
  const byEmail = new Map<string, { uuid: string; centralID?: string }>();
  if (mongoose.connection.readyState === 1) {
    const matched = await User.find(
      {
        $or: [
          { centralID: { $in: [...candidates] } },
          { email: { $in: [...emails] } },
        ],
      },
      { _id: 0, uuid: 1, centralID: 1, email: 1 }
    ).lean();
    for (const u of matched) {
      if (u.centralID) byCentralID.set(u.centralID, u.uuid);
      if (u.email) {
        byEmail.set(u.email.toLowerCase(), {
          uuid: u.uuid,
          centralID: u.centralID,
        });
      }
    }
    log.info({ matched: matched.length }, "Matched Conductor users");
  } else {
    log.warn("No Mongo connection; every author will resolve as tier 0");
  }

  const out = new Map<number, AuthorResolution>();
  for (const u of users) {
    if (isUUID(u.name)) {
      const uuid = byCentralID.get(u.name);
      // A LibreOne id with no Conductor account is tier 3, not a failure: the
      // attribution is still authoritative.
      out.set(u.uid, uuid
        ? { centralID: u.name, conductorUUID: uuid, tier: 1 }
        : { centralID: u.name, tier: 3 });
      continue;
    }

    const mapped = cas.get((u.name || "").toLowerCase());
    if (mapped) {
      const uuid = byCentralID.get(mapped);
      out.set(u.uid, uuid
        ? { centralID: mapped, conductorUUID: uuid, tier: 2 }
        : { centralID: mapped, tier: 3 });
      continue;
    }

    const viaEmail = u.mail ? byEmail.get(u.mail.toLowerCase()) : undefined;
    if (viaEmail) {
      out.set(u.uid, {
        centralID: viaEmail.centralID,
        conductorUUID: viaEmail.uuid,
        tier: 4,
      });
      continue;
    }

    out.set(u.uid, { tier: 0 });
  }
  return out;
}

/**
 * Chooses which node owns a content id when several reference it.
 *
 * Published beats unpublished, then having an ADAPT id, then the lowest nid as
 * a stable final tie-break so reruns pick the same winner.
 */
function pickCanonical(
  nodes: StudioNode[],
  adaptIDs: Map<number, string[]>
): { winner: StudioNode; discarded: StudioNode[] } {
  const scored = [...nodes].sort((a, b) => {
    if (a.status !== b.status) return b.status - a.status;
    const aAdapt = adaptIDs.get(a.nid)?.[0] ? 1 : 0;
    const bAdapt = adaptIDs.get(b.nid)?.[0] ? 1 : 0;
    if (aAdapt !== bAdapt) return bAdapt - aAdapt;
    return a.nid - b.nid;
  });
  return { winner: scored[0], discarded: scored.slice(1) };
}

/**
 * Picks a representative subset for a non-production environment.
 *
 * A random slice would under-represent exactly the cases worth testing, so
 * every structural oddity is force-included first: content ids shared by
 * several nodes, nodes whose content is gone, and at least a few activities
 * from each author resolution tier. The remainder is filled proportionally by
 * H5P library so the content-type mix matches production, which is what makes
 * catalog filtering and the player behave realistically.
 *
 * Selection is deterministic (sorted by content id, no randomness) so
 * re-seeding a dev environment produces the same subset.
 */
function stratifiedSample(
  byContent: Map<number, StudioNode[]>,
  libraryOf: (contentID: number) => string | undefined,
  tierOf: (contentID: number) => number,
  limit: number
): Set<number> {
  const all = [...byContent.keys()].sort((a, b) => a - b);
  if (all.length <= limit) return new Set(all);

  const picked = new Set<number>();

  // Structural edge cases first; these are the reason bugs survive to prod.
  for (const id of all) {
    if (picked.size >= limit) break;
    if ((byContent.get(id)?.length ?? 0) > 1) picked.add(id);
  }

  // At least a handful from every author tier, including unresolvable.
  const perTier = new Map<number, number>();
  for (const id of all) {
    if (picked.size >= limit) break;
    const tier = tierOf(id);
    const seen = perTier.get(tier) ?? 0;
    if (seen < 10) {
      picked.add(id);
      perTier.set(tier, seen + 1);
    }
  }

  // Fill the rest proportionally by library.
  const byLibrary = new Map<string, number[]>();
  for (const id of all) {
    const lib = libraryOf(id) ?? "unknown";
    const list = byLibrary.get(lib);
    if (list) list.push(id);
    else byLibrary.set(lib, [id]);
  }
  const remaining = limit - picked.size;
  if (remaining > 0) {
    for (const [, ids] of byLibrary) {
      const share = Math.max(1, Math.round((ids.length / all.length) * remaining));
      let taken = 0;
      for (const id of ids) {
        if (taken >= share || picked.size >= limit) break;
        if (!picked.has(id)) {
          picked.add(id);
          taken += 1;
        }
      }
    }
  }

  return picked;
}

export async function runMigration(): Promise<void> {
  const mysqlConfig = {
    host: process.env.STUDIO_MYSQL_HOST,
    port: parseInt(process.env.STUDIO_MYSQL_PORT || "3306", 10),
    user: process.env.STUDIO_MYSQL_USER,
    password: process.env.STUDIO_MYSQL_PASSWORD,
    database: process.env.STUDIO_MYSQL_DATABASE,
  };
  if (!mysqlConfig.host || !mysqlConfig.user || !mysqlConfig.database) {
    throw new Error(
      "Missing STUDIO_MYSQL_HOST, STUDIO_MYSQL_USER or STUDIO_MYSQL_DATABASE."
    );
  }
  const orgID = process.env.ORG_ID;
  if (!orgID) throw new Error("Missing ORG_ID.");

  const { anonymize, dataClass } = resolveMode();
  const sampleLimit = parseSampleSize();
  const seedUsers = anonymize && !process.argv.includes("--no-seed-users");

  const pseudo = anonymize
    ? new StudioPseudonymizer(process.env.STUDIO_PSEUDONYM_SALT ?? "")
    : null;

  log.info(
    {
      mode: COMMIT ? "COMMIT" : "DRY RUN",
      orgID,
      dataClass,
      appEnv: process.env.APP_ENV ?? "(unset, treated as production)",
      sampleLimit: sampleLimit === Infinity ? "full" : sampleLimit,
      seedUsers,
    },
    COMMIT
      ? `Importing Studio activities as ${dataClass} data`
      : `Dry run (${dataClass}): no Conductor records will be written`
  );

  const conn = await mysql.createConnection(mysqlConfig);
  const report = {
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    nodes: 0,
    contentRows: 0,
    activitiesPlanned: 0,
    created: 0,
    updated: 0,
    skippedMissingContent: [] as number[],
    collapsedDuplicates: [] as {
      h5pContentID: number;
      canonicalNid: number;
      discardedNids: number[];
    }[],
    authorTiers: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 } as Record<string, number>,
    activitiesWithNoAuthor: [] as number[],
    dataClass: "" as string,
    anonymized: false,
    sampled: null as null | { limit: number; selected: number; of: number },
    syntheticUsersSeeded: 0,
  };

  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");

    const casCsvPath =
      process.env.STUDIO_CAS_CSV ||
      path.resolve("..", "studio_main", "scripts", "cas_users.csv");
    const authorMap = await buildAuthorMap(conn, casCsvPath);

    const [nodeRows] = await conn.query(
      `SELECT n.nid, n.uid, n.status, n.title, n.created, n.changed, nb.uuid,
              f.field_h5p_h5p_content_id AS h5p_content_id
       FROM node_field_data n
       JOIN node__field_h5p f
         ON f.entity_id = n.nid AND f.deleted = 0
       LEFT JOIN node nb ON nb.nid = n.nid
       WHERE n.type = 'h5p' AND n.default_langcode = 1`
    );
    const nodes = nodeRows as StudioNode[];
    report.nodes = nodes.length;

    const [contentRows] = await conn.query(
      `SELECT c.id, c.title, c.library_id, c.authors, c.source,
              c.license, c.license_version, c.license_extras, c.default_language,
              l.title AS library_title,
              CONCAT(l.machine_name, ' ', l.major_version, '.', l.minor_version) AS library
       FROM h5p_content c
       LEFT JOIN h5p_libraries l ON l.library_id = c.library_id`
    );
    const content = new Map<number, StudioContent & { library: string }>(
      (contentRows as any[]).map((r) => [r.id, r])
    );
    report.contentRows = content.size;

    const body = await loadFieldMap<string>(
      conn,
      "body",
      `SELECT entity_id, body_value FROM node__body WHERE bundle = 'h5p' AND deleted = 0`,
      (r) => [r.entity_id, r.body_value]
    );
    const adaptIDs = await loadFieldMap<string>(
      conn,
      "adapt_id",
      `SELECT entity_id, field_adapt_id_value FROM node__field_adapt_id
       WHERE deleted = 0 AND field_adapt_id_value IS NOT NULL AND field_adapt_id_value <> ''`,
      (r) => [r.entity_id, r.field_adapt_id_value]
    );
    const subjects = await loadFieldMap<string>(
      conn,
      "subject",
      `SELECT f.entity_id, t.name FROM node__field_subject f
       JOIN taxonomy_term_field_data t ON t.tid = f.field_subject_target_id AND t.default_langcode = 1
       WHERE f.bundle = 'h5p' AND f.deleted = 0`,
      (r) => [r.entity_id, r.name]
    );
    const tags = await loadFieldMap<string>(
      conn,
      "tags",
      `SELECT f.entity_id, t.name FROM node__field_tags f
       JOIN taxonomy_term_field_data t ON t.tid = f.field_tags_target_id AND t.default_langcode = 1
       WHERE f.bundle = 'h5p' AND f.deleted = 0`,
      (r) => [r.entity_id, r.name]
    );
    const publishers = await loadFieldMap<string>(
      conn,
      "publisher",
      `SELECT f.entity_id, t.name FROM node__field_publisher f
       JOIN taxonomy_term_field_data t ON t.tid = f.field_publisher_target_id AND t.default_langcode = 1
       WHERE f.bundle = 'h5p' AND f.deleted = 0`,
      (r) => [r.entity_id, r.name]
    );
    const collaborators = await loadFieldMap<number>(
      conn,
      "collaborators",
      `SELECT entity_id, field_collaborators_target_id FROM node__field_collaborators
       WHERE bundle = 'h5p' AND deleted = 0`,
      (r) => [r.entity_id, r.field_collaborators_target_id]
    );
    const inLibrary = await loadFieldMap<number>(
      conn,
      "include_in_library",
      `SELECT entity_id, field_include_in_library_value FROM node__field_include_in_library
       WHERE bundle = 'h5p' AND deleted = 0`,
      (r) => [r.entity_id, r.field_include_in_library_value]
    );
    const inProfile = await loadFieldMap<number>(
      conn,
      "include_in_profile",
      `SELECT entity_id, field_include_in_profile_value FROM node__field_include_in_profile
       WHERE bundle = 'h5p' AND deleted = 0`,
      (r) => [r.entity_id, r.field_include_in_profile_value]
    );

    // Group nodes by content id so duplicates can be collapsed deliberately
    // rather than colliding on the unique index.
    const byContent = new Map<number, StudioNode[]>();
    for (const n of nodes) {
      const list = byContent.get(n.h5p_content_id);
      if (list) list.push(n);
      else byContent.set(n.h5p_content_id, [n]);
    }

    report.dataClass = dataClass;
    report.anonymized = anonymize;

    // Narrow to a representative subset before doing any per-record work.
    let selected: Set<number> | null = null;
    if (sampleLimit !== Infinity) {
      selected = stratifiedSample(
        byContent,
        (cid) => content.get(cid)?.library,
        (cid) => {
          const group = byContent.get(cid) ?? [];
          const winner = pickCanonical(group, adaptIDs).winner;
          return authorMap.get(winner?.uid ?? -1)?.tier ?? 0;
        },
        sampleLimit
      );
      report.sampled = {
        limit: sampleLimit,
        selected: selected.size,
        of: byContent.size,
      };
      log.info(
        { selected: selected.size, of: byContent.size },
        "Stratified sample selected"
      );
    }

    // Existing records keep their activityID so a rerun does not reissue
    // public identifiers.
    const existing = new Map<number, string>();
    if (mongoose.connection.readyState === 1) {
      const rows = await Activity.find(
        { orgID },
        { _id: 0, activityID: 1, h5pContentID: 1 }
      ).lean();
      for (const r of rows) existing.set(r.h5pContentID, r.activityID);
      log.info({ existing: existing.size }, "Existing activities found");
    }

    const ops: any[] = [];
    const createdAtOps: any[] = [];
    const usedIDs = new Set<string>(existing.values());

    const syntheticUsers = new Map<
      string,
      {
        uuid: string;
        centralID: string;
        email: string;
        firstName: string;
        lastName: string;
      }
    >();

    for (const [contentID, group] of byContent) {
      if (selected && !selected.has(contentID)) continue;
      const c = content.get(contentID);
      if (!c) {
        // Node points at content that no longer exists. Nothing to serve.
        report.skippedMissingContent.push(...group.map((n) => n.nid));
        continue;
      }

      const { winner, discarded } = pickCanonical(group, adaptIDs);
      if (discarded.length) {
        report.collapsedDuplicates.push({
          h5pContentID: contentID,
          canonicalNid: winner.nid,
          discardedNids: discarded.map((n) => n.nid),
        });
      }

      const author = authorMap.get(winner.uid) ?? { tier: 0 as const };
      report.authorTiers[String(author.tier)] += 1;
      if (!author.centralID && !author.conductorUUID) {
        report.activitiesWithNoAuthor.push(contentID);
      }

      let activityID = existing.get(contentID);
      if (!activityID) {
        do {
          activityID = b62(8);
        } while (usedIDs.has(activityID));
        usedIDs.add(activityID);
      }

      const collabUIDs = collaborators.get(winner.nid) ?? [];

      /**
       * Identity for this record, real or pseudonymised.
       *
       * Anonymised mode must reproduce production's *shape*, not just hide
       * names. In particular an author with a LibreOne identity but no
       * Conductor account (tier 3, 87 real authors) keeps that shape here:
       * `authorCentralID` is set and `createdBy` stays empty, so dev exercises
       * the unowned-activity path and the webhook backfill that fills it in.
       * Giving every synthetic author a local account would quietly delete
       * that case from dev.
       */
      let authorCentralID = author.centralID;
      let createdBy = author.conductorUUID;
      let collabUUIDs = collabUIDs
        .map((uid) => authorMap.get(uid)?.conductorUUID)
        .filter((v): v is string => Boolean(v));

      if (anonymize && pseudo) {
        /**
         * Registers a synthetic stand-in and returns its local uuid. The
         * seeded user's `uuid` is this exact value, so `createdBy` resolves.
         */
        const synthesize = (real: AuthorResolution): string | undefined => {
          if (!real.centralID || !real.conductorUUID) return undefined;
          const fakeCentral = pseudo.centralID(real.centralID);
          const fakeUUID = pseudo.localUUID(real.conductorUUID);
          const { firstName, lastName } = pseudo.name(real.centralID);
          syntheticUsers.set(fakeUUID, {
            uuid: fakeUUID,
            centralID: fakeCentral,
            email: pseudo.email(real.centralID),
            firstName,
            lastName,
          });
          return fakeUUID;
        };

        authorCentralID = author.centralID
          ? pseudo.centralID(author.centralID)
          : undefined;
        createdBy = seedUsers ? synthesize(author) : undefined;

        // Iterate the source uids, not the already-filtered uuid list: those
        // two arrays differ in length whenever a collaborator has no local
        // account, and indexing one by the other's position mismatches them.
        collabUUIDs = collabUIDs
          .map((uid) => {
            const real = authorMap.get(uid);
            if (!real) return undefined;
            return seedUsers
              ? synthesize(real)
              : real.conductorUUID
              ? pseudo.localUUID(real.conductorUUID)
              : undefined;
          })
          .filter((v): v is string => Boolean(v));
      }

      const doc = {
        activityID,
        h5pContentID: contentID,
        orgID,
        title: winner.title || c.title || `H5P Content ${contentID}`,
        // Free text is scrubbed of addresses in anonymised mode; the H5P
        // metadata author list is replaced outright, since it holds real names
        // typed by content creators and has no safe partial redaction.
        description: anonymize && pseudo
          ? pseudo.scrubText(body.get(winner.nid)?.[0])
          : body.get(winner.nid)?.[0],
        library: c.library,
        h5pAuthors: anonymize && pseudo
          ? pseudo.h5pAuthors(c.authors, author.centralID ?? String(winner.uid))
          : c.authors ?? undefined,
        source: c.source ?? undefined,
        adaptID: adaptIDs.get(winner.nid)?.[0],
        authorCentralID,
        createdBy,
        collaborators: collabUUIDs,
        publisher: publishers.get(winner.nid)?.[0],
        subjects: subjects.get(winner.nid) ?? [],
        tags: tags.get(winner.nid) ?? [],
        // Studio's `private` flag is set on exactly one node site-wide and is
        // readable by every authenticated user anyway, so it is not ported.
        // Catalog visibility is publication status plus include_in_library.
        visibility: winner.status === 1 ? "public" : "private",
        includeInLibrary: (inLibrary.get(winner.nid)?.[0] ?? 1) === 1,
        includeInProfile: (inProfile.get(winner.nid)?.[0] ?? 1) === 1,
        ...(c.license
          ? {
              license: {
                name: c.license,
                ...(c.license_version ? { version: c.license_version } : {}),
                // Free text typed by the author, so scrubbed like the body.
                ...(c.license_extras
                  ? {
                      additionalTerms: anonymize && pseudo
                        ? pseudo.scrubText(c.license_extras)
                        : c.license_extras,
                    }
                  : {}),
              },
            }
          : {}),
        // The rest of what Studio's `/api/h5p/{id}` emits that is not derivable
        // later: `default_language`, the library's display title (`type`, which
        // ADAPT matches on), Studio's library id (`type_id`) and the node uuid.
        ...(c.default_language ? { language: c.default_language } : {}),
        ...(c.library_title ? { libraryTitle: c.library_title } : {}),
        legacyLibraryID: c.library_id,
        ...(winner.uuid ? { legacyNodeUUID: winner.uuid } : {}),
        legacyNodeID: winner.nid,
        dataClass,
        // Studio's own timestamps, from the canonical node. ADAPT polls
        // `/api/h5p/all?changed=<date>` and Studio's author view sorts on
        // `changed`, so stamping the import time would make every activity
        // look changed on import day. Written with timestamps off for this op.
        ...(winner.created ? { createdAt: new Date(winner.created * 1000) } : {}),
        ...(winner.changed ? { updatedAt: new Date(winner.changed * 1000) } : {}),
      };

      if (existing.has(contentID)) report.updated += 1;
      else report.created += 1;

      ops.push({
        updateOne: {
          filter: { h5pContentID: contentID, orgID },
          update: { $set: doc },
          upsert: true,
          timestamps: false,
          overwriteImmutable: true,
        },
      });
      // On an upsert Mongoose moves immutable paths into `$setOnInsert`
      // before it consults `overwriteImmutable`, so `createdAt` only lands on
      // new documents. Correct it on existing ones with a plain update.
      if (existing.has(contentID) && doc.createdAt) {
        createdAtOps.push({
          updateOne: {
            filter: { h5pContentID: contentID, orgID },
            update: { $set: { createdAt: doc.createdAt } },
            timestamps: false,
            overwriteImmutable: true,
          },
        });
      }
    }

    report.activitiesPlanned = ops.length;
    report.syntheticUsersSeeded = syntheticUsers.size;

    if (COMMIT) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error("--commit requires an active Mongo connection.");
      }
      /**
       * Seed the synthetic authors so a dev environment can exercise author
       * profiles, ownership and collaborator access. Without these the import
       * lands with every activity unowned, which is not what production looks
       * like. Only ever written in anonymised mode, and the `@dev.invalid`
       * address makes them identifiable at a glance.
       */
      if (syntheticUsers.size) {
        if (!anonymize) {
          throw new Error(
            "Refusing to seed synthetic users outside anonymised mode."
          );
        }
        const userOps = [...syntheticUsers.values()].map((u) => ({
          updateOne: {
            filter: { uuid: u.uuid },
            update: {
              $set: {
                uuid: u.uuid,
                centralID: u.centralID,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
              },
            },
            upsert: true,
          },
        }));
        for (let i = 0; i < userOps.length; i += 500) {
          await User.bulkWrite(userOps.slice(i, i + 500), { ordered: false });
        }
        log.info({ users: userOps.length }, "Seeded synthetic authors");
      }

      const BATCH = 500;
      for (let i = 0; i < ops.length; i += BATCH) {
        const slice = ops.slice(i, i + BATCH);
        await Activity.bulkWrite(slice, { ordered: false });
        log.info(
          { written: Math.min(i + BATCH, ops.length), total: ops.length },
          "Import progress"
        );
      }
      // Separate pass, after the upserts: unordered bulk writes may run in
      // any order, so mixing these in could apply before their upsert.
      for (let i = 0; i < createdAtOps.length; i += BATCH) {
        await Activity.bulkWrite(createdAtOps.slice(i, i + BATCH), {
          ordered: false,
        });
      }
      log.info({ written: ops.length }, "Import complete");
    } else {
      log.info(
        { wouldWrite: ops.length },
        "Dry run complete; no records written"
      );
    }

    const outDir = path.resolve("migration-reports");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      outDir,
      `studio-import-${report.mode}-${stamp}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    process.stdout.write(
      `
${COMMIT ? "IMPORT" : "DRY RUN"}  [${report.dataClass}${
        report.anonymized ? ", pseudonymised" : ", REAL IDENTITIES"
      }]
` +
        (report.sampled
          ? `  Stratified sample:        ${report.sampled.selected} of ${report.sampled.of}
`
          : "") +
        `  Studio nodes read:        ${report.nodes}\n` +
        `  H5P content rows:         ${report.contentRows}\n` +
        `  Activities planned:       ${report.activitiesPlanned}\n` +
        `    new:                    ${report.created}\n` +
        `    updated:                ${report.updated}\n` +
        `  Duplicate ids collapsed:  ${report.collapsedDuplicates.length}\n` +
        `  Nodes w/ missing content: ${report.skippedMissingContent.length}\n` +
        `  Author tiers 1/2/3/4/none: ${report.authorTiers["1"]}/${report.authorTiers["2"]}/${report.authorTiers["3"]}/${report.authorTiers["4"]}/${report.authorTiers["0"]}\n` +
        `  Activities with no author: ${report.activitiesWithNoAuthor.length}\n` +
        (report.syntheticUsersSeeded
          ? `  Synthetic authors:        ${report.syntheticUsersSeeded}
`
          : "") +
        `\nReport: ${reportPath}\n` +
        (COMMIT ? "" : "\nRe-run with --commit to write these records.\n")
    );
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && process.argv[1].includes("StudioImportActivities")) {
  const mongoURI = process.env.MONGOOSEURI;
  const connected = mongoURI
    ? mongoose
        .connect(mongoURI)
        .then(() => true)
        .catch((err) => {
          logger.warn({ err }, "Mongo connect failed");
          return false;
        })
    : Promise.resolve(false);

  connected
    .then(() => runMigration())
    .catch((err) => {
      logger.error({ err }, "Studio activity import failed");
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => undefined));
}
