import logger from "../logger.js";
import mongoose from "mongoose";
import Book from "../models/book.js";
import { normalizeShelfPath } from "../api/services/book-sync-service.js";
// import dotenv from "dotenv";
// dotenv.config();

/** How many updates to send per bulkWrite. */
const BATCH_SIZE = 500;

/**
 * The stored `shelfPath` a Book's live URL implies, or null when the URL is not
 * a library page.
 */
function shelfPathFromURL(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!/\.libretexts\.org$/i.test(parsed.hostname)) return null;
  return normalizeShelfPath(parsed.pathname) || null;
}

/**
 * Backfills `shelfPath` onto Books written before the library sync recorded it.
 *
 * `shelfPath` is the coverpage's library-relative path, and it is what
 * shelf-synced Collections match on. The nightly sync writes it going forward,
 * but a Collection configured against a shelf would stay empty until every book
 * in that shelf happened to be re-synced. The path is recoverable from
 * `links.online`, which every synced Book already carries.
 *
 * The whole pathname is taken, not just the first few segments: a collection may
 * sync from a shelf at any depth, so a truncated path would silently miss books
 * that live below it. `extractCoverPagePath` is deliberately not used here for
 * that reason — it returns only the matched cover-pattern prefix.
 *
 * Idempotent: only touches Books with no `shelfPath`, and skips any Book whose
 * `links.online` is absent or is not a libretexts.org URL (counted and reported
 * — those are picked up by the next real sync).
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

    const books = await Book.find(
      {
        $or: [{ shelfPath: { $exists: false } }, { shelfPath: "" }],
      },
      { bookID: 1, links: 1, _id: 1 },
    ).lean();

    logger.info(`Found ${books.length} book(s) missing shelfPath.`);

    let ops: Parameters<typeof Book.bulkWrite>[0] = [];
    let updated = 0;
    let skipped = 0;

    const flush = async () => {
      if (ops.length === 0) return;
      await Book.bulkWrite(ops, { ordered: false });
      updated += ops.length;
      ops = [];
    };

    for (const book of books as any[]) {
      const shelfPath = shelfPathFromURL(book.links?.online);
      if (!shelfPath) {
        skipped += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: book._id },
          update: { $set: { shelfPath } },
        },
      });

      if (ops.length >= BATCH_SIZE) await flush();
    }

    await flush();

    logger.info(
      { updated, skipped },
      "Book shelfPath backfill complete. Skipped books are filled in by the next library sync.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/BackfillBookShelfPath.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
