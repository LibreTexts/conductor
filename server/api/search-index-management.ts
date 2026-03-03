import { Request, Response } from "express";
import SearchService, { INDEXES } from "./services/search-service.js";
import { debugError, debugServer } from "../debug.js";
import { conductor500Err } from "../util/errorutils.js";
import SupportTicketService from "./services/support-ticket-service.js";
import booksAPI from "./books.js";
import projectsAPI from "./projects.js";

/**
 * Gets the status of all Meilisearch indexes including document counts and settings
 */
export async function getIndexStatus(req: Request, res: Response) {
  try {
    const searchService = await SearchService.create();
    const indexStatuses = [];

    for (const indexName of INDEXES) {
      try {
        const index = searchService._client.index(indexName);

        const stats = await index.getStats();

        const [filterableAttrs, sortableAttrs] = await Promise.all([
          index.getFilterableAttributes(),
          index.getSortableAttributes(),
        ]);

        indexStatuses.push({
          name: indexName,
          numberOfDocuments: stats.numberOfDocuments,
          isIndexing: stats.isIndexing,
          fieldDistribution: stats.fieldDistribution,
          filterableAttributes: filterableAttrs,
          sortableAttributes: sortableAttrs,
        });
      } catch (error: any) {
        debugError(`Error fetching status for index ${indexName}: ${error}`);
        indexStatuses.push({
          name: indexName,
          error: error.message || "Failed to fetch index status",
        });
      }
    }

    return res.send({
      err: false,
      indexes: indexStatuses,
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

/**
 * Re-syncs a specific index by fetching data from MongoDB and adding to Meilisearch
 */
export async function resyncIndex(req: Request, res: Response) {
  try {
    const { indexName } = req.body;

    if (!indexName) {
      return res.status(400).send({
        err: true,
        errMsg: "Index name is required",
      });
    }

    if (!INDEXES.includes(indexName as any)) {
      return res.status(400).send({
        err: true,
        errMsg: `Invalid index name. Must be one of: ${INDEXES.join(", ")}`,
      });
    }

    // Return response immediately to avoid timeout
    res.send({
      err: false,
      msg: `Index '${indexName}' re-sync initiated. This process will run in the background.`,
    });

    // Run the actual sync in the background (don't await)
    resyncIndexInBackground(indexName as typeof INDEXES[number]).catch((e) => {
      debugError(`Error in background re-sync for ${indexName}: ${e}`);
    });
  } catch (error) {
    debugError(error);
    if (!res.headersSent) {
      return conductor500Err(res);
    }
  }
}

/**
 * Force re-initializes index settings (filterable and sortable attributes) for a specific index
 */
export async function reinitializeIndexSettings(req: Request, res: Response) {
  try {
    const { indexName } = req.body;

    if (!indexName) {
      return res.status(400).send({
        err: true,
        errMsg: "Index name is required",
      });
    }

    if (!INDEXES.includes(indexName as any)) {
      return res.status(400).send({
        err: true,
        errMsg: `Invalid index name. Must be one of: ${INDEXES.join(", ")}`,
      });
    }

    const searchService = await SearchService.create();

    try {
      await searchService.ensureIndex(indexName as typeof INDEXES[number]);
      return res.send({
        err: false,
        message: `Settings for index '${indexName}' re-initialized successfully`,
      });
    } catch (error: any) {
      debugError(`Error re-initializing index ${indexName}: ${error}`);
      return res.status(500).send({
        err: true,
        errMsg: error.message || "Failed to re-initialize settings",
      });
    }
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

/**
 * INTERNAL: Syncs a specific index in the background
 */
async function resyncIndexInBackground(indexName: typeof INDEXES[number]) {
  try {
    debugServer(`Initiating search index re-synchronization for '${indexName}'...`);
    const searchService = await SearchService.create();

    switch (indexName) {
      case "books":
        await booksAPI.syncBooksInBackground();
        break;
      case "projects":
        await projectsAPI.syncProjectsInBackground();
        break;
      case "supportTickets":
        const ticketService = new SupportTicketService();
        await ticketService.syncWithSearchIndex()
        break;
      default:
        throw new Error(`Unknown index: ${indexName}`);
    }

    debugServer(`Search index re-synchronization for '${indexName}' completed successfully.`);
  } catch (error) {
    debugError(`Error during index re-sync for ${indexName}: ${error}`);
    throw error;
  }
}

export default {
  getIndexStatus,
  resyncIndex,
  reinitializeIndexSettings,
};
