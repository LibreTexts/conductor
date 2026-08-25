import logger, { childLogger } from "../../logger.js";
import { PipelineStage } from "mongoose";
import Book from "../../models/book.js";
import SearchService from "./search-service.js";
const bookSearchLog = childLogger("book-search");
/**
 * Commons Books search index ("books").
 *
 * Owns the shape of a book's search document. Both writers go through the
 * definitions here — the full rebuild in `syncBooksInBackground` and the
 * incremental helpers below — so the two can never drift into indexing
 * different fields for the same Book.
 *
 * Keeping the index in sync is a nicety, never a critical path: the incremental
 * helpers (`upsertBookToSearchIndex` / `removeBookFromSearchIndex`) swallow and
 * log every error and MUST be called fire-and-forget so a Meilisearch hiccup can
 * never fail, delay, or throw into a Book write (Shapeshift webhook, delete,
 * etc.).
 *
 * They do, however, wait for the Meilisearch task to finish before returning.
 * Document writes are enqueued asynchronously and report their outcome via task
 * status, not the HTTP response — without waiting, a rejected write would be
 * logged as a success and the catch below would never fire. Waiting costs the
 * caller nothing, because nobody awaits these.
 *
 * The safety net for a write that fails anyway is the admin "Re-sync", which
 * re-upserts every Book and then prunes index documents whose Book is gone
 * (`pruneDeletedBooksFromSearchIndex`). Upserts alone would never remove a
 * stale document, so a dropped delete would otherwise keep an unpublished book
 * searchable forever.
 *
 * That re-sync is also the reason these two writers can collide. Meilisearch has
 * no conditional write — a document write is unconditional last-write-wins — so a
 * re-sync that read its page before an incremental upsert landed will overwrite
 * that upsert with the older payload. There is no per-document version to order
 * them by; `syncBooksInBackground` instead re-reads Mongo for Books touched
 * during its run and re-indexes them, which also covers the case where the two
 * writers are different server instances.
 */

/**
 * Book data for the search index is in the format:
 * {
 *   bookID: string,
 *   ...other Book fields,
 *   projectTags: string[] // array of tag titles associated with the Book's Project
 * }
 *
 * Asset counts are attached separately, after the aggregation — see
 * `attachAssetCounts`.
 */
export const bookSearchIndexAggregationStages: PipelineStage[] = [
  {
    /* A book its library no longer publishes is soft-deleted, not removed, so
       this gate is what keeps it out of the index. Placed here rather than in
       each writer so every path inherits it: the full walk stops re-adding
       missing books, and `buildBookSearchDocuments` returns nothing for one —
       which `upsertBookToSearchIndex` already reads as "delete it". */
    $match: { syncMissingSince: { $exists: false } },
  },
  {
    // Add project data to each book (if any)
    $lookup: {
      from: "projects",
      let: {
        lib: "$library",
        coverID: { $arrayElemAt: [{ $split: ["$bookID", "-"] }, 1] },
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$$lib", "$libreLibrary"] },
                { $eq: ["$$coverID", "$libreCoverID"] },
                { $eq: ["$visibility", "public"] },
              ],
            },
          },
        },
      ],
      as: "project",
    },
  },
  {
    $addFields: {
      project: {
        $arrayElemAt: ["$project", 0],
      },
    },
  },
  // project.tags is a string array of tagID's; we need to load the actual tag.title values
  {
    $lookup: {
      from: "tags",
      localField: "project.tags",
      foreignField: "tagID",
      as: "projectTags",
    },
  },
  {
    $addFields: {
      projectTags: {
        $map: {
          input: "$projectTags",
          as: "tag",
          in: "$$tag.title",
        },
      },
      courseNormalized: {
        $toLower: {
          $trim: {
            input: {
              $ifNull: ["$course", ""],
            },
          },
        },
      },
    },
  },
  {
    // Exclude fields that add no value to search index
    $project: {
      _id: 0,
      __v: 0,
      createdAt: 0,
      updatedAt: 0,
      randomIndex: 0,
      project: 0,
    },
  },
];

export async function getBookAssetCounts(
  ids: string[],
): Promise<
  {
    bookID: string;
    publicAssets: number;
    instructorAssets: number;
  }[]
> {
  return Book.aggregate([
    {
      $match: {
        bookID: { $in: ids },
      },
    },
    {
      $lookup: {
        from: "projects",
        let: {
          bookIdParts: {
            $split: ["$bookID", "-"],
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      "$libreLibrary",
                      {
                        $arrayElemAt: ["$$bookIdParts", 0],
                      },
                    ],
                  },
                  {
                    $eq: [
                      "$libreCoverID",
                      {
                        $arrayElemAt: ["$$bookIdParts", 1],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              projectID: 1,
            },
          },
        ],
        as: "projectDetails",
      },
    },
    {
      $addFields: {
        project: {
          $first: "$projectDetails",
        },
      },
    },
    {
      $match: {
        "project.projectID": {
          $exists: true,
          $ne: "",
        },
      },
    },
    {
      $lookup: {
        from: "projectfiles",
        localField: "project.projectID",
        foreignField: "projectID",
        as: "projectFiles",
      },
    },
    {
      $project: {
        bookID: "$bookID",
        publicAssets: {
          $size: {
            $filter: {
              input: "$projectFiles",
              as: "file",
              cond: {
                $eq: ["$$file.access", "public"],
              },
            },
          },
        },
        instructorAssets: {
          $size: {
            $filter: {
              input: "$projectFiles",
              as: "file",
              cond: {
                $eq: ["$$file.access", "instructors"],
              },
            },
          },
        },
      },
    },
  ]);
}

/**
 * Attaches public/instructor asset counts to already-aggregated book documents.
 *
 * Kept as the single source of truth so the counts stored in the index always
 * match what the v1 booksSearch computes at query time.
 */
export async function attachAssetCounts(books: any[]): Promise<any[]> {
  if (books.length === 0) return books;

  const assetCounts = await getBookAssetCounts(
    books.map((book) => book.bookID),
  );
  const countsByBookID = new Map(assetCounts.map((c) => [c.bookID, c]));
  books.forEach((book) => {
    const found = countsByBookID.get(book.bookID);
    book.publicAssets = found?.publicAssets ?? 0;
    book.instructorAssets = found?.instructorAssets ?? 0;
  });

  return books;
}

/**
 * Builds the search documents for the given bookIDs, ready to hand to
 * Meilisearch. Returns fewer documents than IDs when a book no longer exists.
 */
export async function buildBookSearchDocuments(
  bookIDs: string[],
): Promise<any[]> {
  if (bookIDs.length === 0) return [];

  const books = await Book.aggregate([
    { $match: { bookID: { $in: bookIDs } } },
    ...bookSearchIndexAggregationStages,
  ]);

  return sanitizeForSearchIndex(await attachAssetCounts(books));
}

/**
 * Normalizes aggregation output to plain JSON: Dates (lastSyncedAt,
 * syncMissingSince) become ISO strings and any ObjectId the projection does not
 * exclude becomes its hex string, so Meilisearch document validation cannot
 * choke on a BSON value it does not understand.
 *
 * Applied by every writer, so the full re-sync and the incremental upsert cannot
 * put differently-shaped documents in the index for the same Book.
 */
export function sanitizeForSearchIndex(books: any[]): any[] {
  return JSON.parse(JSON.stringify(books));
}

/**
 * Upserts a single book into the search index. Best-effort: swallows and logs
 * all errors, never throws. MUST be called fire-and-forget (do not await in a
 * request path).
 *
 * If the book no longer exists, it is removed from the index instead — keeping
 * the index from going stale.
 */
export async function upsertBookToSearchIndex(bookID: string): Promise<void> {
  try {
    if (!bookID) return;
    const searchService = await SearchService.getInstance();

    const [doc] = await buildBookSearchDocuments([bookID]);
    if (!doc) {
      // Gone from the DB — make sure it isn't lingering in the index.
      await searchService.deleteDocuments("books", [bookID], {
        waitForCompletion: true,
      });
      return;
    }

    await searchService.addDocuments("books", [doc], {
      waitForCompletion: true,
    });
    bookSearchLog.info(`Upserted ${bookID} to the books index.`);
  } catch (err) {
    bookSearchLog.error({ err }, `Error upserting book ${bookID} to search index`);
  }
}

/**
 * Removes a single book from the search index. Best-effort: swallows and logs
 * all errors, never throws. MUST be called fire-and-forget (do not await in a
 * request path).
 */
export async function removeBookFromSearchIndex(bookID: string): Promise<void> {
  try {
    if (!bookID) return;
    const searchService = await SearchService.getInstance();
    await searchService.deleteDocuments("books", [bookID], {
      waitForCompletion: true,
    });
    bookSearchLog.info(`Removed ${bookID} from the books index.`);
  } catch (err) {
    bookSearchLog.error({ err }, `Error removing book ${bookID} from search index`);
  }
}

/** Books reconciled per pass, matching the batch size the full re-sync writes. */
const RECONCILE_CHUNK_SIZE = 500;

/**
 * Brings the index in line with Mongo for a specific set of books: removes the
 * ones that no longer belong, and (re-)writes the ones that do.
 *
 * The bulk counterpart to {@link upsertBookToSearchIndex}, and it exists for the
 * same reason that one re-reads before it writes. Every caller here arrives with
 * a list decided earlier — books a library walk marked missing, or documents a
 * prune diffed against a Mongo snapshot — and acting on that list blindly is a
 * race: a book restored in the meantime (`syncSingleBook` unsets
 * `syncMissingSince` and upserts) would be deleted right back out of the index
 * by a delete that was decided before the restore happened. The Book would look
 * perfectly healthy in Mongo while being unsearchable.
 *
 * So the set is revalidated immediately before the delete, through
 * `buildBookSearchDocuments` — the same aggregation every writer uses. Asking it
 * rather than re-querying `syncMissingSince` by hand means this can never drift
 * from what the writers consider indexable.
 *
 * Anything that came back is re-added *after* the delete, not merely spared:
 * Meilisearch processes an index's tasks in enqueue order, so delete-then-add
 * leaves the book present. In the ordinary case nothing came back, `docs` is
 * empty, and that half costs nothing.
 *
 * This narrows the window rather than closing it. Meilisearch has no conditional
 * write and no per-document version, so a restore landing between the read here
 * and the delete being enqueued can still be clobbered — closing that would need
 * a lock or a version token neither system offers. The backstop is
 * `syncBooksInBackground`, which re-indexes every live Book: a book lost to the
 * residual race is searchable again after the next re-sync, not gone for good.
 *
 * Throws, so callers can apply their own error contract.
 */
async function reconcileBookIDs(
  bookIDs: string[],
): Promise<{ removed: number; restored: number }> {
  const ids = [...new Set(bookIDs.filter(Boolean))];
  if (ids.length === 0) return { removed: 0, restored: 0 };

  const searchService = await SearchService.getInstance();
  let removed = 0;
  let restored = 0;

  for (let i = 0; i < ids.length; i += RECONCILE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + RECONCILE_CHUNK_SIZE);

    const docs = await buildBookSearchDocuments(chunk);
    const stillIndexable = new Set<string>(docs.map((doc: any) => doc.bookID));
    const toDelete = chunk.filter((id) => !stillIndexable.has(id));

    if (toDelete.length > 0) {
      await searchService.deleteDocuments("books", toDelete, {
        waitForCompletion: true,
      });
      removed += toDelete.length;
    }

    if (docs.length > 0) {
      await searchService.addDocuments("books", docs, {
        waitForCompletion: true,
      });
      restored += docs.length;
    }
  }

  return { removed, restored };
}

/**
 * Fire-and-forget wrapper around {@link reconcileBookIDs}, for callers holding a
 * whole set — a library walk can mark thousands of books missing at once, and a
 * task per book would flood the queue for no gain. Best-effort: swallows and
 * logs all errors, never throws, MUST NOT be awaited in a request path.
 */
export async function reconcileBooksInSearchIndex(
  bookIDs: string[],
): Promise<void> {
  try {
    if (bookIDs.length === 0) return;
    const { removed, restored } = await reconcileBookIDs(bookIDs);
    bookSearchLog.info(`Reconciled ${bookIDs.length} book(s) against the books index: ` +
              `${removed} removed, ${restored} still live and re-indexed.`);
  } catch (err) {
    bookSearchLog.error({ err }, `Error reconciling ${bookIDs.length} book(s) against the search index`);
  }
}

/**
 * Removes index documents whose Book no longer belongs in the index — either
 * deleted from Mongo outright, or soft-deleted by missing-book detection
 * (`syncMissingSince`). The live set matches the gate in
 * `bookSearchIndexAggregationStages`, so the two cannot disagree about what
 * belongs in the index.
 *
 * The full re-sync only upserts, so without this a document dropped by a failed
 * `removeBookFromSearchIndex` (or a Book deleted while Meilisearch was down)
 * would stay searchable indefinitely. Run this at the end of a re-sync, once
 * every live Book has been written.
 *
 * "Written" means the Meilisearch task has *completed*, not merely been enqueued.
 * This reconciles against a read of the index, so a pending upsert would be
 * invisible to it — a Book deleted mid-re-sync would escape the stale set here and
 * then be re-added moments later by the in-flight task, leaving exactly the
 * document this is meant to remove.
 *
 * Unlike the incremental helpers this throws, because the caller
 * (`syncBooksInBackground`) already reports and logs its own failures.
 */
export async function pruneDeletedBooksFromSearchIndex(): Promise<number> {
  const searchService = await SearchService.getInstance();

  const indexedIDs = await searchService.getAllDocumentIds("books");
  if (indexedIDs.length === 0) return 0;

  const liveIDs = new Set<string>(
    (
      await Book.find(
        { syncMissingSince: { $exists: false } },
        { bookID: 1, _id: 0 },
      ).lean()
    ).map((b: any) => b.bookID),
  );

  /* Deleting is the destructive half of this pass. An index with documents and a
     Mongo read that returned nothing is a failed or empty read, not a catalog
     that emptied itself — pruning off the back of that would wipe the index. */
  if (liveIDs.size === 0) {
    bookSearchLog.error(`Refusing to prune ${indexedIDs.length} document(s): Mongo ` +
              `returned no live books. This looks like a failed read, not an empty catalog.`);
    return 0;
  }

  const staleIDs = indexedIDs.filter((id) => !liveIDs.has(id));
  if (staleIDs.length === 0) return 0;

  /* The stale set was decided against a Mongo snapshot taken above, and this pass
     runs at the end of a long re-sync — so hand it to the reconcile, which
     re-reads each book immediately before deleting it. Anything restored since
     that snapshot is re-indexed instead of dropped. */
  const { removed, restored } = await reconcileBookIDs(staleIDs);

  bookSearchLog.info(`Pruned ${removed} deleted or missing book(s) from the books index.`);
  if (restored > 0) {
    bookSearchLog.info(`${restored} book(s) in the stale set were live again by the time ` +
              `the prune reached them, and were re-indexed rather than removed.`);
  }

  return removed;
}
