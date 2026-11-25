import logger from "../logger.js";
import mongoose from "mongoose";
import Book from "../models/book.js";
import { BookTOC } from "../models/booktoc.js";
import BookService from "../api/services/book-service.js";
import cxoneGate, { CXOneUnavailableError, runAsBulk } from "../util/CXOne/gate.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Builds and stores the public TOC (`booktocs`) for every book that has none,
 * so readers stop paying a cold CXOne build on first view.
 *
 * Every library shares one CloudFront WAF that counts per source IP. Run this
 * from a host outside prod's egress IP, or it spends the budget prod readers
 * need. Sequential, one book at a time, with a pause between books.
 *
 * Idempotent: books that already have a stored TOC are skipped, so a stopped
 * run resumes where it left off.
 */

const PAUSE_BETWEEN_BOOKS_MS = 500;

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

    const stored = new Set(await BookTOC.distinct("bookID"));
    const bookIDs = (await Book.distinct("bookID")).filter(
      (id: string) => !stored.has(id),
    );
    logger.info({ missing: bookIDs.length, stored: stored.size }, "Starting public TOC backfill");

    let built = 0;
    let failed = 0;

    for (let i = 0; i < bookIDs.length; i++) {
      const bookID = bookIDs[i];
      try {
        // Builds the filtered tree and stores it in booktocs.
        await runAsBulk(() =>
          new BookService({ bookID }).getBookTOCNew({ includeRestricted: false, cache: false }),
        );
        built += 1;
      } catch (err) {
        if (err instanceof CXOneUnavailableError) {
          // Blocked or backed up: wait for the breaker, then retry this book.
          logger.warn({ bookID, retryAfterMs: err.retryAfterMs }, "CXOne unavailable; pausing backfill");
          await cxoneGate.waitUntilClosed(Infinity);
          await new Promise((resolve) => setTimeout(resolve, err.retryAfterMs));
          i--;
          continue;
        }
        logger.warn({ err, bookID }, "Public TOC backfill failed for book");
        failed += 1;
      }
      if ((built + failed) % 100 === 0) {
        logger.info({ built, failed, total: bookIDs.length }, "Public TOC backfill progress");
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_BOOKS_MS));
    }

    logger.info({ built, failed }, "Public TOC backfill complete");
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillPublicTOCs.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
