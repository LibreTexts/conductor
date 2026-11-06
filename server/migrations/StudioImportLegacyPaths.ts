/**
 * Studio -> Conductor legacy URL import. DRY RUN BY DEFAULT.
 *
 * Writes one `StudioLegacyNode` per Studio H5P and collection node, with every
 * URL alias that pointed at it, so the Commons legacy resolver can turn an old
 * `studio.libretexts.org` page URL into its Conductor page. Reads Studio MySQL
 * read-only and writes nothing unless `--commit` is passed.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   npx tsx --env-file=.env migrations/StudioImportLegacyPaths.ts
 *   #                                                    ... --commit
 *
 * See `models/studioLegacyNode.ts` for why the Activity records are not
 * enough on their own. Run it in any order relative to the other imports, and
 * again after the final cutover delta: it reads aliases, not activities.
 *
 * No identities are read, so there is no pseudonymised mode. Aliases follow
 * Studio's pathauto patterns (`h5p/[content id]`, `collection/[nid]`); the
 * report lists any that do not, since the edge only sends `/h5p/*`, `/node/*`
 * and `/collection/*` to the resolver.
 *
 * Idempotent: records are upserted on `nid`.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import mysql from "mysql2/promise";
import logger, { childLogger } from "../logger.js";
import StudioLegacyNode, {
  normalizeStudioAlias,
  StudioLegacyNodeKind,
} from "../models/studioLegacyNode.js";
import dotenv from "dotenv";
dotenv.config();

const log = childLogger("studio-import-legacy-paths");

const COMMIT = process.argv.includes("--commit");

/** Alias shapes the edge sends to the resolver. Anything else never reaches it. */
const ROUTED_ALIAS = /^\/(h5p|collection)\/[^/]+$/;

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

  log.info(
    { mode: COMMIT ? "COMMIT" : "DRY RUN", orgID },
    COMMIT
      ? "Importing Studio legacy paths"
      : "Dry run: no Conductor records will be written"
  );

  const conn = await mysql.createConnection(mysqlConfig);
  const report = {
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    nodes: { activity: 0, collection: 0 },
    activityNodesWithoutContent: [] as number[],
    aliases: 0,
    /** Aliases claimed by more than one node. The lowest alias id wins, as in Drupal. */
    aliasCollisions: [] as { alias: string; nids: number[] }[],
    /** Aliases the edge will not send to the resolver, with the node they named. */
    unroutedAliases: [] as { alias: string; nid: number }[],
  };

  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");

    const [nodeRows] = await conn.query(
      `SELECT n.nid, n.type, f.field_h5p_h5p_content_id AS h5p_content_id
       FROM node_field_data n
       LEFT JOIN node__field_h5p f ON f.entity_id = n.nid AND f.deleted = 0
       WHERE n.type IN ('h5p', 'collection') AND n.default_langcode = 1`
    );
    const nodes = new Map<
      number,
      { kind: StudioLegacyNodeKind; h5pContentID?: number; aliases: string[] }
    >();
    for (const r of nodeRows as any[]) {
      const kind: StudioLegacyNodeKind = r.type === "h5p" ? "activity" : "collection";
      nodes.set(r.nid, {
        kind,
        ...(r.h5p_content_id ? { h5pContentID: r.h5p_content_id } : {}),
        aliases: [],
      });
      report.nodes[kind] += 1;
      if (kind === "activity" && !r.h5p_content_id) {
        report.activityNodesWithoutContent.push(r.nid);
      }
    }

    // Ordered by id so the first claim on a colliding alias wins, matching
    // Drupal's own lookup.
    const [aliasRows] = await conn.query(
      `SELECT id, path, alias FROM path_alias
       WHERE status = 1 AND path LIKE '/node/%'
       ORDER BY id`
    );
    const owner = new Map<string, number>();
    const collisions = new Map<string, Set<number>>();
    for (const r of aliasRows as any[]) {
      const nid = Number(String(r.path).slice("/node/".length));
      const node = nodes.get(nid);
      if (!node || !r.alias) continue;
      const alias = normalizeStudioAlias(r.alias);
      const claimed = owner.get(alias);
      if (claimed !== undefined && claimed !== nid) {
        const set = collisions.get(alias) ?? new Set([claimed]);
        set.add(nid);
        collisions.set(alias, set);
        continue;
      }
      owner.set(alias, nid);
      if (!node.aliases.includes(alias)) node.aliases.push(alias);
      if (!ROUTED_ALIAS.test(alias)) report.unroutedAliases.push({ alias, nid });
    }
    report.aliases = owner.size;
    report.aliasCollisions = [...collisions].map(([alias, nids]) => ({
      alias,
      nids: [...nids],
    }));

    const ops = [...nodes].map(([nid, n]) => ({
      updateOne: {
        filter: { nid },
        update: {
          $set: {
            nid,
            orgID,
            kind: n.kind,
            aliases: n.aliases,
            ...(n.h5pContentID ? { h5pContentID: n.h5pContentID } : {}),
          },
          ...(n.h5pContentID ? {} : { $unset: { h5pContentID: 1 } }),
        },
        upsert: true,
      },
    }));

    if (COMMIT) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error("--commit requires an active Mongo connection.");
      }
      const BATCH = 1000;
      for (let i = 0; i < ops.length; i += BATCH) {
        await StudioLegacyNode.bulkWrite(ops.slice(i, i + BATCH), {
          ordered: false,
        });
        log.info(
          { written: Math.min(i + BATCH, ops.length), total: ops.length },
          "Import progress"
        );
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
      `studio-legacy-paths-${report.mode}-${stamp}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    process.stdout.write(
      `\n${COMMIT ? "IMPORT" : "DRY RUN"}\n` +
        `  H5P nodes:                 ${report.nodes.activity}\n` +
        `    without a content id:    ${report.activityNodesWithoutContent.length}\n` +
        `  Collection nodes:          ${report.nodes.collection}\n` +
        `  Aliases:                   ${report.aliases}\n` +
        `    collisions:              ${report.aliasCollisions.length}\n` +
        `    not routed by the edge:  ${report.unroutedAliases.length}\n` +
        `\nReport: ${reportPath}\n` +
        (COMMIT ? "" : "\nRe-run with --commit to write these records.\n")
    );
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && process.argv[1].includes("StudioImportLegacyPaths")) {
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
      logger.error({ err }, "Studio legacy path import failed");
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => undefined));
}
