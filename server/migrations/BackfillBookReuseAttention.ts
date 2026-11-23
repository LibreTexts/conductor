import logger from "../logger.js";
import mongoose from "mongoose";
import BookReuseSummary from "../models/bookreusesummary.js";
import { refreshBookAttention } from "../api/services/page-provenance-service.js";
import { mapWithConcurrency } from "../util/concurrency.js";

/** Books per progress line. */
const BATCH = 200;
/** Books refreshed at once; each costs two small aggregations scoped to the book. */
const CONCURRENCY = 8;

/**
 * Backfills `unscannedSources` and `attention` on book reuse summaries written
 * before those fields existed.
 *
 * The library map and the book connection graph now read both off the
 * summaries instead of grouping every page-level reuse edge per request. A
 * summary without them shows no reuse from unscanned libraries and no
 * attention ring until its book is next rebuilt by a scan, so run this once
 * after deploying.
 *
 * Idempotent: recomputes the fields from the edges each time. Only books that
 * already have a summary are touched.
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

    const bookIDs: string[] = await BookReuseSummary.distinct("bookID");
    for (let i = 0; i < bookIDs.length; i += BATCH) {
      await mapWithConcurrency(bookIDs.slice(i, i + BATCH), CONCURRENCY, (bookID) =>
        refreshBookAttention([bookID]),
      );
      logger.info(
        { done: Math.min(i + BATCH, bookIDs.length), total: bookIDs.length },
        "Book reuse attention backfill progress",
      );
    }

    logger.info({ summaries: bookIDs.length }, "Book reuse attention backfill complete.");
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillBookReuseAttention.ts
// runMigration()
//    .then(() => process.exit(0))
//    .catch(() => process.exit(1));
