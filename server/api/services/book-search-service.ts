import { PipelineStage } from "mongoose";
import Book from "../../models/book.js";
import SearchService from "./search-service.js";
import { debugError, debugServer } from "../../debug.js";

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
    debugServer(`[BookSearchService] Upserted ${bookID} to the books index.`);
  } catch (err) {
    debugError(
      `[BookSearchService] Error upserting book ${bookID} to search index: ${err}`,
    );
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
    debugServer(`[BookSearchService] Removed ${bookID} from the books index.`);
  } catch (err) {
    debugError(
      `[BookSearchService] Error removing book ${bookID} from search index: ${err}`,
    );
  }
}

/**
 * Removes index documents whose Book no longer exists in Mongo.
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
    (await Book.find({}, { bookID: 1, _id: 0 }).lean()).map((b: any) => b.bookID),
  );

  const staleIDs = indexedIDs.filter((id) => !liveIDs.has(id));
  if (staleIDs.length === 0) return 0;

  await searchService.deleteDocuments("books", staleIDs, {
    waitForCompletion: true,
  });
  debugServer(
    `[BookSearchService] Pruned ${staleIDs.length} deleted book(s) from the books index.`,
  );

  return staleIDs.length;
}
