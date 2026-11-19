import logger from "../logger.js";
import mongoose from "mongoose";
import User from "../models/user.js";
import SupportTicketMessage from "../models/supporticketmessage.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Backfills `senderIsStaff` on support ticket messages written before it was persisted.
 *
 * `createGeneralMessage` computed the flag but never saved it, so every older message
 * defaulted to `false`. Answer with AI and the closed-ticket vectors label each message
 * "Support" or "Requester" from this flag, so without the backfill every historical
 * reply reads as the requester.
 *
 * Staff means the same roles `_isInternalSupportUser` checks today. shortcut: uses each
 * sender's current roles, not their roles when they sent the message. Fine for labeling.
 *
 * Idempotent: only flips `false` to `true`. Run before POST /support/vector/sync-closed
 * so the backfilled vectors pick up the corrected labels.
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

    const staffUUIDs: string[] = await User.find({
      roles: {
        $elemMatch: {
          org: "libretexts",
          role: { $in: ["superadmin", "support", "harvester"] },
        },
      },
    }).distinct("uuid");

    const res = await SupportTicketMessage.updateMany(
      { senderUUID: { $in: staffUUIDs }, senderIsStaff: { $ne: true } },
      { $set: { senderIsStaff: true } },
    );

    logger.info(
      { staffUsers: staffUUIDs.length, matched: res.matchedCount, modified: res.modifiedCount },
      "Support message senderIsStaff backfill complete.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/SetSupportMessageSenderIsStaff.ts
// runMigration()
//    .then(() => process.exit(0))
//    .catch(() => process.exit(1));
