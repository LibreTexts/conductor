/**
 * Studio migration survey. READ-ONLY.
 *
 * Answers the open questions blocking the Studio-to-Conductor migration plan.
 * It writes nothing to either database and creates no Conductor records. Run it
 * against a production replica with read-only MySQL credentials.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   npx tsx --env-file=.env server/migrations/StudioSurvey.ts
 *
 * What it answers:
 *   1. Volume          - how many activities, libraries, collections; sizing the
 *                        freeze window and the S3 bill.
 *   2. Author mapping  - how many Studio authors resolve to a Conductor User.
 *                        Studio stores the owner as their LibreOne UUID, which
 *                        is `User.centralID` here, NOT `User.uuid`. Anything
 *                        that fails to resolve is an activity that would land
 *                        without an owner, so this gates the import.
 *   3. Content types   - the most-used H5P libraries, which is the list the
 *                        compatibility spike must load.
 *   4. ADAPT coverage  - how many activities already carry an adapt_id.
 *   5. Collections     - whether sub-collection nesting is actually used, which
 *                        decides fold-into-Collection vs a separate model.
 *   6. User state      - whether h5p_content_user_data and h5p_points hold
 *                        enough to be worth migrating.
 *
 * Drupal keeps deleted field data in the field tables and stores one row per
 * translation, so every probe that touches `node_field_data`, `users_field_data`
 * or a `*__field_*` table filters `default_langcode = 1` and `deleted = 0`.
 * Without those filters the counts silently over-report.
 *
 * Every probe runs independently. These queries target a Drupal 9 schema that
 * was reconstructed from exported config rather than from a live database, so a
 * probe that references a table or column that does not exist reports itself as
 * failed and the rest of the survey still completes.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import mysql from "mysql2/promise";
import logger, { childLogger } from "../logger.js";
import User from "../models/user.js";

const log = childLogger("studio-survey");

type ProbeResult = {
  name: string;
  question: string;
  ok: boolean;
  rows?: unknown;
  error?: string;
};

const results: ProbeResult[] = [];

/**
 * Runs one read-only query. A probe that fails is recorded and the survey
 * continues; a reconstructed schema will have some misses and a single bad
 * table name should not cost a whole run against production.
 */
async function probe(
  conn: mysql.Connection,
  name: string,
  question: string,
  sql: string
): Promise<void> {
  try {
    const [rows] = await conn.query(sql);
    results.push({ name, question, ok: true, rows });
    log.info({ probe: name }, "Probe succeeded");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, question, ok: false, error: message });
    log.warn({ probe: name, err }, "Probe failed; continuing");
  }
}

async function surveyStudio(conn: mysql.Connection): Promise<void> {
  await probe(
    conn,
    "volume.content",
    "How many H5P activities are we moving?",
    `SELECT COUNT(*) AS h5p_content_rows FROM h5p_content`
  );

  await probe(
    conn,
    "volume.libraries",
    "How many H5P libraries must be migrated into the new library storage?",
    `SELECT COUNT(*) AS total,
            SUM(runnable = 1) AS runnable,
            SUM(restricted = 1) AS restricted
     FROM h5p_libraries`
  );

  await probe(
    conn,
    "volume.nodes",
    "How many H5P nodes exist, and how many are published?",
    `SELECT status, COUNT(*) AS nodes
     FROM node_field_data WHERE type = 'h5p' AND default_langcode = 1
     GROUP BY status`
  );

  await probe(
    conn,
    "volume.orphans",
    "Are there h5p_content rows with no node, or nodes pointing at missing content?",
    `SELECT
       (SELECT COUNT(*) FROM h5p_content c
          LEFT JOIN node__field_h5p f
            ON f.field_h5p_h5p_content_id = c.id AND f.deleted = 0
          WHERE f.entity_id IS NULL) AS content_without_node,
       (SELECT COUNT(*) FROM node__field_h5p f
          JOIN node_field_data n
            ON n.nid = f.entity_id AND n.default_langcode = 1
          LEFT JOIN h5p_content c ON c.id = f.field_h5p_h5p_content_id
          WHERE f.deleted = 0 AND c.id IS NULL) AS node_without_content,
       (SELECT COUNT(DISTINCT field_h5p_h5p_content_id)
          FROM node__field_h5p WHERE deleted = 0) AS distinct_content_referenced,
       (SELECT COUNT(*) FROM (
          SELECT field_h5p_h5p_content_id
          FROM node__field_h5p WHERE deleted = 0
          GROUP BY field_h5p_h5p_content_id HAVING COUNT(DISTINCT entity_id) > 1
        ) AS shared) AS content_shared_by_multiple_nodes`
  );

  await probe(
    conn,
    "volume.contentIdRange",
    "What is the id range? Confirms ids are plain integers we can carry over.",
    `SELECT MIN(id) AS min_id, MAX(id) AS max_id, COUNT(DISTINCT id) AS distinct_ids
     FROM h5p_content`
  );

  await probe(
    conn,
    "contentTypes.topLibraries",
    "Which content types must the compatibility spike load first?",
    `SELECT l.machine_name, l.major_version, l.minor_version, l.title,
            COUNT(c.id) AS activities
     FROM h5p_content c
     JOIN h5p_libraries l ON l.library_id = c.library_id
     GROUP BY l.library_id, l.machine_name, l.major_version, l.minor_version, l.title
     ORDER BY activities DESC
     LIMIT 30`
  );

  await probe(
    conn,
    "contentTypes.embedTypes",
    "How many activities render as iframe vs div? Affects the embed renderer.",
    `SELECT l.embed_types, COUNT(c.id) AS activities
     FROM h5p_content c
     JOIN h5p_libraries l ON l.library_id = c.library_id
     GROUP BY l.embed_types`
  );

  await probe(
    conn,
    "authors.distinct",
    "How many distinct authors own H5P activities?",
    `SELECT COUNT(DISTINCT n.uid) AS distinct_authors
     FROM node_field_data n
     WHERE n.type = 'h5p' AND n.default_langcode = 1`
  );

  /**
   * Drupal's `users_field_data.name` holds the LibreOne UUID, because Studio's
   * CAS attribute mapping sets `name` from `[cas:attribute:uuid]`. That value is
   * what must match `User.centralID` in Conductor.
   */
  await probe(
    conn,
    "authors.libreOneUUIDs",
    "Which LibreOne UUIDs own activities, and how many each?",
    `SELECT u.name AS libreone_uuid, u.mail AS email, COUNT(n.nid) AS activities
     FROM node_field_data n
     JOIN users_field_data u ON u.uid = n.uid AND u.default_langcode = 1
     WHERE n.type = 'h5p' AND n.default_langcode = 1
     GROUP BY u.uid, u.name, u.mail
     ORDER BY activities DESC`
  );

  await probe(
    conn,
    "authors.collaborators",
    "How many activities have collaborators, and how many distinct collaborators exist?",
    `SELECT COUNT(DISTINCT entity_id) AS activities_with_collaborators,
            COUNT(DISTINCT field_collaborators_target_id) AS distinct_collaborators,
            COUNT(*) AS collaborator_rows
     FROM node__field_collaborators
     WHERE bundle = 'h5p' AND deleted = 0`
  );

  await probe(
    conn,
    "adapt.coverage",
    "How many activities already carry an ADAPT question id?",
    `SELECT COUNT(*) AS activities_with_adapt_id
     FROM node__field_adapt_id
     WHERE deleted = 0
       AND field_adapt_id_value IS NOT NULL AND field_adapt_id_value <> ''`
  );

  await probe(
    conn,
    "collections.volume",
    "How many collections, and how many are hidden or excluded from the library?",
    `SELECT COUNT(*) AS collections FROM node_field_data
     WHERE type = 'collection' AND default_langcode = 1`
  );

  /**
   * The fold-vs-separate decision. If almost every collection has exactly one
   * sub-collection, the paragraph layer is incidental and collections flatten
   * into Conductor's existing model. If nesting is widely used, it is a real
   * feature and needs its own model.
   */
  await probe(
    conn,
    "collections.nesting",
    "Is sub-collection nesting actually used, or is it always a single group?",
    `SELECT sub_collections, COUNT(*) AS collections FROM (
       SELECT entity_id, COUNT(*) AS sub_collections
       FROM node__field_collections
       WHERE deleted = 0
       GROUP BY entity_id
     ) AS per_collection
     GROUP BY sub_collections
     ORDER BY sub_collections`
  );

  await probe(
    conn,
    "collections.size",
    "How many activities does a collection hold?",
    `SELECT MIN(items) AS min_items, MAX(items) AS max_items,
            ROUND(AVG(items), 2) AS avg_items, COUNT(*) AS sub_collections
     FROM (
       SELECT entity_id, COUNT(*) AS items
       FROM paragraph__field_collection_resources
       WHERE deleted = 0
       GROUP BY entity_id
     ) AS per_paragraph`
  );

  await probe(
    conn,
    "visibility.private",
    "How many H5P nodes are flagged private?",
    `SELECT private, COUNT(*) AS nodes
     FROM node_field_data WHERE type = 'h5p' AND default_langcode = 1
     GROUP BY private`
  );

  await probe(
    conn,
    "visibility.includeInLibrary",
    "How many activities are actually listed in the public library?",
    `SELECT field_include_in_library_value AS include_in_library, COUNT(*) AS nodes
     FROM node__field_include_in_library
     WHERE bundle = 'h5p' AND deleted = 0
     GROUP BY field_include_in_library_value`
  );

  await probe(
    conn,
    "userState.contentUserData",
    "Is saved content state worth migrating? Studio had save_content_state off.",
    `SELECT COUNT(*) AS rows_stored,
            COUNT(DISTINCT content_main_id) AS distinct_content,
            COUNT(DISTINCT user_id) AS distinct_users
     FROM h5p_content_user_data`
  );

  await probe(
    conn,
    "userState.points",
    "How many stored results exist?",
    `SELECT COUNT(*) AS rows_stored,
            COUNT(DISTINCT content_id) AS distinct_content,
            COUNT(DISTINCT uid) AS distinct_users
     FROM h5p_points`
  );

  await probe(
    conn,
    "accessibility.guides",
    "How many accessibility guides exist?",
    `SELECT COUNT(*) AS guides FROM node_field_data
     WHERE type = 'accessibility' AND default_langcode = 1`
  );

  await probe(
    conn,
    "taxonomy.usage",
    "How large are the vocabularies we would import?",
    `SELECT vid, COUNT(*) AS terms FROM taxonomy_term_field_data
     WHERE default_langcode = 1 GROUP BY vid`
  );
}

/**
 * Cross-checks Studio's author identifiers against Conductor.
 *
 * Studio's `users_field_data.name` is a LibreOne UUID. In Conductor that is
 * `User.centralID`; `User.uuid` is local and will never match. An author that
 * does not resolve here is an activity that would be imported with no owner.
 */
async function surveyAuthorMapping(): Promise<void> {
  const authorProbe = results.find((r) => r.name === "authors.libreOneUUIDs");
  if (!authorProbe?.ok || !Array.isArray(authorProbe.rows)) {
    results.push({
      name: "authors.conductorMapping",
      question: "Do Studio authors resolve to Conductor users?",
      ok: false,
      error: "Skipped: the authors.libreOneUUIDs probe did not return rows.",
    });
    return;
  }

  const rows = authorProbe.rows as {
    libreone_uuid: string | null;
    email: string | null;
    activities: number;
  }[];

  const centralIDs = rows
    .map((r) => r.libreone_uuid)
    .filter((id): id is string => Boolean(id));

  const matched = await User.find(
    { centralID: { $in: centralIDs } },
    { _id: 0, uuid: 1, centralID: 1, email: 1 }
  ).lean();

  const matchedByCentralID = new Map(matched.map((u) => [u.centralID, u]));

  const unresolved = rows
    .filter((r) => !r.libreone_uuid || !matchedByCentralID.has(r.libreone_uuid))
    .map((r) => ({
      libreone_uuid: r.libreone_uuid,
      email: r.email,
      activities: r.activities,
    }));

  const orphanedActivities = unresolved.reduce(
    (sum, r) => sum + Number(r.activities || 0),
    0
  );

  results.push({
    name: "authors.conductorMapping",
    question:
      "Do Studio authors resolve to Conductor users via centralID, and how much content is at risk if not?",
    ok: true,
    rows: {
      studioAuthors: rows.length,
      resolved: rows.length - unresolved.length,
      unresolved: unresolved.length,
      activitiesWithoutResolvableOwner: orphanedActivities,
      // Capped: the point is whether the number is zero, not a full dump.
      unresolvedSample: unresolved.slice(0, 500),
    },
  });
}

function renderReport(): string {
  const lines: string[] = [];
  lines.push("Studio migration survey");
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push("READ-ONLY: nothing was written to either database.");
  lines.push("");

  for (const r of results) {
    lines.push(`## ${r.name}`);
    lines.push(r.question);
    if (!r.ok) {
      lines.push(`  FAILED: ${r.error}`);
    } else {
      lines.push(JSON.stringify(r.rows, null, 2));
    }
    lines.push("");
  }

  const failed = results.filter((r) => !r.ok);
  lines.push(`${results.length - failed.length}/${results.length} probes succeeded.`);
  if (failed.length) {
    lines.push(`Failed: ${failed.map((f) => f.name).join(", ")}`);
  }
  lines.push("");
  lines.push("Not answerable from the database, run on the Studio host:");
  lines.push("  du -sh web/sites/default/files/h5p/libraries");
  lines.push("  du -sh web/sites/default/files/h5p/content");
  lines.push("  du -sh web/sites/default/files/h5p");

  return lines.join("\n");
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

  log.info(
    { host: mysqlConfig.host, database: mysqlConfig.database },
    "Starting read-only Studio survey"
  );

  const conn = await mysql.createConnection(mysqlConfig);
  try {
    // Belt and braces: even with read-only credentials, make the session itself
    // refuse writes so a mistake here cannot touch production data.
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    await surveyStudio(conn);
  } finally {
    await conn.end();
  }

  if (mongoose.connection.readyState === 1) {
    await surveyAuthorMapping();
  } else {
    results.push({
      name: "authors.conductorMapping",
      question: "Do Studio authors resolve to Conductor users?",
      ok: false,
      error: "Skipped: no active Mongoose connection to Conductor.",
    });
  }

  const outDir = path.resolve("migration-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(outDir, `studio-survey-${stamp}.json`);
  const textPath = path.join(outDir, `studio-survey-${stamp}.txt`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(textPath, renderReport());

  log.info({ jsonPath, textPath }, "Survey complete");
  // The report is the deliverable, so put it where whoever ran it will see it.
  process.stdout.write(`\n${renderReport()}\n`);
}

// Allow `npx tsx server/migrations/StudioSurvey.ts` to run it directly.
if (process.argv[1] && process.argv[1].includes("StudioSurvey")) {
  const mongoURI = process.env.MONGOOSEURI;
  const connected = mongoURI
    ? mongoose.connect(mongoURI).then(() => true).catch((err) => {
        logger.warn({ err }, "Mongo connect failed; author mapping will be skipped");
        return false;
      })
    : Promise.resolve(false);

  connected
    .then(() => runMigration())
    .catch((err) => {
      logger.error({ err }, "Studio survey failed");
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => undefined));
}
