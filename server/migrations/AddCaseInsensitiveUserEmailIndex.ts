import mongoose from "mongoose";
import logger from "../logger.js";
import User from "../models/user.js";
import dotenv from "dotenv";
dotenv.config();

const NEW_INDEX_NAME = "email_unique_ci";
const EMAIL_COLLATION = { locale: "en", strength: 2 } as const;

/**
 * Adds a case-insensitive unique index on `users.email` (`email_unique_ci`, collation en/strength 2).
 *
 * Why: the old `unique: true` path option built a case-sensitive index, so "A@x.edu" and
 * "a@x.edu" were two legal documents. The LibreOne lifecycle webhook handlers compare emails
 * case-insensitively, but a read-before-write check can always lose a race — only the index can
 * actually prevent the duplicate. This makes the database agree with the application.
 *
 * The existing case-sensitive `email_1` index is deliberately LEFT IN PLACE. A non-simple
 * collation makes `email_unique_ci` ineligible for ordinary equality queries such as
 * `User.findOne({ email })` in api/auth.ts, so dropping `email_1` would turn every login lookup
 * into a collection scan. It is redundant for uniqueness (the CI index is strictly stricter) but
 * it is what serves those reads.
 *
 * Safe to run BEFORE the matching application deploy: it only adds an index. Note that the new
 * constraint takes effect immediately for already-running instances, so a write that would create
 * a case-variant duplicate starts failing before the code that maps it to a 409 is live.
 *
 * Idempotent, and safe to run repeatedly. If duplicates are found it changes nothing and reports
 * every conflicting group so they can be merged by hand first.
 */
export async function runMigration() {
  try {
    if (!process.env.MONGOOSEURI) {
      throw new Error("MONGOOSEURI environment variable is not set.");
    }

    await mongoose.connect(process.env.MONGOOSEURI);
    logger.info("Connected to MongoDB.");

    const collection = User.collection;

    // 1. Refuse to proceed while case-variant duplicates exist — the index build would fail anyway.
    const duplicates = await collection
      .aggregate([
        { $match: { email: { $type: "string" } } },
        {
          $group: {
            _id: { $toLower: { $trim: { input: "$email" } } },
            count: { $sum: 1 },
            users: { $push: { uuid: "$uuid", email: "$email", centralID: "$centralID" } },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length > 0) {
      for (const group of duplicates) {
        logger.error(
          { normalizedEmail: group._id, count: group.count, users: group.users },
          "Case-variant duplicate emails found — merge these accounts before running this migration"
        );
      }
      logger.error(
        { groups: duplicates.length },
        "Aborting: no index changes made. Resolve the duplicate groups above and re-run."
      );
      return;
    }

    // 2. Create the case-insensitive unique index.
    const existing = await collection.indexes();
    if (existing.some((idx) => idx.name === NEW_INDEX_NAME)) {
      logger.info({ index: NEW_INDEX_NAME }, "Case-insensitive unique email index already exists.");
    } else {
      await collection.createIndex(
        { email: 1 },
        { unique: true, name: NEW_INDEX_NAME, collation: EMAIL_COLLATION }
      );
      logger.info({ index: NEW_INDEX_NAME }, "Created case-insensitive unique email index.");
    }

    // The case-sensitive `email_1` index is intentionally not dropped — see the note above.

    logger.info("Migration complete.");
  } catch (err) {
    logger.error({ err }, "AddCaseInsensitiveUserEmailIndex migration failed");
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/AddCaseInsensitiveUserEmailIndex.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
