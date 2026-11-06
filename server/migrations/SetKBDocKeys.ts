import logger from "../logger.js";
import mongoose from "mongoose";
import KBPage from "../models/kbpage.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Current slug -> doc key for the Insight articles the app linked to by
 * hardcoded URL before doc keys existed.
 */
const DOC_KEYS_BY_SLUG: Record<string, string> = {
  "using-the-books-manager-and-understanding-catalog-matching": "BOOKS_MANAGER",
  "the-remixer": "REMIXER",
  "remixer---load-remixer-state": "REMIXER_LOAD_STATE",
  "ai-co-author-tools": "AI_CO_AUTHOR_TOOLS",
};

/**
 * Sets `docKey` on the Insight articles the app already links to, so their
 * in-app help links keep working once call sites switch to doc keys.
 *
 * Idempotent: a page already carrying its key is skipped. A page whose slug no
 * longer exists is logged and left for staff to key through the editor.
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

    let updated = 0;
    let unchanged = 0;
    let missing = 0;
    let failed = 0;

    for (const [slug, docKey] of Object.entries(DOC_KEYS_BY_SLUG)) {
      try {
        const page = await KBPage.findOne({ slug }, { docKey: 1 }).lean();
        if (!page) {
          missing += 1;
          logger.warn({ slug, docKey }, "No Insight page with this slug; key not set");
          continue;
        }
        if (page.docKey === docKey) {
          unchanged += 1;
          continue;
        }
        await KBPage.updateOne({ _id: page._id }, { $set: { docKey } });
        updated += 1;
      } catch (err) {
        // Most likely the key is already on another page (unique index).
        failed += 1;
        logger.error({ err, slug, docKey }, "Could not set doc key");
      }
    }

    logger.info(
      { updated, unchanged, missing, failed },
      "Insight doc key backfill complete.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/SetKBDocKeys.ts
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
