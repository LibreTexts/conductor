import logger from "../logger.js";
import mongoose from "mongoose";
import Collection from "../models/collection.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Stamps `syncMode: "program"` onto auto-managed Collections created before sync
 * modes existed.
 *
 * Auto-managed Collections used to have exactly one rule: match Books by
 * `program` within `locations`. Keyword and shelf modes made that rule one of
 * three, selected by `syncMode`. The sync treats an absent `syncMode` as
 * "program" so nothing breaks before this runs, but an admin opening such a
 * collection should see the mode it is actually using.
 *
 * Idempotent: only touches documents that have no `syncMode` yet.
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

    const res = await Collection.updateMany(
      { autoManage: true, syncMode: { $exists: false } },
      { $set: { syncMode: "program" } },
    );

    logger.info(
      { matched: res.matchedCount, modified: res.modifiedCount },
      "Collection syncMode backfill complete.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/SetCollectionSyncMode.ts
// runMigration()
//    .then(() => process.exit(0))
//    .catch(() => process.exit(1));
