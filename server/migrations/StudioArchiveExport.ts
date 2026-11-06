/**
 * Studio learner-data cold archive. READ-ONLY against Studio.
 *
 * Exports the learner result data that is not being imported into Conductor,
 * so the Studio host can be decommissioned without destroying it. ADAPT holds
 * the grading of record, which makes these rows a by-product rather than a
 * system of record, but they are not discardable either.
 *
 * What it exports (row counts from the 2026-10-22 production survey):
 *   h5p_points             1,131,666 rows   learner results
 *   h5p_content_user_data     15,644 rows   saved player state
 *   users                    673,977 rows   uid -> LibreOne UUID + email
 *
 * The users export is what makes the other two legible years from now, since
 * both key on Drupal's integer uid, which stops meaning anything the moment
 * Studio is gone. It is also the file that carries personal data: roughly 674k
 * email addresses. It is written as a separate object so access to it can be
 * controlled separately from the result rows, and the upload applies
 * server-side encryption. Set a retention period on the prefix; this script
 * deliberately does not choose one for you.
 *
 *   STUDIO_MYSQL_HOST=... STUDIO_MYSQL_USER=... STUDIO_MYSQL_PASSWORD=... \
 *   STUDIO_MYSQL_DATABASE=studio_main \
 *   ARCHIVE_S3_BUCKET=libretexts-studio-archive \
 *   npx tsx server/migrations/StudioArchiveExport.ts
 *
 * Without ARCHIVE_S3_BUCKET it writes the files locally and stops, so the
 * export can be inspected before anything leaves the machine.
 *
 * Rows are streamed from MySQL and gzipped on the way to disk. 1.1M rows must
 * never be buffered in memory, and `mysql2`'s default query path would do
 * exactly that.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import mysql from "mysql2/promise";
import {
  PutObjectCommand,
  S3Client,
  type StorageClass,
} from "@aws-sdk/client-s3";
import logger, { childLogger } from "../logger.js";

const log = childLogger("studio-archive");

type ExportSpec = {
  /** Base filename, without extension. */
  name: string;
  /** What this table holds, recorded in the manifest. */
  description: string;
  sql: string;
  /** True when the export contains personal data. */
  sensitive: boolean;
};

const EXPORTS: ExportSpec[] = [
  {
    name: "h5p_points",
    description:
      "Learner results: one row per (content, user) with score and timing.",
    sql: `SELECT content_id, uid, started, finished, points, max_points
          FROM h5p_points`,
    sensitive: false,
  },
  {
    name: "h5p_content_user_data",
    description:
      "Saved player state. Retained despite h5p_save_content_state being off, because rows exist.",
    sql: `SELECT user_id, content_main_id, sub_content_id, data_id,
                 timestamp, data, preloaded, delete_on_content_change
          FROM h5p_content_user_data`,
    sensitive: false,
  },
  {
    name: "users",
    description:
      "Drupal uid to LibreOne UUID and email. Required to interpret the other two exports. CONTAINS PERSONAL DATA.",
    sql: `SELECT uid, name AS libreone_uuid, mail AS email, created, access, login
          FROM users_field_data
          WHERE default_langcode = 1`,
    sensitive: true,
  },
];

type ExportResult = {
  name: string;
  description: string;
  sensitive: boolean;
  file: string;
  rows: number;
  bytesGzipped: number;
  sha256: string;
};

/**
 * Streams one query to a gzipped JSON Lines file, hashing the compressed bytes
 * as they are written so the manifest can record an integrity check without a
 * second pass over the file.
 */
async function exportTable(
  conn: mysql.Connection,
  spec: ExportSpec,
  outDir: string
): Promise<ExportResult> {
  const file = path.join(outDir, `${spec.name}.jsonl.gz`);
  let rows = 0;

  // The raw connection exposes the streaming query API; the promise wrapper
  // does not. Without this the whole result set is buffered.
  const source = (conn as any).connection.query(spec.sql).stream();

  const toJsonl = new Transform({
    objectMode: true,
    transform(row, _enc, cb) {
      rows += 1;
      if (rows % 100000 === 0) {
        log.info({ table: spec.name, rows }, "Export progress");
      }
      cb(null, JSON.stringify(row) + "\n");
    },
  });

  const hash = crypto.createHash("sha256");
  const hashing = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      cb(null, chunk);
    },
  });

  await pipeline(
    source,
    toJsonl,
    zlib.createGzip({ level: 9 }),
    hashing,
    fs.createWriteStream(file)
  );

  const bytesGzipped = fs.statSync(file).size;
  log.info(
    { table: spec.name, rows, bytesGzipped },
    "Export complete"
  );

  return {
    name: spec.name,
    description: spec.description,
    sensitive: spec.sensitive,
    file: path.basename(file),
    rows,
    bytesGzipped,
    sha256: hash.digest("hex"),
  };
}

/**
 * Uploads one file to S3 under the archive prefix.
 *
 * `PutObject` with a read stream rather than a buffer, so the largest export
 * never has to fit in memory. `ContentLength` is required because a streamed
 * body cannot be sized by the SDK.
 */
async function upload(
  s3: S3Client,
  bucket: string,
  prefix: string,
  filePath: string,
  storageClass: StorageClass
): Promise<void> {
  const key = `${prefix}/${path.basename(filePath)}`;
  const { size } = fs.statSync(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentLength: size,
      ContentType: filePath.endsWith(".gz")
        ? "application/gzip"
        : "application/json",
      StorageClass: storageClass,
      // Encrypt at rest. A KMS key is used when one is configured, so the
      // personal-data export can be gated by key policy rather than only by
      // bucket policy.
      ...(process.env.ARCHIVE_KMS_KEY_ID
        ? {
            ServerSideEncryption: "aws:kms" as const,
            SSEKMSKeyId: process.env.ARCHIVE_KMS_KEY_ID,
          }
        : { ServerSideEncryption: "AES256" as const }),
    })
  );

  log.info({ key, bytes: size, storageClass }, "Uploaded archive object");
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

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve("migration-reports", `studio-archive-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  log.info({ outDir }, "Starting Studio cold archive export");

  const conn = await mysql.createConnection(mysqlConfig);
  const results: ExportResult[] = [];
  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    for (const spec of EXPORTS) {
      results.push(await exportTable(conn, spec, outDir));
    }
  } finally {
    await conn.end();
  }

  const manifest = {
    archiveVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      host: mysqlConfig.host,
      database: mysqlConfig.database,
    },
    purpose:
      "Cold archive of LibreTexts Studio learner data, retained at decommission. ADAPT holds the grading of record; these rows are a by-product.",
    readMe:
      "Each .jsonl.gz holds one JSON object per line. h5p_points and h5p_content_user_data key on Drupal's integer uid, which is only interpretable via users.jsonl.gz.",
    containsPersonalData: results.some((r) => r.sensitive),
    retention:
      "Set deliberately on the bucket prefix. This export does not choose one.",
    exports: results,
  };

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const totalRows = results.reduce((n, r) => n + r.rows, 0);
  const totalBytes = results.reduce((n, r) => n + r.bytesGzipped, 0);
  log.info({ totalRows, totalBytes, outDir }, "Archive written locally");

  const bucket = process.env.ARCHIVE_S3_BUCKET;
  if (!bucket) {
    log.warn(
      { outDir },
      "ARCHIVE_S3_BUCKET not set; archive written locally and NOT uploaded"
    );
    process.stdout.write(
      `\nArchive written to ${outDir}\n` +
        `${totalRows} rows, ${(totalBytes / 1024 / 1024).toFixed(1)} MB gzipped.\n` +
        `Set ARCHIVE_S3_BUCKET to upload.\n`
    );
    return;
  }

  // Deep Archive by default: this is data we are keeping precisely because we
  // do not expect to read it. Retrieval takes hours, which is the right trade
  // for a by-product dataset.
  const storageClass = (process.env.ARCHIVE_S3_STORAGE_CLASS ||
    "DEEP_ARCHIVE") as StorageClass;
  const prefix = `studio-archive/${stamp}`;
  const s3 = new S3Client({ region: process.env.AWS_REGION || "us-west-2" });

  for (const r of results) {
    await upload(s3, bucket, prefix, path.join(outDir, r.file), storageClass);
  }
  // The manifest stays instantly readable, so the archive can be inspected
  // without a Deep Archive restore.
  await upload(s3, bucket, prefix, manifestPath, "STANDARD" as StorageClass);

  process.stdout.write(
    `\nArchive uploaded to s3://${bucket}/${prefix}/\n` +
      `${totalRows} rows, ${(totalBytes / 1024 / 1024).toFixed(1)} MB gzipped.\n` +
      `Local copy: ${outDir}\n`
  );
}

if (process.argv[1] && process.argv[1].includes("StudioArchiveExport")) {
  runMigration().catch((err) => {
    logger.error({ err }, "Studio archive export failed");
    process.exitCode = 1;
  });
}
