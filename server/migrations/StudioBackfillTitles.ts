/**
 * Replaces Studio's auto-generated activity titles. DRY RUN BY DEFAULT.
 *
 * The first production import took titles from the Drupal node, which Studio's
 * `auto_entitylabel` had overwritten with `H5P Resource ID #[content id]`. This
 * rewrites only activities whose title still has that exact shape, using
 * `h5p_content.title`, so a title changed in Conductor since the import is
 * never touched. `updatedAt` is left alone: ADAPT polls on it, and Studio
 * already served ADAPT the content title, so nothing changed from its side.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   npx tsx --env-file=.env server/migrations/StudioBackfillTitles.ts
 *   #                                                          ... --commit
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import mysql from "mysql2/promise";
import logger, { childLogger } from "../logger.js";
import Activity from "../models/activity.js";
import { STUDIO_AUTO_TITLE, studioTitle } from "./StudioImportActivities.js";
import dotenv from "dotenv";
dotenv.config();

const log = childLogger("studio-backfill-titles");

const COMMIT = process.argv.includes("--commit");

export async function runBackfill(): Promise<void> {
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
  if (mongoose.connection.readyState !== 1) {
    throw new Error("This backfill needs an active Mongo connection (MONGOOSEURI).");
  }

  log.info(
    { mode: COMMIT ? "COMMIT" : "DRY RUN", orgID },
    COMMIT ? "Backfilling activity titles" : "Dry run: no titles will be written"
  );

  const stale = await Activity.find(
    { orgID, title: { $regex: STUDIO_AUTO_TITLE.source } },
    { _id: 0, h5pContentID: 1, title: 1 }
  ).lean();
  log.info({ stale: stale.length }, "Activities with an auto-generated title");

  const report = {
    mode: COMMIT ? "commit" : "dry-run",
    generatedAt: new Date().toISOString(),
    stale: stale.length,
    planned: 0,
    noContentTitle: [] as number[],
  };

  if (!stale.length) {
    process.stdout.write("\nNo auto-generated titles found. Nothing to do.\n");
    return;
  }

  const conn = await mysql.createConnection(mysqlConfig);
  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    const [rows] = await conn.query(
      "SELECT id, title FROM h5p_content WHERE id IN (?)",
      [stale.map((a) => a.h5pContentID)]
    );
    const titleByID = new Map(
      (rows as { id: number; title: string | null }[]).map((r) => [r.id, r.title])
    );

    const ops: any[] = [];
    for (const a of stale) {
      const title = studioTitle(titleByID.get(a.h5pContentID), a.title, a.h5pContentID);
      if (!titleByID.get(a.h5pContentID)?.trim()) {
        report.noContentTitle.push(a.h5pContentID);
      }
      if (title === a.title) continue;
      ops.push({
        updateOne: {
          // Repeat the title match so a rename between read and write wins.
          filter: { orgID, h5pContentID: a.h5pContentID, title: a.title },
          update: { $set: { title } },
          timestamps: false,
        },
      });
    }
    report.planned = ops.length;

    if (COMMIT) {
      const BATCH = 500;
      for (let i = 0; i < ops.length; i += BATCH) {
        await Activity.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
        log.info(
          { written: Math.min(i + BATCH, ops.length), total: ops.length },
          "Backfill progress"
        );
      }
      log.info({ written: ops.length }, "Backfill complete");
    }

    const outDir = path.resolve("migration-reports");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(outDir, `studio-backfill-titles-${report.mode}-${stamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    process.stdout.write(
      `\n${COMMIT ? "BACKFILL" : "DRY RUN"}\n` +
        `  Auto-generated titles:    ${report.stale}\n` +
        `  Titles to rewrite:        ${report.planned}\n` +
        `  No content title (kept as "H5P Content {id}"): ${report.noContentTitle.length}\n` +
        `\nReport: ${reportPath}\n` +
        (COMMIT ? "" : "\nRe-run with --commit to write these titles.\n")
    );
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && process.argv[1].includes("StudioBackfillTitles")) {
  const mongoURI = process.env.MONGOOSEURI;
  (mongoURI ? mongoose.connect(mongoURI) : Promise.reject(new Error("Missing MONGOOSEURI.")))
    .then(() => runBackfill())
    .catch((err) => {
      logger.error({ err }, "Studio title backfill failed");
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect().catch(() => undefined));
}
