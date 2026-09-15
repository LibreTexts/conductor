import logger from "../logger.js";
import mongoose from "mongoose";
import GlossaryConfig from "../models/glossaryconfig.js";
import BookService from "../api/services/book-service.js";
import { findBackmatterGlossaryPageId } from "../api/services/glossary-service.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Backfills `glossaryPageId` onto GlossaryConfig documents that don't have
 * one yet.
 *
 * `glossaryPageId` (the book's auto-generated back-matter "Glossary" page)
 * was never sent by the Configure Glossary modal's save action, so every
 * config saved through it — as opposed to the ones auto-created by
 * `ensureDefaultGlossaryConfig` when a book's first term is added — was
 * missing the field. The modal now includes it on every save; this is a
 * one-time pass to repair documents saved before that fix.
 *
 * Idempotent: it only touches documents still missing `glossaryPageId`, and
 * skips (logged) any book whose TOC can't be resolved or has no back-matter
 * Glossary page.
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

    const configs = await GlossaryConfig.find({
      $or: [{ glossaryPageId: { $exists: false } }, { glossaryPageId: "" }],
    }).lean();

    logger.info(
      `Found ${configs.length} glossary config(s) missing glossaryPageId.`,
    );

    let updated = 0;
    let skipped = 0;

    // Sequential to avoid hammering the library with concurrent TOC fetches.
    for (const config of configs) {
      try {
        const toc = await new BookService({
          bookID: `${config.library}-${config.coverID}`,
        }).getBookTOCNew();
        const glossaryPageId = findBackmatterGlossaryPageId(toc);

        if (!glossaryPageId) {
          logger.warn(
            `No back-matter Glossary page found for ${config.library}-${config.coverID}; skipping.`,
          );
          skipped += 1;
          continue;
        }

        await GlossaryConfig.updateOne(
          { _id: config._id },
          { $set: { glossaryPageId } },
        );
        updated += 1;
      } catch (err) {
        logger.warn(
          { err },
          `Error backfilling glossaryPageId for ${config.library}-${config.coverID}`,
        );
        skipped += 1;
      }
    }

    logger.info(
      `Glossary config glossaryPageId backfill complete. Updated: ${updated}, skipped: ${skipped}.`,
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillGlossaryConfigPageId.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
