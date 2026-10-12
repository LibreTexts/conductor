import logger from "../logger.js";
import mongoose from "mongoose";
import KBPage from "../models/kbpage.js";
import { addHeadingIds } from "../util/kb-headings.js";
// import dotenv from "dotenv";
// dotenv.config();

/** How many updates to send per bulkWrite. */
const BATCH_SIZE = 200;

/**
 * Stamps `id` attributes onto the headings of Insight articles written before
 * the save path did it.
 *
 * Without this, deep links only work on articles someone has edited since the
 * feature shipped — every older article would quietly have nothing to link to.
 *
 * Idempotent: `addHeadingIds` leaves an existing id alone, so a page already
 * carrying ids produces an identical string and is skipped. Re-running reports
 * zero updates.
 *
 * Deliberately does NOT re-upsert pages into Qdrant. Embeddings are built from
 * the body with its tags stripped, so adding an attribute cannot change them,
 * and re-embedding every article would be a large OpenAI bill for no difference.
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

    const pages = await KBPage.find(
      { body: { $exists: true, $ne: "" } },
      { uuid: 1, slug: 1, body: 1, _id: 1 },
    ).lean();

    logger.info(`Found ${pages.length} Insight page(s) with a body.`);

    let ops: Parameters<typeof KBPage.bulkWrite>[0] = [];
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    const flush = async () => {
      if (ops.length === 0) return;
      await KBPage.bulkWrite(ops, { ordered: false });
      updated += ops.length;
      ops = [];
    };

    for (const page of pages as any[]) {
      let withIds: string;
      try {
        withIds = addHeadingIds(page.body);
      } catch (err) {
        // One unparseable body must not abort the run for every other page.
        failed += 1;
        logger.error({ err, slug: page.slug }, "Could not add heading ids; page left as-is");
        continue;
      }

      if (withIds === page.body) {
        unchanged += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: page._id },
          update: { $set: { body: withIds } },
        },
      });

      if (ops.length >= BATCH_SIZE) await flush();
    }

    await flush();

    logger.info(
      { updated, unchanged, failed },
      "Insight heading id backfill complete.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillKBHeadingIds.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
