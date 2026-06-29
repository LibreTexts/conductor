import User from "../../models/user.js";
import SearchService from "./search-service.js";
import { debugError, debugServer } from "../../debug.js";

/**
 * Local-user search index ("users").
 *
 * This index backs in-app user lookup (e.g. adding project team members). It deliberately
 * holds ONLY non-sensitive, already-surfaced fields plus a derived `emailDomain` used to
 * scope results to an organization. Full email, password, roles, and every other field on
 * the User model are intentionally excluded — nothing sensitive is shipped to Meilisearch.
 *
 * Keeping the index in sync is a nicety, never a critical path: the incremental helpers
 * (`upsertUserToSearchIndex` / `removeUserFromSearchIndex`) swallow and log every error and
 * MUST be called fire-and-forget so a Meilisearch hiccup can never fail, delay, or throw
 * into a User write (login, webhook, etc.). The admin "Re-sync" button rebuilds the index
 * from scratch via `syncUsersInBackground`.
 */

// Pipeline stages shared by the full resync and the single-user upsert. The leading $match
// restricts the index to real, non-system users that have a centralID (the same gate the old
// aggregation applied at query time). The $project derives `emailDomain` and exposes only the
// fields the client already receives today — no full email ever enters the index.
export const userSearchIndexAggregationStages: any[] = [
  {
    $match: {
      isSystem: { $ne: true },
      centralID: { $exists: true },
    },
  },
  {
    $project: {
      _id: 0,
      uuid: 1,
      firstName: 1,
      lastName: 1,
      avatar: 1,
      centralID: 1,
      // emailDomain is filterable-only (never returned to clients) and powers the
      // "include users outside of <org>" toggle without storing the full email.
      emailDomain: {
        $let: {
          vars: {
            parts: { $split: [{ $toLower: { $ifNull: ["$email", ""] } }, "@"] },
          },
          in: {
            $cond: [
              { $gt: [{ $size: "$$parts" }, 1] },
              { $arrayElemAt: ["$$parts", 1] },
              "",
            ],
          },
        },
      },
    },
  },
];

/**
 * Rebuilds the entire users search index from MongoDB in batches. Used by the admin
 * "Re-sync" control. Throws on failure so the admin endpoint can surface a meaningful error.
 */
export async function syncUsersInBackground(): Promise<void> {
  try {
    debugServer("Initiating Users search index sync...");
    const searchService = await SearchService.getInstance();

    const batchSize = 500;
    let skip = 0;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      const users = await User.aggregate([
        ...userSearchIndexAggregationStages,
        { $skip: skip },
        { $limit: batchSize },
      ]);

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      // Strip ObjectIds/Dates so Meilisearch document validation doesn't choke.
      const sanitized = JSON.parse(JSON.stringify(users));
      await searchService.addDocuments("users", sanitized);
      totalSynced += users.length;
      debugServer(`Synced batch of ${users.length} users (${totalSynced} total)...`);

      skip += batchSize;
      if (users.length < batchSize) {
        hasMore = false;
      }
    }

    debugServer(`Users search index sync completed. Total synced: ${totalSynced}`);
  } catch (e) {
    debugError(`Error in syncUsersInBackground: ${e}`);
    throw e;
  }
}

/**
 * Upserts a single user into the search index. Best-effort: swallows and logs all errors,
 * never throws. MUST be called fire-and-forget (do not await in a request path).
 *
 * If the user no longer qualifies for the index (became a system account, lost its centralID,
 * or no longer exists), it is removed instead — keeping the index from going stale.
 */
export async function upsertUserToSearchIndex(uuid: string): Promise<void> {
  try {
    if (!uuid) return;
    const searchService = await SearchService.getInstance();

    const results = await User.aggregate([
      { $match: { uuid } },
      ...userSearchIndexAggregationStages,
    ]);

    const doc = results?.[0];
    if (!doc) {
      // Doesn't exist or no longer qualifies — make sure it isn't lingering in the index.
      await searchService.deleteDocuments("users", [uuid]);
      return;
    }

    const sanitized = JSON.parse(JSON.stringify(doc));
    await searchService.addDocuments("users", [sanitized]);
  } catch (err) {
    debugError(`[UserSearchService] Error upserting user ${uuid} to search index: ${err}`);
  }
}

/**
 * Removes a single user from the search index. Best-effort: swallows and logs all errors,
 * never throws. MUST be called fire-and-forget (do not await in a request path).
 */
export async function removeUserFromSearchIndex(uuid: string): Promise<void> {
  try {
    if (!uuid) return;
    const searchService = await SearchService.getInstance();
    await searchService.deleteDocuments("users", [uuid]);
  } catch (err) {
    debugError(`[UserSearchService] Error removing user ${uuid} from search index: ${err}`);
  }
}
