import logger, { childLogger } from "../../logger.js";
import StoreOrder from "../../models/storeorder.js";
import SearchService from "./search-service.js";
const storeOrderSearchLog = childLogger("store-order-search");
/**
 * Store-order search index ("storeOrders").
 *
 * This index backs the superadmin Store Management table. Unlike the "users" index, it
 * DELIBERATELY contains customer PII (email) and order data, so it MUST NEVER be exposed to
 * the browser or any client-facing Meilisearch key/tenant token. It is queried exclusively
 * server-side through the `checkHasRoleMiddleware("libretexts", "superadmin")`-guarded
 * `/store/admin/orders` endpoint. MongoDB (the StoreOrder collection) is the source of truth;
 * this index is fully regenerable from it via the admin "Re-sync" button.
 *
 * Keeping the index in sync is a nicety, never a critical path: the incremental helpers
 * (`upsertStoreOrderToSearchIndex` / `removeStoreOrderFromSearchIndex`) swallow and log every
 * error and MUST be called fire-and-forget so a Meilisearch hiccup can never fail, delay, or
 * throw into order processing (Stripe webhooks, Lulu webhooks, etc.). `syncStoreOrdersInBackground`
 * rebuilds the index from scratch.
 */

// Pipeline stages shared by the full resync and the single-order upsert. The $project shapes
// the flat index document: only fields the admin table needs, plus a numeric `createdAtTimestamp`
// that Meilisearch can sort/filter on (Meilisearch cannot sort on ISO Date objects).
export const storeOrderSearchIndexAggregationStages: any[] = [
  {
    $project: {
      _id: 0,
      id: 1,
      status: 1,
      customerEmail: 1,
      amountTotal: 1,
      currency: 1,
      luluJobID: 1,
      luluJobStatus: 1,
      supportTicketUUID: 1,
      createdAt: 1,
      // Numeric epoch millis — sortable/filterable in Meilisearch. Falls back to 0 when createdAt
      // is somehow missing so a document never fails to sort.
      createdAtTimestamp: { $toLong: { $ifNull: ["$createdAt", new Date(0)] } },
    },
  },
];

/**
 * Rebuilds the entire storeOrders search index from MongoDB in batches. Used by the admin
 * "Re-sync" control. Throws on failure so the admin endpoint can surface a meaningful error.
 */
export async function syncStoreOrdersInBackground(): Promise<void> {
  try {
    logger.info("Initiating Store Orders search index sync...");
    const searchService = await SearchService.getInstance();

    const batchSize = 500;
    let skip = 0;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      const orders = await StoreOrder.aggregate([
        { $sort: { _id: 1 } },
        ...storeOrderSearchIndexAggregationStages,
        { $skip: skip },
        { $limit: batchSize },
      ]);

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      // Strip ObjectIds/Dates so Meilisearch document validation doesn't choke.
      const sanitized = JSON.parse(JSON.stringify(orders));
      await searchService.addDocuments("storeOrders", sanitized);
      totalSynced += orders.length;
      logger.info(`Synced batch of ${orders.length} store orders (${totalSynced} total)...`);

      skip += batchSize;
      if (orders.length < batchSize) {
        hasMore = false;
      }
    }

    logger.info(`Store Orders search index sync completed. Total synced: ${totalSynced}`);
  } catch (e) {
    logger.error({ err: e }, "Error in syncStoreOrdersInBackground");
    throw e;
  }
}

/**
 * Upserts a single order into the search index. Best-effort: swallows and logs all errors,
 * never throws. MUST be called fire-and-forget (do not await in a request/webhook path).
 *
 * If the order no longer exists, it is removed instead — keeping the index from going stale.
 */
export async function upsertStoreOrderToSearchIndex(id: string): Promise<void> {
  try {
    if (!id) return;
    const searchService = await SearchService.getInstance();

    const results = await StoreOrder.aggregate([
      { $match: { id } },
      ...storeOrderSearchIndexAggregationStages,
    ]);

    const doc = results?.[0];
    if (!doc) {
      // No longer exists — make sure it isn't lingering in the index.
      await searchService.deleteDocuments("storeOrders", [id]);
      return;
    }

    const sanitized = JSON.parse(JSON.stringify(doc));
    await searchService.addDocuments("storeOrders", [sanitized]);
  } catch (err) {
    storeOrderSearchLog.error({ err }, `Error upserting order ${id} to search index`);
  }
}

/**
 * Removes a single order from the search index. Best-effort: swallows and logs all errors,
 * never throws. MUST be called fire-and-forget (do not await in a request/webhook path).
 */
export async function removeStoreOrderFromSearchIndex(id: string): Promise<void> {
  try {
    if (!id) return;
    const searchService = await SearchService.getInstance();
    await searchService.deleteDocuments("storeOrders", [id]);
  } catch (err) {
    storeOrderSearchLog.error({ err }, `Error removing order ${id} from search index`);
  }
}
