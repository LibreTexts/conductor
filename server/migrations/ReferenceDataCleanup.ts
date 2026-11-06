import logger from "../logger.js";
import mongoose from "mongoose";
import { Reference, OPTIONAL_REFERENCE_FIELDS } from "../models/reference.js";
import { ReferenceUsage } from "../models/referenceusage.js";
import { ReferencePopulateJob } from "../models/referencepopulatejob.js";
import {
  isValidCitationKey,
  sanitizeReferenceField,
} from "../util/referenceSanitize.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * One-time cleanup of Reference Manager data written before these changes:
 *
 * 1. Renames the misspelled ReferenceUsage fields: `pageRefrences` →
 *    `pageReferences`, and each entry's `refrences` → `references`.
 * 2. Sanitizes every Reference's fields with the same rules new input gets
 *    (plain text, http(s) URLs, well-formed DOIs) and removes the unused
 *    `embeddings` / `embeddingsUpdatedAt` fields. Citation keys that break
 *    the key rule are only reported: pages cite them, so renaming them needs
 *    a person to update those pages too.
 * 3. Marks every still-pending populate job as failed, then builds the new
 *    indexes, including the one-pending-job-per-project rule (which can't be
 *    built while a project has two pending jobs). Run it while no populate
 *    job is in progress, e.g. just before deploying.
 *
 * Idempotent: a second run finds nothing left to change.
 */
export async function runMigration() {
  try {
    if (!process.env.MONGOOSEURI) {
      throw new Error("MONGOOSEURI environment variable is not set.");
    }

    await mongoose.connect(process.env.MONGOOSEURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as mongoose.ConnectOptions);
    logger.info("Connected to MongoDB.");

    // 1. Field renames. The pipeline form rewrites the nested arrays in place.
    // Only where the new field has nothing yet: a scan run after deploying
    // already wrote fresh data there, which the old field must not replace.
    const renamed = await ReferenceUsage.collection.updateMany(
      {
        pageRefrences: { $exists: true },
        "pageReferences.0": { $exists: false },
      },
      [
        {
          $set: {
            pageReferences: {
              $map: {
                input: "$pageRefrences",
                as: "page",
                in: {
                  pageID: "$$page.pageID",
                  references: {
                    $ifNull: ["$$page.refrences", "$$page.references"],
                  },
                },
              },
            },
          },
        },
        { $unset: "pageRefrences" },
      ],
    );
    // Old field left on documents that already had new data.
    await ReferenceUsage.collection.updateMany(
      { pageRefrences: { $exists: true } },
      { $unset: { pageRefrences: "" } },
    );
    logger.info(
      `Renamed citation fields on ${renamed.modifiedCount} reference setting document(s).`,
    );

    // 2. Sanitize stored references.
    let sanitized = 0;
    const invalidKeys: { referenceID: string; citationKey: string }[] = [];
    const cursor = Reference.collection.find({});
    for await (const doc of cursor) {
      const changes: Record<string, string> = {};
      for (const field of OPTIONAL_REFERENCE_FIELDS) {
        const value = doc[field];
        if (typeof value !== "string") continue;
        const cleaned = sanitizeReferenceField(field, value);
        if (cleaned !== value) changes[field] = cleaned;
      }
      if (!isValidCitationKey(String(doc.citationKey ?? ""))) {
        invalidKeys.push({
          referenceID: String(doc.referenceID),
          citationKey: String(doc.citationKey),
        });
      }
      if (Object.keys(changes).length > 0) {
        await Reference.collection.updateOne(
          { _id: doc._id },
          { $set: changes },
        );
        sanitized += 1;
      }
    }
    const strippedEmbeddings = await Reference.collection.updateMany(
      {
        $or: [
          { embeddings: { $exists: true } },
          { embeddingsUpdatedAt: { $exists: true } },
        ],
      },
      { $unset: { embeddings: "", embeddingsUpdatedAt: "" } },
    );
    logger.info(
      `Sanitized ${sanitized} reference(s); removed embeddings from ${strippedEmbeddings.modifiedCount}.`,
    );
    if (invalidKeys.length > 0) {
      logger.warn(
        { invalidKeys },
        `${invalidKeys.length} reference(s) have citation keys outside the key rule. They are left as they are and won't be served to library pages until renamed in the Reference Manager.`,
      );
    }

    // 3. Pending jobs, then indexes.
    const failedJobs = await ReferencePopulateJob.updateMany(
      { status: { $eq: "pending" } },
      {
        $set: { status: "failed" },
        $push: {
          message: "Stopped by a maintenance migration. Run Scan Citations again.",
        },
      },
    );
    logger.info(`Marked ${failedJobs.modifiedCount} pending populate job(s) as failed.`);

    await Promise.all([
      Reference.createIndexes(),
      ReferenceUsage.createIndexes(),
      ReferencePopulateJob.createIndexes(),
    ]);
    logger.info("Reference indexes are up to date.");
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/ReferenceDataCleanup.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
