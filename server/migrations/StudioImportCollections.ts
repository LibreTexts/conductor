/**
 * Studio -> Conductor activity collection import. DRY RUN BY DEFAULT.
 *
 * Creates the Conductor `ActivityCollection` records for Studio's collection
 * nodes. Reads Studio MySQL read-only and writes nothing unless `--commit` is
 * passed.
 *
 * Part of phase C, run after `StudioImportActivities.ts`. ADAPT's bulk H5P
 * importer reads collections through Studio's `/api/collections/list` and
 * `/api/collections/{cid}`, and turns each sub-collection into an assignment
 * named after its title, so three things here are contracts rather than
 * presentation:
 *
 *   - Studio's collection nid is kept as `legacyCollectionID`. ADAPT stores it
 *     as `cid`.
 *   - Sub-collections keep their titles and their order.
 *   - Activities inside each sub-collection keep their order.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   npx tsx --env-file=.env migrations/StudioImportCollections.ts
 *   #                                                    ... --commit
 *
 * Studio stored a collection as a node whose `field_collections` paragraphs
 * are the sub-collections, each with a title and an ordered list of H5P node
 * references. Those references are to NODES, so each is resolved to its H5P
 * content id here. The activity import collapsed nodes that share a content id
 * into one activity, so resolving by content id lands every reference on the
 * canonical activity. References to nodes whose content is gone are reported
 * and left out.
 *
 * Every collection is imported in every environment, with no sampling: there
 * are only 311. A staging activity import that used the default sample leaves
 * most references without an `Activity`. The report counts them, and
 * `StudioImportActivities.ts --full` closes the gap.
 *
 * Identities follow the activity import exactly: pseudonymised unless
 * `--with-identities`, which is refused outside `APP_ENV=production`.
 *
 * Idempotent: records are upserted on `legacyCollectionID`, and an existing
 * `collectionID` is reused so reruns do not churn public identifiers.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import mysql from "mysql2/promise";
import b62 from "base62-random";
import logger, { childLogger } from "../logger.js";
import Activity from "../models/activity.js";
import ActivityCollection from "../models/activityCollection.js";
import User from "../models/user.js";
import StudioPseudonymizer from "./StudioPseudonymizer.js";
import {
  type AuthorResolution,
  buildAuthorMap,
  loadFieldMap,
  resolveMode,
} from "./StudioImportActivities.js";
import dotenv from "dotenv";
dotenv.config();

const log = childLogger("studio-import-collections");

const COMMIT = process.argv.includes("--commit");

/** Studio row shapes, as the queries below return them. */
type StudioCollectionNode = {
  nid: number;
  uid: number;
  status: number;
  title: string | null;
  created: number | null;
  changed: number | null;
};

type SubCollectionRef = { nid: number; delta: number; pid: number };
type ResourceRef = { pid: number; delta: number; target: number };

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
      seedUsers,
    },
    COMMIT
      ? `Importing Studio collections as ${dataClass} data`
      : `Dry run (${dataClass}): no Conductor records will be written`
  );

  const conn = await mysql.createConnection(mysqlConfig);
  const report = {
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    dataClass,
    anonymized: anonymize,
    collections: 0,
    created: 0,
    updated: 0,
    subCollections: 0,
    activityReferences: 0,
    /** Collection nids that have no sub-collections at all. */
    collectionsWithNoSubCollections: [] as number[],
    /** References to a node that is not an H5P node, or has no content id. */
    unresolvedReferences: [] as { collectionNid: number; targetNid: number }[],
    /** References whose node points at H5P content that no longer exists. */
    missingContentReferences: [] as {
      collectionNid: number;
      targetNid: number;
      h5pContentID: number;
    }[],
    /**
     * Content ids referenced by a collection with no Conductor `Activity`.
     * Expected after a sampled staging activity import, never in production.
     */
    referencesWithoutActivity: 0,
    /** Collections whose Studio screenshots were not migrated. */
    collectionsWithScreenshots: [] as number[],
    authorTiers: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 } as Record<string, number>,
    syntheticUsersSeeded: 0,
  };

  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");

    const casCsvPath =
      process.env.STUDIO_CAS_CSV ||
      path.resolve("..", "studio_main", "scripts", "cas_users.csv");
    const authorMap = await buildAuthorMap(conn, casCsvPath);

    const [collectionRows] = await conn.query(
      `SELECT nid, uid, status, title, created, changed
       FROM node_field_data
       WHERE type = 'collection' AND default_langcode = 1
       ORDER BY nid`
    );
    const collections = collectionRows as StudioCollectionNode[];
    report.collections = collections.length;

    // Sub-collection paragraphs per collection, in display order.
    const [subRows] = await conn.query(
      `SELECT entity_id AS nid, delta, field_collections_target_id AS pid
       FROM node__field_collections
       WHERE bundle = 'collection' AND deleted = 0
       ORDER BY entity_id, delta`
    );
    const subsByCollection = new Map<number, SubCollectionRef[]>();
    for (const r of subRows as SubCollectionRef[]) {
      const list = subsByCollection.get(r.nid);
      if (list) list.push(r);
      else subsByCollection.set(r.nid, [r]);
    }

    const subTitles = await loadFieldMap<string>(
      conn,
      "collection_title_name",
      `SELECT entity_id, field_collection_title_name_value
       FROM paragraph__field_collection_title_name
       WHERE deleted = 0`,
      (r) => [r.entity_id, r.field_collection_title_name_value]
    );

    // Activity node references per sub-collection paragraph, in display order.
    const [resourceRows] = await conn.query(
      `SELECT entity_id AS pid, delta, field_collection_resources_target_id AS target
       FROM paragraph__field_collection_resources
       WHERE deleted = 0
       ORDER BY entity_id, delta`
    );
    const resourcesBySub = new Map<number, ResourceRef[]>();
    for (const r of resourceRows as ResourceRef[]) {
      const list = resourcesBySub.get(r.pid);
      if (list) list.push(r);
      else resourcesBySub.set(r.pid, [r]);
    }

    // H5P node -> content id, and which content ids still exist.
    const [h5pRows] = await conn.query(
      `SELECT entity_id, field_h5p_h5p_content_id AS content_id
       FROM node__field_h5p
       WHERE bundle = 'h5p' AND deleted = 0`
    );
    const contentOfNode = new Map<number, number>(
      (h5pRows as any[]).map((r) => [r.entity_id, r.content_id])
    );
    const [contentRows] = await conn.query(`SELECT id FROM h5p_content`);
    const contentExists = new Set<number>(
      (contentRows as any[]).map((r) => r.id)
    );

    const description = await loadFieldMap<string>(
      conn,
      "description",
      `SELECT entity_id, field_description_value FROM node__field_description
       WHERE bundle = 'collection' AND deleted = 0`,
      (r) => [r.entity_id, r.field_description_value]
    );
    const oerReference = await loadFieldMap<string>(
      conn,
      "oer_reference",
      `SELECT entity_id, field_oer_reference_uri FROM node__field_oer_reference
       WHERE bundle = 'collection' AND deleted = 0`,
      (r) => [r.entity_id, r.field_oer_reference_uri]
    );
    const oerReferenceTitle = await loadFieldMap<string>(
      conn,
      "oer_reference_title",
      `SELECT entity_id, field_oer_reference_title FROM node__field_oer_reference
       WHERE bundle = 'collection' AND deleted = 0 AND field_oer_reference_title IS NOT NULL
         AND field_oer_reference_title <> ''`,
      (r) => [r.entity_id, r.field_oer_reference_title]
    );
    const screenshots = await loadFieldMap<number>(
      conn,
      "screenshots",
      `SELECT entity_id, field_screenshots_target_id FROM node__field_screenshots
       WHERE bundle = 'collection' AND deleted = 0`,
      (r) => [r.entity_id, r.field_screenshots_target_id]
    );
    const subjects = await loadFieldMap<string>(
      conn,
      "subject",
      `SELECT f.entity_id, t.name FROM node__field_subject f
       JOIN taxonomy_term_field_data t ON t.tid = f.field_subject_target_id AND t.default_langcode = 1
       WHERE f.bundle = 'collection' AND f.deleted = 0
       ORDER BY f.entity_id, f.delta`,
      (r) => [r.entity_id, r.name]
    );
    const tags = await loadFieldMap<string>(
      conn,
      "tags",
      `SELECT f.entity_id, t.name FROM node__field_tags f
       JOIN taxonomy_term_field_data t ON t.tid = f.field_tags_target_id AND t.default_langcode = 1
       WHERE f.bundle = 'collection' AND f.deleted = 0
       ORDER BY f.entity_id, f.delta`,
      (r) => [r.entity_id, r.name]
    );
    const inLibrary = await loadFieldMap<number>(
      conn,
      "include_in_library",
      `SELECT entity_id, field_include_in_library_value FROM node__field_include_in_library
       WHERE bundle = 'collection' AND deleted = 0`,
      (r) => [r.entity_id, r.field_include_in_library_value]
    );

    // Which content ids have an Activity, to report dangling references, and
    // which collections already exist, so reruns keep their collectionID.
    const activityContentIDs = new Set<number>();
    const existing = new Map<number, string>();
    if (mongoose.connection.readyState === 1) {
      const activities = await Activity.find(
        { orgID },
        { _id: 0, h5pContentID: 1 }
      ).lean();
      for (const a of activities) activityContentIDs.add(a.h5pContentID);

      const rows = await ActivityCollection.find(
        { orgID, legacyCollectionID: { $exists: true } },
        { _id: 0, collectionID: 1, legacyCollectionID: 1 }
      ).lean();
      for (const r of rows) {
        if (r.legacyCollectionID != null) {
          existing.set(r.legacyCollectionID, r.collectionID);
        }
      }
      log.info(
        { activities: activityContentIDs.size, existing: existing.size },
        "Loaded existing Conductor records"
      );
    } else {
      log.warn("No Mongo connection; dangling-reference counts will be inflated");
    }

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

    const ops: any[] = [];
    const createdAtOps: any[] = [];

    for (const node of collections) {
      const subRefs = subsByCollection.get(node.nid) ?? [];
      if (!subRefs.length) report.collectionsWithNoSubCollections.push(node.nid);
      if (screenshots.get(node.nid)?.length) {
        report.collectionsWithScreenshots.push(node.nid);
      }

      const subCollections = subRefs.map((sub) => {
        const h5pContentIDs: number[] = [];
        for (const ref of resourcesBySub.get(sub.pid) ?? []) {
          const contentID = contentOfNode.get(ref.target);
          if (contentID == null) {
            report.unresolvedReferences.push({
              collectionNid: node.nid,
              targetNid: ref.target,
            });
            continue;
          }
          if (!contentExists.has(contentID)) {
            report.missingContentReferences.push({
              collectionNid: node.nid,
              targetNid: ref.target,
              h5pContentID: contentID,
            });
            continue;
          }
          if (!activityContentIDs.has(contentID)) {
            report.referencesWithoutActivity += 1;
          }
          h5pContentIDs.push(contentID);
        }
        report.activityReferences += h5pContentIDs.length;
        return {
          title: subTitles.get(sub.pid)?.[0] ?? "",
          h5pContentIDs,
        };
      });
      report.subCollections += subCollections.length;

      const author: AuthorResolution =
        authorMap.get(node.uid) ?? { tier: 0 as const };
      report.authorTiers[String(author.tier)] += 1;

      let authorCentralID = author.centralID;
      let createdBy = author.conductorUUID;
      if (anonymize && pseudo) {
        // Same derivation as the activity import, so a pseudonymised author
        // owns their collections and their activities under one identity.
        authorCentralID = author.centralID
          ? pseudo.centralID(author.centralID)
          : undefined;
        createdBy = undefined;
        if (seedUsers && author.centralID && author.conductorUUID) {
          const fakeUUID = pseudo.localUUID(author.conductorUUID);
          const { firstName, lastName } = pseudo.name(author.centralID);
          syntheticUsers.set(fakeUUID, {
            uuid: fakeUUID,
            centralID: pseudo.centralID(author.centralID),
            email: pseudo.email(author.centralID),
            firstName,
            lastName,
          });
          createdBy = fakeUUID;
        }
      }

      let collectionID = existing.get(node.nid);
      if (!collectionID) {
        do {
          collectionID = b62(8);
        } while (usedIDs.has(collectionID));
        usedIDs.add(collectionID);
      }

      const rawDescription = description.get(node.nid)?.[0];
      const rawOerReference = oerReference.get(node.nid)?.[0];
      const rawOerReferenceTitle = oerReferenceTitle.get(node.nid)?.[0];

      const doc = {
        collectionID,
        legacyCollectionID: node.nid,
        orgID,
        title: node.title || `Collection ${node.nid}`,
        description:
          anonymize && pseudo ? pseudo.scrubText(rawDescription) : rawDescription,
        oerReference:
          anonymize && pseudo ? pseudo.scrubText(rawOerReference) : rawOerReference,
        oerReferenceTitle:
          anonymize && pseudo ? pseudo.scrubText(rawOerReferenceTitle) : rawOerReferenceTitle,
        authorCentralID,
        createdBy,
        subjects: subjects.get(node.nid) ?? [],
        tags: tags.get(node.nid) ?? [],
        subCollections,
        visibility: node.status === 1 ? "public" : "private",
        includeInLibrary: (inLibrary.get(node.nid)?.[0] ?? 1) === 1,
        dataClass,
        // Studio's own timestamps, because its collection list is ordered by
        // `changed`. Written explicitly with timestamps off for this op, or
        // Mongoose would stamp the import time over them.
        ...(node.created ? { createdAt: new Date(node.created * 1000) } : {}),
        ...(node.changed ? { updatedAt: new Date(node.changed * 1000) } : {}),
      };

      if (existing.has(node.nid)) report.updated += 1;
      else report.created += 1;

      ops.push({
        updateOne: {
          filter: { legacyCollectionID: node.nid, orgID },
          update: { $set: doc },
          upsert: true,
          timestamps: false,
          overwriteImmutable: true,
        },
      });
      // On an upsert Mongoose moves immutable paths into `$setOnInsert`
      // before it consults `overwriteImmutable`, so `createdAt` only lands on
      // new documents. Correct it on existing ones with a plain update.
      if (existing.has(node.nid) && doc.createdAt) {
        createdAtOps.push({
          updateOne: {
            filter: { legacyCollectionID: node.nid, orgID },
            update: { $set: { createdAt: doc.createdAt } },
            timestamps: false,
            overwriteImmutable: true,
          },
        });
      }
    }

    report.syntheticUsersSeeded = syntheticUsers.size;

    if (COMMIT) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error("--commit requires an active Mongo connection.");
      }
      if (syntheticUsers.size) {
        if (!anonymize) {
          throw new Error(
            "Refusing to seed synthetic users outside anonymised mode."
          );
        }
        const userOps = [...syntheticUsers.values()].map((u) => ({
          updateOne: {
            filter: { uuid: u.uuid },
            update: { $set: u },
            upsert: true,
          },
        }));
        for (let i = 0; i < userOps.length; i += 500) {
          await User.bulkWrite(userOps.slice(i, i + 500), { ordered: false });
        }
        log.info({ users: userOps.length }, "Seeded synthetic authors");
      }

      const BATCH = 100;
      for (let i = 0; i < ops.length; i += BATCH) {
        await ActivityCollection.bulkWrite(ops.slice(i, i + BATCH), {
          ordered: false,
        });
        log.info(
          { written: Math.min(i + BATCH, ops.length), total: ops.length },
          "Import progress"
        );
      }
      // Separate pass, after the upserts: unordered bulk writes may run in
      // any order, so mixing these in could apply before their upsert.
      for (let i = 0; i < createdAtOps.length; i += BATCH) {
        await ActivityCollection.bulkWrite(createdAtOps.slice(i, i + BATCH), {
          ordered: false,
        });
      }
      log.info({ written: ops.length }, "Import complete");
    } else {
      log.info({ wouldWrite: ops.length }, "Dry run complete; no records written");
    }

    const outDir = path.resolve("migration-reports");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      outDir,
      `studio-collections-import-${report.mode}-${stamp}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    process.stdout.write(
      `\n${COMMIT ? "IMPORT" : "DRY RUN"}  [${report.dataClass}${
        report.anonymized ? ", pseudonymised" : ", REAL IDENTITIES"
      }]\n` +
        `  Collections read:          ${report.collections}\n` +
        `    new:                     ${report.created}\n` +
        `    updated:                 ${report.updated}\n` +
        `    with no sub-collections: ${report.collectionsWithNoSubCollections.length}\n` +
        `  Sub-collections:           ${report.subCollections}\n` +
        `  Activity references:       ${report.activityReferences}\n` +
        `    without an Activity:     ${report.referencesWithoutActivity}\n` +
        `  Dropped, not an H5P node:  ${report.unresolvedReferences.length}\n` +
        `  Dropped, missing content:  ${report.missingContentReferences.length}\n` +
        `  Screenshots not migrated:  ${report.collectionsWithScreenshots.length}\n` +
        `  Author tiers 1/2/3/4/none: ${report.authorTiers["1"]}/${report.authorTiers["2"]}/${report.authorTiers["3"]}/${report.authorTiers["4"]}/${report.authorTiers["0"]}\n` +
        (report.syntheticUsersSeeded
          ? `  Synthetic authors:         ${report.syntheticUsersSeeded}\n`
          : "") +
        `\nReport: ${reportPath}\n` +
        (COMMIT ? "" : "\nRe-run with --commit to write these records.\n")
    );
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && process.argv[1].includes("StudioImportCollections")) {
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
      logger.error({ err }, "Studio collection import failed");
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => undefined));
}
