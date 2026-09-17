import logger from "../logger.js";
import mongoose from "mongoose";
import Glossary from "../models/glossary.js";
import GlossaryUsage from "../models/glossaryusage.js";
// import dotenv from "dotenv";
// dotenv.config();

/**
 * Merges duplicate Glossary terms (same text, case-insensitive) and the
 * GlossaryUsage records that ended up pointing at them.
 *
 * `_addGlossaryToDatabase`/`_addGlossaryUsageToDatabase` used to check for an
 * existing term/usage and then create one if none was found — not atomic, so
 * two concurrent adds for the same brand-new term (a duplicate row in an
 * imported CSV/table is the common trigger) could both pass the check and
 * both create, leaving two Glossary rows with different termIDs for one term,
 * and potentially two GlossaryUsage rows for that term in the same book. That
 * path is now a race-safe upsert guarded by unique indexes (see glossary.ts
 * and glossaryusage.ts), but those indexes can't be created while duplicates
 * already exist in the collection — run this first.
 *
 * For each group of same-text Glossary rows, the oldest is kept as the
 * "primary" termID. Any GlossaryUsage already on a duplicate termID is
 * repointed to the primary termID; if that collides with a GlossaryUsage
 * that already exists for (primary termID, coverID, library), the two are
 * merged (pages combined, the duplicate deleted) rather than left to violate
 * the new unique index. The non-primary Glossary rows are deleted last.
 *
 * Idempotent: a re-run finds no duplicate groups (or none left to merge) and
 * does nothing.
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

    const allTerms = await Glossary.find().sort({ _id: 1 }).lean();
    const groups = new Map<string, typeof allTerms>();
    for (const t of allTerms) {
      const key = t.term.trim().toLowerCase();
      const group = groups.get(key) ?? [];
      group.push(t);
      groups.set(key, group);
    }

    let termsMerged = 0;
    let usagesRepointed = 0;
    let usagesCombined = 0;

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      // Oldest (lowest _id, since sorted above) wins as the surviving termID.
      const [primary, ...duplicates] = group;
      const duplicateTermIDs = duplicates.map((d) => d.termID);

      logger.info(
        `Merging ${duplicates.length} duplicate Glossary row(s) for "${primary.term}" onto termID ${primary.termID}.`,
      );

      const dupUsages = await GlossaryUsage.find({
        termID: { $in: duplicateTermIDs },
      });

      for (const dupUsage of dupUsages) {
        const primaryUsage = await GlossaryUsage.findOne({
          termID: primary.termID,
          coverID: dupUsage.coverID,
          library: dupUsage.library,
        });

        if (!primaryUsage) {
          // No collision for this book — just repoint onto the primary termID.
          dupUsage.termID = primary.termID;
          await dupUsage.save();
          usagesRepointed += 1;
          continue;
        }

        // Both a primary-termID and a duplicate-termID usage exist for the
        // same book — this IS the "duplicate glossary entry" case. Merge the
        // duplicate's pages into the surviving usage, then drop the duplicate.
        const existingPageIds = new Set(
          primaryUsage.pages.map((p) => p.pageID),
        );
        const newPages = dupUsage.pages.filter(
          (p) => !existingPageIds.has(p.pageID),
        );
        if (newPages.length > 0) {
          primaryUsage.pages = primaryUsage.pages.concat(newPages);
          primaryUsage.updatedAt = new Date();
          await primaryUsage.save();
        }
        await GlossaryUsage.deleteOne({ _id: dupUsage._id });
        usagesCombined += 1;
      }

      await Glossary.deleteMany({ termID: { $in: duplicateTermIDs } });
      termsMerged += duplicates.length;
    }

    logger.info(
      `Glossary duplicate merge complete. Terms merged: ${termsMerged}, usages repointed: ${usagesRepointed}, usages combined/deleted: ${usagesCombined}.`,
    );
    logger.info(
      "Next step: the unique indexes on Glossary.term and GlossaryUsage(termID, coverID, library) can now be created safely.",
    );
  } catch (err) {
    logger.error({ err }, "Error during migration");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

// Uncomment to run standalone (from server/): npx tsx migrations/MergeDuplicateGlossaryTerms.ts
// Run this BEFORE (re)deploying, since the new unique indexes fail to build
// if duplicates still exist in either collection.
// runMigration()
//   .then(() => process.exit(0))
//   .catch(() => process.exit(1));
