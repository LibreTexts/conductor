import logger, { childLogger } from "../../logger.js";
import Project from "../../models/project.js";
import SearchService from "./search-service.js";
const projectSearchLog = childLogger("project-search");

/**
 * Projects search index ("projects").
 *
 * Removal side of the index only — the documents themselves are still built by
 * `syncProjectsInBackground` in `api/projects.js`.
 *
 * Keeping the index in sync is a nicety, never a critical path:
 * `removeProjectFromSearchIndex` swallows and logs every error and MUST be
 * called fire-and-forget so a Meilisearch hiccup can never fail, delay, or
 * throw into a Project delete.
 *
 * It does, however, wait for the Meilisearch task to finish before returning.
 * Deletes are enqueued asynchronously and report their outcome via task status,
 * not the HTTP response — without waiting, a rejected delete would be logged as
 * a success and the catch below would never fire. Waiting costs the caller
 * nothing, because nobody awaits it.
 *
 * The safety net for a delete that fails anyway is
 * `pruneDeletedProjectsFromSearchIndex`, run at the end of the full re-sync.
 * That re-sync only ever upserts, so without the prune a dropped delete would
 * keep a deleted project searchable forever.
 */

/**
 * Removes a single project from the search index. Best-effort: swallows and
 * logs all errors, never throws. MUST be called fire-and-forget (do not await
 * in a request path).
 */
export async function removeProjectFromSearchIndex(
  projectID: string,
): Promise<void> {
  try {
    if (!projectID) return;
    const searchService = await SearchService.getInstance();
    await searchService.deleteDocuments("projects", [projectID], {
      waitForCompletion: true,
    });
    projectSearchLog.info(`Removed ${projectID} from the projects index.`);
  } catch (err) {
    projectSearchLog.error({ err }, `Error removing project ${projectID} from search index`);
  }
}

/**
 * Removes index documents whose Project no longer exists in Mongo.
 *
 * The full re-sync only upserts, so without this a document dropped by a failed
 * `removeProjectFromSearchIndex` (or a Project deleted while Meilisearch was
 * down) would stay searchable indefinitely. Run this at the end of a re-sync,
 * once every live Project has been written.
 *
 * "Written" means the Meilisearch task has *completed*, not merely been
 * enqueued. This reconciles against a read of the index, so a pending upsert
 * would be invisible to it — a Project deleted mid-re-sync would escape the
 * stale set here and then be re-added moments later by the in-flight task,
 * leaving exactly the document this is meant to remove.
 *
 * Unlike `removeProjectFromSearchIndex` this throws, because the caller
 * (`syncProjectsInBackground`) already reports and logs its own failures.
 */
export async function pruneDeletedProjectsFromSearchIndex(): Promise<number> {
  const searchService = await SearchService.getInstance();

  const indexedIDs = await searchService.getAllDocumentIds("projects");
  if (indexedIDs.length === 0) return 0;

  const liveIDs = new Set<string>(
    (await Project.find({}, { projectID: 1, _id: 0 }).lean()).map(
      (p: any) => p.projectID,
    ),
  );

  /* Deleting is the destructive half of this pass. An index with documents and
     a Mongo read that returned nothing is a failed or empty read, not a
     database that emptied itself — pruning off the back of that would wipe the
     index. */
  if (liveIDs.size === 0) {
    projectSearchLog.error(`Refusing to prune ${indexedIDs.length} document(s): Mongo ` +
              `returned no live projects. This looks like a failed read, not an empty database.`);
    return 0;
  }

  const staleIDs = indexedIDs.filter((id) => !liveIDs.has(id));
  if (staleIDs.length === 0) return 0;

  await searchService.deleteDocuments("projects", staleIDs, {
    waitForCompletion: true,
  });
  projectSearchLog.info(`Pruned ${staleIDs.length} deleted project(s) from the projects index.`);

  return staleIDs.length;
}
