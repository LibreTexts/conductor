import logger, { childLogger } from "../logger.js";
import { Request, Response, NextFunction } from "express";
import multer, { memoryStorage, MulterError } from "multer";
import fs from "fs-extra";
import AdoptionReport from "../models/adoptionreport.js";
import Book, { BookInterface } from "../models/book.js";
import Collection from "../models/collection.js";
import Organization, { OrganizationInterface } from "../models/organization.js";
import CustomCatalog from "../models/customcatalog.js";
import Project from "../models/project.js";
import PeerReview from "../models/peerreview.js";
import CIDDescriptor from "../models/ciddescriptor.js";
import conductorErrors from "../conductor-errors.js";
import {
  getSubdomainFromUrl,
  isEmptyString,
  isValidDateObject,
  sleep,
  getRandomOffset,
  truncateString,
  getPaginationOffset,
  escapeRegEx,
} from "../util/helpers.js";
import {
  deleteBookFromAPI,
  getLibraryAndPageFromBookID,
  genPermalink,
  checkIsCampusBook,
} from "../util/bookutils.js";
import {
  downloadProjectFiles,
  updateTeamWorkbenchPermissions,
} from "../util/projectutils.js";
import { buildPeerReviewAggregation } from "../util/peerreviewutils.js";
import librariesAPI from "./libraries.js";
import authAPI from "./auth.js";
import projectsAPI from "./projects.js";
import alertsAPI from "./alerts.js";
import collectionsAPI from "./collections.js";
import axios from "axios";
import {
  _generatePageImagesAltTextResObj,
  BookSortOption,
  MasterCatalogV2Response,
  PageFile,
  TableOfContents,
  TableOfContentsDetailed,
} from "../types/Book.js";
import { isBookSortOption } from "../util/typeHelpers.js";
import { resolveCoverPageIdFromUrl } from "./services/cover-page-id-service.js";
import { z } from "zod";
import {
  addPageProperty,
  CXOneFetch,
  generateBookPathAndURL,
  generateChapterOnePath,
  getPageID,
} from "../util/librariesclient.js";
import {
  conductor400Err,
  conductor500Err,
  serializeError,
} from "../util/errorutils.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types/Express.js";
import User from "../models/user.js";
import centralIdentity from "./central-identity.js";
import { PipelineStage, Types } from "mongoose";
import {
  bookTitleAvailabilitySchema,
  createBookSchema,
  deleteBookSchema,
  getCommonsCatalogSchema,
  getMasterCatalogSchema,
  getWithBookIDParamSchema,
  getWithBookIDBodySchema,
  downloadBookFileSchema,
  getWithPageIDParamAndCoverPageIDSchema,
  updatePageDetailsSchema,
  bulkUpdatePageTagsSchema,
  importPressBooksBookSchema,
  getPressbooksImportJobStatusSchema,
  getActivePressbooksImportJobSchema,
  addWithCoverIDParamSchema,
  getWithCoverIDParamSchema,
  deleteWithUsageIDParamSchema,
  getWithPageIDParamAndLibraryParamSchema,
  getWithUsageIDParamSchema,
  addPageWithCoverIDParamSchema,
  readFromCxOneGlossaryAndAddToGlossaryUsageSchema,
} from "./validators/book.js";
import BookService, { BookPageConflictError } from "./services/book-service.js";
import LibrarySyncService, {
  describeLimits,
  getLibrarySyncLimits,
  isLimitedSync,
  LibraryCoverpage,
  LibrarySyncResult,
} from "./services/library-sync-service.js";
import {
  buildBookUpsertOp,
  checkValidImport,
  detectAnimatedThumbnails,
  SyncedBook,
  toBookRecord,
} from "./services/book-sync-service.js";
import type { MongoBulkWriteError } from "mongodb";
import { normalizedSort } from "../util/searchutils.js";
import SearchService from "./services/search-service.js";
import {
  attachAssetCounts,
  bookSearchIndexAggregationStages,
  buildBookSearchDocuments,
  pruneDeletedBooksFromSearchIndex,
  reconcileBooksInSearchIndex,
  removeBookFromSearchIndex,
  sanitizeForSearchIndex,
} from "./services/book-search-service.js";
import { archiveBookInStripe } from "./services/store-book-sync-service.js";
import { PressBookScraper } from "../util/pressbookutils.js";
import PressbooksImportJob from "../models/pressbooksimportjob.js";
import base62 from "base62-random";
import Glossary from "../models/glossary.js";
import GlossaryService from "./services/glossary-service.js";
import GlossaryUsage from "../models/glossaryusage.js";
import { ProjectContext, ProjectError, returnProjectError } from "./services/project-context.js";
const commonsSyncLog = childLogger("commons-sync");


const BOOK_PROJECTION: Partial<Record<keyof BookInterface, number>> = {
  _id: 0,
  __v: 0,
  createdAt: 0,
  updatedAt: 0,
  randomIndex: 0,
  randomSort: 0,
};

/**
 * Accepts an array of Books and the sorting choice and returns the sorted array.
 *
 * @param {object[]} books - The array of Book objects to sort
 * @param {string} [sortChoice] - The sort choice, either 'random', 'author', or 'title' (default).
 * @returns {object[]} The sorted array of Books.
 */
function sortBooks(books: BookInterface[], sortChoice: BookSortOption) {
  if (Array.isArray(books) && sortChoice) {
    if (sortChoice === "random") {
      let shuffleArr = [...books];
      for (let i = shuffleArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleArr[i], shuffleArr[j]] = [shuffleArr[j], shuffleArr[i]];
      }
      return shuffleArr;
    }

    const collator = new Intl.Collator("en-US", {
      numeric: true,
      sensitivity: "base",
      ignorePunctuation: true,
    });
    return books.sort((a, b) => {
      let aKey = "";
      let bKey = "";
      if (sortChoice === "author") {
        aKey = a.author || "";
        bKey = b.author || "";
      } else {
        // default Sort by Title
        aKey = a.title;
        bKey = b.title;
      }
      return collator.compare(aKey, bKey);
    });
  }
  return books;
}

/**
 * Updates system-managed Collections for specified OER programs.
 *
 * @returns {Promise<number|boolean>} The number of collections updated, or
 *  false if error encountered.
 */
const autoGenerateCollections = () => {
  const bookQueries = [];
  const collOps = [];
  let collections = [];
  return Collection.find({ autoManage: true })
    .lean()
    .then((autoColls) => {
      collections = autoColls;
      /* Find books for auto-managed program collections */
      for (let i = 0, n = autoColls.length; i < n; i += 1) {
        const currColl = autoColls[i];
        if (
          typeof currColl.program === "string" &&
          currColl.program.length > 0
        ) {
          bookQueries.push(
            Book.aggregate([
              {
                $match: {
                  program: currColl.program,
                  location: {
                    $in: currColl.locations,
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  bookID: 1,
                  location: 1,
                  program: 1,
                },
              },
            ]),
          );
        }
      }
      return Promise.all(bookQueries);
    })
    .then((bookQueryRes) => {
      /* Sort books into their auto-managed collection */
      let allBooksFound = [];
      for (let i = 0, n = bookQueryRes.length; i < n; i += 1) {
        allBooksFound = [...allBooksFound, ...bookQueryRes[i]];
      }
      for (let i = 0, n = allBooksFound.length; i < n; i += 1) {
        const currBook = allBooksFound[i];
        const collIdx = collections.findIndex(
          (coll) => coll.program === currBook.program,
        );
        if (collIdx > -1) {
          const resourcesById =
            collections[collIdx].resources
              ?.map((item) => {
                if (item.resourceType === "resource") {
                  return item.resourceID;
                }
                return null;
              })
              .filter((i) => !!i) || [];
          if (!Array.isArray(collections[collIdx].newListings)) {
            collections[collIdx].newListings = [];
          }
          if (!resourcesById.includes(currBook.bookID)) {
            collections[collIdx].newListings.push({
              resourceType: "resource",
              resourceID: currBook.bookID,
            });
          }
        }
      }
      /* Assembles updates for collections (if necessary) */
      for (let i = 0, n = collections.length; i < n; i += 1) {
        const currColl = collections[i];
        if (
          Array.isArray(currColl.newListings) &&
          currColl.newListings.length > 0
        ) {
          collOps.push({
            updateOne: {
              filter: {
                collID: currColl.collID,
              },
              update: {
                $addToSet: {
                  resources: {
                    $each: currColl.newListings,
                  },
                },
              },
            },
          });
        }
      }
      if (collOps.length < 1) {
        return {};
      }
      return Collection.bulkWrite(collOps, { ordered: false });
    })
    .then((updateRes) => {
      if (typeof updateRes.nModified === "number") {
        return updateRes.nModified;
      }
      return 0;
    })
    .catch((err) => {
      logger.error({ err }, "autoGenerateCollections failed");
      return false;
    });
};

/**
 * Marks Books that have disappeared from their library.
 *
 * Absence is inferred from `lastSyncedAt`: every Book this run wrote carries the
 * run's start time, so anything older than that was not seen. The alternative —
 * `bookID: { $nin: [...everything the run saw] }` — ships several thousand
 * strings per library in the query document and cannot use an index, where this
 * is a bounded range scan on `{ library, lastSyncedAt }`.
 *
 * Books written before `lastSyncedAt` existed have no value for it at all, so
 * the missing case is matched explicitly; type bracketing means `$lt` alone
 * would skip exactly the stale legacy records this is meant to catch.
 *
 * Only libraries whose walk was exhaustive are passed in — see the `complete`
 * flag on {@link LibrarySyncResult}. A truncated or capped walk returns real
 * books, but its silence about a book means nothing.
 *
 * Returns the bookIDs it marked, so the caller can drop them from the search
 * index without waiting for the next full re-sync.
 *
 * Those ids are read back *after* the write, matched on the exact timestamp this
 * call stamped, rather than read before it. Reading first would report books the
 * write then skipped: a live book re-synced between the two queries gets a fresh
 * `lastSyncedAt` and correctly falls out of the update, but would still be in the
 * pre-read — and the caller would delete a healthy book from the search index.
 */
const markMissingBooks = async (
  subdomains: string[],
  runStartedAt: Date,
): Promise<string[]> => {
  const bookIDs: string[] = [];

  for (const subdomain of subdomains) {
    // Stamped from a captured value, not `new Date()` inline, so the read-back
    // below can identify exactly the documents this update touched.
    const markedAt = new Date();
    const res = await Book.updateMany(
      {
        library: { $eq: subdomain },
        $or: [
          { lastSyncedAt: { $lt: runStartedAt } },
          { lastSyncedAt: { $exists: false } },
        ],
        syncMissingSince: { $exists: false },
      },
      { $set: { syncMissingSince: markedAt } },
    );
    if ((res.modifiedCount ?? 0) === 0) continue;

    const marked = await Book.find(
      { library: { $eq: subdomain }, syncMissingSince: { $eq: markedAt } },
      { bookID: 1, _id: 0 },
    ).lean();
    bookIDs.push(...marked.map((b: any) => b.bookID));
  }

  return bookIDs;
};

/**
 * Walks every synced library and imports the LibreTexts it publishes into the
 * Conductor database for use in Commons.
 *
 * @param signal - Aborting this stops the library walk and prevents the run
 * from writing anything, so an abandoned run cannot race the one that replaces
 * it.
 * @returns {Promise<string>} A human-readable summary of the run.
 */
const runLibrarySync = async (signal?: AbortSignal): Promise<string> => {
  const limits = getLibrarySyncLimits();
  const limited = isLimitedSync(limits);

  /* Captured before the walk starts, so a Book written by this run is never
     older than the cutoff missing-book detection compares against. */
  const runStartedAt = new Date();

  const results = await new LibrarySyncService().syncAllLibraries({ signal });

  /* The walk yields whatever it managed to collect before the abort, which is
     not a picture of the catalog. Bail before any write so an abandoned run
     never competes with its replacement. */
  if (signal?.aborted) {
    throw new Error("Sync with Libraries was abandoned before writing.");
  }

  const succeeded = results.filter(
    (r): r is Extract<LibrarySyncResult, { ok: true }> => r.ok,
  );
  const failed = results.filter(
    (r): r is Extract<LibrarySyncResult, { ok: false }> => !r.ok,
  );

  if (succeeded.length === 0) {
    throw new Error("All libraries failed to sync.");
  }

  /* Map coverpages onto Books, dropping invalid and duplicate entries.

     A library only stays eligible for missing-book detection if its walk was
     exhaustive AND every coverpage it returned mapped to a storable Book. A
     record dropped here is one the library does publish, so leaving it out of
     the run while still treating the run as authoritative would flag a live
     book as gone. */
  const byBookID = new Map<string, SyncedBook>();
  const completeLibraries: string[] = [];
  for (const { subdomain, complete, coverpages } of succeeded) {
    let dropped = 0;
    for (const coverpage of coverpages) {
      const book = toBookRecord(subdomain, coverpage);
      if (!checkValidImport(book)) {
        dropped += 1;
        continue;
      }
      if (byBookID.has(book.bookID)) continue;
      byBookID.set(book.bookID, book);
    }

    if (!complete || dropped > 0 || coverpages.length === 0) {
      commonsSyncLog.info(`Skipping missing-book detection for ${subdomain}: ` +
                  (coverpages.length === 0
                    ? "sync returned no books."
                    : !complete
                      ? "the coverpage search was incomplete."
                      : `${dropped} coverpage(s) could not be mapped to a Book.`));
      continue;
    }
    completeLibraries.push(subdomain);
  }
  const processedBooks = [...byBookID.values()];

  /* Load what's already stored, for thumbnail reuse and project detection */
  const [existingBooks, existingProjects] = await Promise.all([
    Book.aggregate([
      { $project: { _id: 0, bookID: 1, thumbnail: 1, thumbnailIsAnimated: 1 } },
    ]),
    Project.aggregate([
      {
        $match: {
          $and: [
            { libreLibrary: { $ne: null } },
            { libreCoverID: { $ne: null } },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          projectID: 1,
          projectURL: 1,
          libreLibrary: 1,
          libreCoverID: 1,
        },
      },
    ]),
  ]);

  await detectAnimatedThumbnails(
    processedBooks,
    new Map(existingBooks.map((b) => [b.bookID, b])),
  );

  /* Assemble upserts and detect Books without a tracking Project */
  const projectsToCreate: {
    title: string;
    library: string;
    coverID: string;
    url?: string;
    author?: string;
  }[] = [];
  // Indexed rather than scanned: both sides run to several thousand entries,
  // and a linear lookup per book made this quadratic.
  const projectKeys = new Set(
    existingProjects.map((p) => `${p.libreLibrary}-${p.libreCoverID}`),
  );
  const bookOps = processedBooks.map((book) => {
    const [bookLib, bookCoverID] = getLibraryAndPageFromBookID(book.bookID);
    if (typeof bookLib === "string" && typeof bookCoverID === "string") {
      if (!projectKeys.has(`${bookLib}-${bookCoverID}`)) {
        projectsToCreate.push({
          title: book.title,
          library: bookLib,
          coverID: bookCoverID,
          url: book.links?.online,
          author: book.author,
        });
      }
    }

    // Stamped with the run's start time so missing-book detection can find
    // everything this run did not touch with a range query.
    return buildBookUpsertOp(book, runStartedAt);
  });

  /* Write Books */
  let importCount = 0;
  const newBookDBIds: object[] = [];
  /* A book whose upsert failed keeps its previous `lastSyncedAt`, which is
     exactly what missing-book detection reads as "the library dropped it". Any
     library with a failed write is therefore out of the running below. */
  const librariesWithFailedWrites = new Set<string>();
  try {
    const writeRes = await Book.bulkWrite(bookOps, { ordered: false });
    importCount = (writeRes.matchedCount ?? 0) + (writeRes.upsertedCount ?? 0);
    newBookDBIds.push(...Object.values(writeRes.upsertedIds ?? {}));
  } catch (writeErr) {
    logger.error({ err: writeErr }, "runLibrarySync failed");
    /* An unordered bulkWrite reports per-operation failures by throwing once at
       the end, with the successful writes still applied and summarized on
       `error.result`. Salvage those rather than discarding a whole run over a
       handful of bad records. */
    const partial = (writeErr as MongoBulkWriteError)?.result;

    /* Attribute each failed operation back to its library. The driver reports
       an unordered batch's errors against the caller's operation index, and
       `bookOps` is built in `processedBooks` order, so the index identifies the
       book. Anything that cannot be attributed makes every library suspect —
       skipping detection costs a cycle, a false "missing" edits the catalog. */
    const rawWriteErrors = (writeErr as MongoBulkWriteError)?.writeErrors;
    const writeErrors = Array.isArray(rawWriteErrors)
      ? rawWriteErrors
      : rawWriteErrors
        ? [rawWriteErrors]
        : [];
    let attributed = 0;
    for (const opErr of writeErrors) {
      const index = opErr?.index ?? opErr?.err?.index;
      const book =
        typeof index === "number" ? processedBooks[index] : undefined;
      if (book?.library) {
        librariesWithFailedWrites.add(book.library);
        attributed += 1;
      }
    }
    if (attributed < writeErrors.length || writeErrors.length === 0) {
      completeLibraries.forEach((lib) => librariesWithFailedWrites.add(lib));
    }

    const recovered =
      (partial?.matchedCount ?? 0) + (partial?.upsertedCount ?? 0);
    if (recovered > 0) {
      importCount = recovered;
      newBookDBIds.push(...Object.values(partial?.upsertedIds ?? {}));
      commonsSyncLog.info(`Wrote only ${importCount} books when ${processedBooks.length} were expected.`);
    } else {
      // Nothing landed — the write failed outright.
      throw new Error("Failed to write any books to the database.", {
        cause: writeErr,
      });
    }
  }

  /* Absence only means "gone from the library" when the run looked everywhere.
     Under a limit it means "not looked for", so marking would flag thousands of
     healthy books. */
  const detectableLibraries = completeLibraries.filter(
    (lib) => !librariesWithFailedWrites.has(lib),
  );
  const markedIDs = limited
    ? []
    : await markMissingBooks(detectableLibraries, runStartedAt);
  const markedMissing = markedIDs.length;

  /* Pull the newly-missing books out of the search index now rather than leaving
     them searchable until the next re-sync. Reconciled rather than deleted
     outright: this run keeps working for a while yet, and a book restored in the
     meantime must not be deleted by a decision made before the restore. The
     helper re-reads each book immediately before removing it.

     Fire-and-forget, and it swallows its own errors: index upkeep must never
     sink a sync run, and the prune at the end of `syncBooksInBackground` catches
     anything dropped here. */
  void reconcileBooksInSearchIndex(markedIDs);

  if (limited) {
    commonsSyncLog.info("Limited sync — skipping missing-book detection.");
  } else if (detectableLibraries.length < completeLibraries.length) {
    commonsSyncLog.info(`Skipping missing-book detection for ${completeLibraries
              .filter((lib) => librariesWithFailedWrites.has(lib))
              .join(", ")}: some books could not be written this run.`);
  }

  /* Downstream jobs — each reports its own failure without sinking the sync */
  const updatedCollections = await autoGenerateCollections();
  const didGenExports = (await generateKBExport()) === true;

  let generatedProjects: number | boolean = 0;
  if (projectsToCreate.length > 0) {
    generatedProjects = await projectsAPI.autoGenerateProjects(projectsToCreate);
  } else {
    commonsSyncLog.info("No new projects to create.");
  }

  if (newBookDBIds.length > 0) {
    await alertsAPI.processInstantBookAlerts(newBookDBIds);
  }

  /* Summarize */
  let msg = `Imported ${importCount} books from the Libraries.`;
  if (failed.length > 0) {
    msg += ` FAILED to sync ${failed.length} librar${
      failed.length === 1 ? "y" : "ies"
    }: ${failed.map((f) => `${f.subdomain} (${f.error})`).join("; ")}.`;
  }
  if (limited) {
    msg = `LIMITED SYNC (${describeLimits(limits)}) — not a full catalog. ${msg}`;
  }
  if (markedMissing > 0) {
    msg += ` ${markedMissing} books no longer found in their library were marked missing.`;
  }
  if (typeof updatedCollections === "number") {
    msg += ` ${updatedCollections} system-managed Collections updated.`;
  } else {
    msg += ` FAILED to update system-managed collections. Check server logs.`;
  }
  if (didGenExports) {
    msg += ` Successfully generated export files for 3rd-party content services.`;
  } else {
    msg += ` FAILED to generate export files for 3rd-party content services. Check server logs.`;
  }
  if (typeof generatedProjects === "number") {
    msg += ` ${generatedProjects} new Projects were autogenerated.`;
  } else {
    msg += ` FAILED to autogenerate new Projects. Check server logs.`;
  }

  commonsSyncLog.info(msg);
  return msg;
};

/**
 * Guards against overlapping runs. The sync takes tens of minutes, so a
 * scheduled trigger can easily arrive while the previous one is still working.
 */
let librarySyncRunning = false;

/**
 * How long a sync may run before it is treated as dead.
 *
 * The library requests carry no timeout of their own, so a socket that never
 * settles leaves the run pending forever — and with it {@link librarySyncRunning},
 * which would reject every later trigger until the process restarts. A full
 * catalog walk lands well inside an hour, so anything past that is stuck rather
 * than slow. Reaching the ceiling aborts the run rather than merely ignoring
 * it; see {@link withSyncTimeout}.
 */
const LIBRARY_SYNC_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Rejects if `work` has not settled within {@link LIBRARY_SYNC_TIMEOUT_MS},
 * aborting `controller` on the way out.
 *
 * The abort is what makes the ceiling safe: the run stops at its next throttled
 * request and never reaches its writes, so it cannot compete with the run that
 * replaces it. The overlap guard is released by the run itself once it settles,
 * not here — a job that ignores the abort still holds the lock, which is the
 * conservative failure.
 */
const withSyncTimeout = async <T>(
  work: Promise<T>,
  controller: AbortController,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              `Sync with Libraries exceeded its ${
                LIBRARY_SYNC_TIMEOUT_MS / 60000
              }-minute ceiling and was abandoned. It has been signalled to ` +
                `stop and will not write; the next trigger is accepted once ` +
                `it unwinds.`,
            ),
          );
        }, LIBRARY_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Starts the Sync with Libraries job.
 *
 * The job makes one throttled request per book to read its overview property,
 * which puts the runtime well past any proxy's connection timeout. The request
 * is acknowledged immediately and the job runs detached; its outcome is
 * reported through the Commons sync log.
 *
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const syncWithLibraries = async (_req: Request, res: Response) => {
  if (librarySyncRunning) {
    return res.status(409).send({
      err: true,
      errMsg: "A sync with the Libraries is already in progress.",
    });
  }

  librarySyncRunning = true;
  commonsSyncLog.info("Starting sync with Libraries.");

  const controller = new AbortController();
  const work = runLibrarySync(controller.signal);

  /* The lock follows the job, not the timeout. Releasing it when the ceiling
     fires would let the next trigger start while the abandoned run is still
     unwinding, and two runs writing the catalog is the failure this guard
     exists to prevent. */
  void work
    .then((msg) => {
      if (controller.signal.aborted) {
        commonsSyncLog.info(`Abandoned sync with Libraries settled: ${msg}`);
      }
    })
    .catch((err) => {
      if (controller.signal.aborted) {
        logger.error({ err }, "syncWithLibraries failed");
        commonsSyncLog.info(`Abandoned sync with Libraries has unwound: ${err.message}`);
      }
    })
    .finally(() => {
      librarySyncRunning = false;
    });

  withSyncTimeout(work, controller).catch((err) => {
    logger.error({ err }, "syncWithLibraries failed");
    commonsSyncLog.info(err.message === "bulkwrite"
              ? "Sync with Libraries failed: no books could be written."
              : `Sync with Libraries failed: ${err.message}`);
  });

  return res.status(202).send({
    err: false,
    msg: "Sync with Libraries started. Progress is reported in the server logs.",
  });
};

/**
 * Runs the Sync with Libraries job via on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const runAutomatedSyncWithLibraries = (req: Request, res: Response) => {
  logger.info(`Received automated request to sync Commons with Libraries ${new Date().toLocaleString()}`);
  return syncWithLibraries(req, res);
};

/**
 * Accepts a standard Organization-model object and generates an array of strings of all
 * known variations of the Organization's name, including full, short, abbreviation, and
 * possible aliases.
 * INTERNAL USE ONLY.
 * @param {Object} orgData - An Organization information object.
 * @returns {String[]} An array of known Organization names.
 */
export const buildOrganizationNamesList = (
  orgData: OrganizationInterface,
): string[] => {
  if (!orgData) return [];

  const names = new Set<string>();

  // Collect base names
  const fields = ["name", "shortName", "abbreviation"] as const;
  fields.forEach((field) => {
    const value = orgData[field];
    if (value && !isEmptyString(value)) {
      names.add(value);
    }
  });

  // Add aliases
  if (Array.isArray(orgData.aliases) && orgData.aliases.length > 0) {
    orgData.aliases.forEach((alias) => names.add(alias));
  }

  // Generate normalized variations
  const normalizedVariations = Array.from(names).flatMap((name) => {
    const normalized = String(name).replace(/[,\-:']/g, "");
    return [normalized, normalized.toLowerCase()];
  });

  normalizedVariations.forEach((variant) => names.add(variant));

  return Array.from(names);
};

/**
 * Returns a randomized, paginated selection of books from the Commons Catalog,
 * scoped to the current Organization. Generates a random seed if one is not provided
 * that can be used for subsequent queries.
 *
 * @param {z.infer<typeof getCommonsCatalogSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
async function getCommonsCatalog(
  req: z.input<typeof getCommonsCatalogSchema>,
  res: Response,
) {
  try {
    const orgID = process.env.ORG_ID;
    const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 10;
    const seed = req.query.seed
      ? parseInt(req.query.seed.toString())
      : Math.floor(Math.random() * 1000000);

    const paginationOffset = getPaginationOffset(
      (req.query.activePage as number) || 1,
      limit,
    );

    if (isNaN(seed) || seed < 1) {
      return conductor400Err(res);
    }

    const books: Array<BookInterface & { randomSort: number }> = [];
    let numTotal = 0;

    if (orgID !== "libretexts") {
      const [orgData, customCatalog] = await Promise.all([
        Organization.findOne(
          { orgID },
          {
            _id: 0,
            orgID: 1,
            name: 1,
            shortName: 1,
            abbreviation: 1,
            aliases: 1,
            autoCatalogMatchingDisabled: 1,
          },
        ).lean(),
        CustomCatalog.findOne(
          { orgID },
          { _id: 0, orgID: 1, resources: 1, automaticMatchingExclusions: 1 },
        ).lean(),
      ]);
      if (!orgData || Object.keys(orgData).length === 0) {
        throw new Error("Failed to retrieve Organization data");
      }

      const campusNames = buildOrganizationNamesList(orgData).map((name) =>
        name.toLowerCase(),
      );
      const matchObject = {
        $and: [
          {
            $or: [
              { bookID: { $in: customCatalog?.resources || [] } },
              ...(orgData.autoCatalogMatchingDisabled
                ? []
                : [
                  {
                    $expr: {
                      $in: [{ $toLower: "$course" }, campusNames],
                    },
                  },
                ]),
            ],
          },
          // automatic matching exclusions only applied if autoCatalogMatchingDisabled is false
          ...(orgData.autoCatalogMatchingDisabled
            ? []
            : [
              {
                bookID: {
                  $nin: customCatalog?.automaticMatchingExclusions || [],
                },
              },
            ]),
          { randomIndex: { $ne: null } },
        ],
      };

      const campusBookPromise = await Book.aggregate([
        {
          $match: matchObject,
        },
        {
          $addFields: {
            randomSort: {
              $mod: [
                {
                  $multiply: [
                    { $add: ["$randomIndex", seed / 1000000] },
                    1000000,
                  ],
                },
                1000000,
              ],
            },
            autoMatched: {
              $cond: [
                { $in: ["$bookID", customCatalog?.resources || []] },
                false,
                true,
              ],
            },
          },
        },
        { $sort: { randomSort: 1 } },
        { $skip: paginationOffset },
        { $limit: limit },
        {
          $project: BOOK_PROJECTION,
        },
      ]);

      const totalCountPromise = Book.countDocuments(matchObject);
      const [campusBooks, totalCount] = await Promise.all([
        campusBookPromise,
        totalCountPromise,
      ]);

      books.push(...campusBooks);
      numTotal = totalCount;
    } else {
      const allBookPromise = Book.aggregate([
        {
          $match: { randomIndex: { $ne: null } },
        },
        {
          $addFields: {
            randomSort: {
              $mod: [
                {
                  $multiply: [
                    { $add: ["$randomIndex", seed / 1000000] }, // Normalize seed
                    1000000,
                  ],
                },
                1000000,
              ],
            },
          },
        },
        { $sort: { randomSort: 1 } },
        { $skip: paginationOffset },
        { $limit: limit },
        {
          $project: BOOK_PROJECTION,
        },
      ]);

      const totalCountPromise = Book.countDocuments({
        randomIndex: { $ne: null },
      });
      const [allBooks, totalCount] = await Promise.all([
        allBookPromise,
        totalCountPromise,
      ]);

      books.push(...allBooks);
      numTotal = totalCount;
    }

    // Attach the public/instructor asset counts of the associated project, via the
    // same helper the search index uses, so both report identical numbers.
    await attachAssetCounts(books);

    return res.send({
      err: false,
      numTotal,
      books,
      seed,
    });
  } catch (e) {
    logger.error({ err: e }, "getCommonsCatalog failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Returns the master list of Commons Catalog
 * items with limited filtering and sorting.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getMasterCatalog'
 */
const getMasterCatalog = (
  req: z.infer<typeof getMasterCatalogSchema>,
  res: Response,
) => {
  var sortedBooks: BookInterface[] = [];
  var orgData = {};
  var sortChoice: BookSortOption = "title"; // default to Sort by Title
  var matchObj = {};
  if (
    req.query.sort &&
    !isEmptyString(req.query.sort) &&
    isBookSortOption(req.query.sort)
  ) {
    sortChoice = req.query.sort;
  }
  if (req.query.search && !isEmptyString(req.query.search)) {
    matchObj["$text"] = {
      $search: req.query.search,
    };
  }
  Book.aggregate([
    {
      $match: matchObj,
    },
    {
      $project: {
        _id: 0,
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  ])
    .then((books) => {
      sortedBooks = sortBooks(books, sortChoice);
      if (process.env.ORG_ID !== "libretexts") {
        return Organization.findOne({
          orgID: process.env.ORG_ID,
        });
      } else {
        return {}; // LibreCommons — don't need to lookup Organization
      }
    })
    .then((orgDataRes) => {
      if (Object.keys(orgDataRes).length > 0) {
        orgData = orgDataRes;
      }
      if (process.env.ORG_ID !== "libretexts") {
        return CustomCatalog.findOne(
          {
            orgID: process.env.ORG_ID,
          },
          {
            _id: 0,
            orgID: 1,
            resources: 1,
          },
        );
      } else {
        return {}; // LibreCommons — don't need to lookup Custom Catalog
      }
    })
    .then((customCatalogRes) => {
      // Check if book has been enabled via Custom Catalog
      if (
        customCatalogRes !== null &&
        Object.keys(customCatalogRes).length > 0
      ) {
        if (
          customCatalogRes.resources &&
          Array.isArray(customCatalogRes.resources)
        ) {
          sortedBooks.forEach((book) => {
            if (customCatalogRes.resources.includes(book.bookID)) {
              book.isCustomEnabled = true;
            }
          });
        }
      }
      // Check if book originated from the Organization
      if (Object.keys(orgData).length > 0) {
        const campusNames = buildOrganizationNamesList(orgData);
        sortedBooks.forEach((book) => {
          const isCampusBook = checkIsCampusBook(book, campusNames);
          if (isCampusBook) book.isCampusBook = true;
        });
      }
      return res.send({
        err: false,
        books: sortedBooks,
      });
    })
    .catch((err) => {
      logger.error({ err }, "getMasterCatalog failed");
      return res.send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

async function getMasterCatalogV2(_req: Request, res: Response) {
  try {
    const libraries = await Book.aggregate([
      {
        $group: {
          _id: {
            library: "$library",
            groupBy: {
              $cond: [
                {
                  $and: [{ $ne: ["$course", null] }, { $ne: ["$course", ""] }],
                },
                "$course",
                "$subject",
              ],
            },
            type: {
              $cond: [
                {
                  $and: [{ $ne: ["$course", null] }, { $ne: ["$course", ""] }],
                },
                "course",
                "subject",
              ],
            },
          },
          books: { $push: "$$ROOT" },
        },
      },
      {
        $group: {
          _id: "$_id.library",
          courses: {
            $push: {
              $cond: [
                { $eq: ["$_id.type", "course"] },
                {
                  course: "$_id.groupBy",
                  books: "$books",
                },
                "$$REMOVE",
              ],
            },
          },
          subjects: {
            $push: {
              $cond: [
                { $eq: ["$_id.type", "subject"] },
                {
                  subject: "$_id.groupBy",
                  books: "$books",
                },
                "$$REMOVE",
              ],
            },
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
      {
        $project: {
          _id: 0,
          library: "$_id",
          courses: 1,
          subjects: 1,
        },
      },
    ]);

    // We can't sort by parallel arrays in the aggregation, so we need to do it here
    (libraries as MasterCatalogV2Response["libraries"]).forEach((lib) => {
      // First sort the course and subject groups
      lib.courses = lib.courses.sort((a, b) =>
        normalizedSort(a.course, b.course),
      );
      lib.subjects = lib.subjects.sort((a, b) =>
        normalizedSort(a.subject, b.subject),
      );

      // Then sort the books within each group
      lib.courses.forEach((courseGroup) => {
        courseGroup.books = courseGroup.books.sort((a, b) =>
          normalizedSort(a.title, b.title),
        );
      });

      lib.subjects.forEach((subjectGroup) => {
        subjectGroup.books = subjectGroup.books.sort((a, b) =>
          normalizedSort(a.title, b.title),
        );
      });
    });

    return res.send({
      err: false,
      libraries,
    });
  } catch (error) {
    logger.error({ err: error }, "getMasterCatalogV2 failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Returns the current options for dynamic filters in Commons Catalog(s).
 *
 * @param {express.Request} _req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getCatalogFilterOptions(_req: Request, res: Response) {
  try {
    const orgID = process.env.ORG_ID;
    const uniqueAuthors = new Set();
    const uniqueSubjects = new Set();
    const uniqueAffiliations = new Set();
    const uniqueCourses = new Set();
    const uniquePrograms = new Set();
    let matchObj = {};

    if (orgID !== "libretexts") {
      const [orgData, customCatalog] = await Promise.all([
        Organization.findOne(
          { orgID },
          {
            _id: 0,
            orgID: 1,
            name: 1,
            shortName: 1,
            abbreviation: 1,
            aliases: 1,
          },
        ).lean(),
        CustomCatalog.findOne(
          { orgID },
          {
            _id: 0,
            orgID: 1,
            resources: 1,
          },
        ).lean(),
      ]);
      const campusNames = buildOrganizationNamesList(orgData);
      if (
        customCatalog &&
        Array.isArray(customCatalog.resources) &&
        customCatalog.resources.length > 0
      ) {
        matchObj["$or"] = [
          { bookID: { $in: customCatalog.resources } },
          { course: { $in: campusNames } },
          { program: { $in: campusNames } },
        ];
      } else {
        matchObj["$or"] = [
          { course: { $in: campusNames } },
          { program: { $in: campusNames } },
        ];
      }
    }

    const [foundBooks, cidResults] = await Promise.all([
      Book.aggregate([
        {
          $match: matchObj,
        },
        {
          $project: {
            _id: 0,
            author: 1,
            subject: 1,
            affiliation: 1,
            course: 1,
            program: 1,
          },
        },
      ]),
      CIDDescriptor.aggregate([
        {
          $sort: {
            descriptor: 1,
          },
        },
        {
          $project: {
            _id: 0,
            __v: 0,
            createdAt: 0,
            updatedAt: 0,
            title: 0,
            description: 0,
            approved: 0,
            expires: 0,
          },
        },
      ]),
    ]);

    foundBooks.forEach((book) => {
      if (book.author && !isEmptyString(book.author)) {
        uniqueAuthors.add(book.author);
      }
      if (book.subject && !isEmptyString(book.subject)) {
        uniqueSubjects.add(book.subject);
      }
      if (book.affiliation && !isEmptyString(book.affiliation)) {
        uniqueAffiliations.add(book.affiliation);
      }
      if (book.course && !isEmptyString(book.course)) {
        uniqueCourses.add(book.course);
      }
      if (book.program && !isEmptyString(book.program)) {
        uniquePrograms.add(book.program);
      }
    });

    const authors = Array.from(uniqueAuthors).sort(normalizedSort);
    const subjects = Array.from(uniqueSubjects).sort(normalizedSort);
    const affiliations = Array.from(uniqueAffiliations).sort(normalizedSort);
    const courses = Array.from(uniqueCourses).sort(normalizedSort);
    const programs = Array.from(uniquePrograms).sort(normalizedSort);
    const cids = cidResults
      .map((item) => item.descriptor)
      .filter((item) => item !== undefined);

    return res.send({
      authors,
      subjects,
      affiliations,
      courses,
      programs,
      cids,
      err: false,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Machine-readable reasons a book operation could not proceed.
 *
 * The client branches on these rather than on `errMsg`, so a recoverable problem
 * (a title that's already taken) can be shown inline on the offending field
 * instead of being funneled into the generic error modal.
 */
type BookErrorCode =
  | "bad_library"
  | "already_linked"
  | "no_library_access"
  | "title_conflict";

const ALREADY_LINKED_MSG =
  "This project is already linked to a book. A project can only have one book.";

function createBookErr(
  res: Response,
  status: number,
  code: BookErrorCode,
  errMsg: string,
) {
  return res.status(status).send({ err: true, code, errMsg });
}

/**
 * Resolves a Central Identity application ID to its library subdomain.
 *
 * @returns The subdomain, or `null` if the application is unknown or has no
 * resolvable subdomain.
 */
async function resolveLibrarySubdomain(
  libraryAppID: number,
): Promise<string | null> {
  const libraryApp = await centralIdentity.getApplicationById(libraryAppID);
  if (!libraryApp) return null;
  return getSubdomainFromUrl(libraryApp.main_url) || null;
}

/**
 * Reports whether a book title is still available on the given library.
 *
 * Backs the live check in the Create Book modal so a user finds out about a
 * duplicate title while they can still edit the field, rather than after
 * submitting. Advisory only: `createBook` re-checks and is the authority.
 *
 * `available: null` means the library could not be checked. Treat that as
 * "proceed" — a library hiccup must not block book creation.
 *
 * @param {express.Request} req - Incoming request.
 * @param {express.Response} res - Outgoing response.
 */
async function checkBookTitleAvailability(
  req: ZodReqWithUser<z.infer<typeof bookTitleAvailabilitySchema>>,
  res: Response,
) {
  try {
    const { library, title } = req.query;

    const subdomain = await resolveLibrarySubdomain(library);
    if (!subdomain) {
      return createBookErr(res, 404, "bad_library", conductorErrors.err11);
    }

    const [bookPath, bookURL] = generateBookPathAndURL(subdomain, title);

    let available: boolean | null;
    try {
      available = !(await BookService.pageExists(subdomain, bookPath));
    } catch (err) {
      logger.error(`Unable to check "${bookPath}" on ${subdomain}: ${serializeError(err)}`);
      available = null;
    }

    return res.send({
      err: false,
      available,
      path: bookPath,
      url: bookURL,
    });
  } catch (err) {
    logger.error({ err }, "checkBookTitleAvailability failed");
    return conductor500Err(res);
  }
}

/**
 * Creates a new book with default features in a library Workbench area.
 *
 * Failures are separated into ones the user can fix (an unavailable title, a
 * library they can't access, a project that already has a book) and genuine
 * internal errors. Only the latter produce a 500. Steps that aren't required for
 * a usable book — the first chapter, front/back matter, team permissions — are
 * allowed to fail without failing the request.
 *
 * @param {express.Request} req - Incoming request.
 * @param {express.Response} res - Outgoing response.
 */
async function createBook(
  req: ZodReqWithUser<z.infer<typeof createBookSchema>>,
  res: Response,
) {
  try {
    const { library, title, projectID } = req.body;
    const { uuid: userID } = req.user.decoded;

    const user = await User.findOne({ uuid: userID }).orFail();

    const libraryApp = await centralIdentity.getApplicationById(library);
    if (!libraryApp) {
      return createBookErr(res, 404, "bad_library", conductorErrors.err11);
    }

    const subdomain = getSubdomainFromUrl(libraryApp.main_url);
    if (!subdomain) {
      return createBookErr(res, 404, "bad_library", conductorErrors.err11);
    }

    const ctx = await ProjectContext.load(projectID, { hydrate: true });
    if (!ctx.canMember(userID)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    // Creating a second book would orphan the first one and silently relink the
    // project, so refuse rather than half-succeed.
    if (ctx.doc.libreLibrary && ctx.doc.libreCoverID) {
      return createBookErr(
        res,
        409,
        "already_linked",
        ALREADY_LINKED_MSG,
      );
    }

    const hasLibAccess =
      await centralIdentity.checkUserApplicationAccessInternal(
        user.centralID,
        libraryApp.id,
      );
    if (!hasLibAccess) {
      return createBookErr(res, 403, "no_library_access", conductorErrors.err8);
    }

    const [bookPath, bookURL] = generateBookPathAndURL(subdomain, title);
    const titleConflictMsg = `A book already exists at ${bookURL}. Please choose a different title.`;

    // Pre-flight: a read is cheap and, unlike the create below, can't disturb an
    // existing book. If the library itself can't be reached, fall through — the
    // create is guarded too.
    try {
      if (await BookService.pageExists(subdomain, bookPath)) {
        return createBookErr(res, 409, "title_conflict", titleConflictMsg);
      }
    } catch (err) {
      logger.error(`Unable to pre-check "${bookPath}" on ${subdomain}, continuing: ${serializeError(err)}`);
    }

    let newCoverPageID: number | null = null;
    try {
      newCoverPageID = await BookService.createBookCoverPage({
        library: subdomain,
        coverPagePath: bookPath,
        title,
        throwOnConflict: true,
      });
    } catch (err) {
      // Lost the race between the pre-flight check and this write.
      if (err instanceof BookPageConflictError) {
        return createBookErr(res, 409, "title_conflict", titleConflictMsg);
      }
      logger.error(`Error creating coverpage for "${title}": ${serializeError(err)}`);
      return res.status(500).send({ err: true, errMsg: conductorErrors.err86 });
    }

    // The page exists at this point, so bailing without an ID would leave it
    // orphaned and make every retry conflict forever. Look the ID up instead.
    if (!newCoverPageID) {
      const recoveredID = await getPageID(bookPath, subdomain);
      if (recoveredID && Number.isFinite(Number(recoveredID))) {
        newCoverPageID = Number(recoveredID);
        logger.error(`No page ID returned for "${bookPath}"; recovered ${newCoverPageID} by path lookup.`);
      }
    }

    if (!newCoverPageID) {
      logger.error(`Library reported success but returned no page ID for "${bookPath}", and it could not be recovered by path lookup.`);
      return res.status(502).send({
        err: true,
        errMsg: `The book page was created at ${bookURL}, but the library did not return its ID, so it could not be linked to this project. Please contact support.`,
      });
    }

    // Link the project now, before anything else can fail. If this were left
    // until the end, a later failure would leave a coverpage that exists but
    // belongs to no project — and every retry would then conflict against it
    // with no way for the user to recover.
    //
    // This is also the authoritative "already linked" guard: the check above is
    // a cheap early bail, but it reads and writes in separate steps, so two
    // concurrent creates on the same project can both pass it. The filter here
    // repeats that condition inside a single-document update, which Mongo
    // applies atomically, so exactly one request can claim the project. It
    // mirrors the check exactly — a project counts as linked only when both
    // fields are set — so a project carrying just one of them is still
    // claimable, as before.
    const claimed = await Project.findOneAndUpdate(
      {
        projectID: { $eq: projectID },
        $or: [
          { libreCoverID: { $in: [null, ""] } },
          { libreLibrary: { $in: [null, ""] } },
        ],
      },
      {
        libreLibrary: subdomain,
        libreCoverID: newCoverPageID.toString(),
        didCreateWorkbench: true,
      },
      { new: true },
    );

    if (!claimed) {
      // Another request linked this project while we were creating our page.
      // Ours is now orphaned on the library; log it for manual cleanup rather
      // than deleting from an error path we don't fully understand.
      logger.error(`Lost the link race for project ${projectID}; "${bookPath}" on ${subdomain} (page ${newCoverPageID}) is orphaned and needs manual cleanup.`);
      return createBookErr(
        res,
        409,
        "already_linked",
        ALREADY_LINKED_MSG,
      );
    }

    const warnings: string[] = [];
    const newBookID = `${subdomain}-${newCoverPageID}`;

    // The first chapter is a convenience, not part of a valid book. Don't fail
    // the request (and strand the coverpage) over it.
    try {
      const chapterOnePath = generateChapterOnePath(bookPath);
      const chapterID = await BookService.createFirstChapter({
        library: subdomain,
        chapterPath: chapterOnePath,
      });
      if (!chapterID) {
        warnings.push(
          "The first chapter could not be created because a page already exists at that location. You can add chapters directly in the library.",
        );
      }
    } catch (err) {
      logger.error(`Error creating first chapter for "${title}": ${serializeError(err)}`);
      warnings.push(
        "Your book was created, but its first chapter could not be added. You can add chapters directly in the library.",
      );
    }

    await sleep(1500); // let CXone catch up with page creations

    // Front/back matter creation can take a while and is not critical to the book creation process,
    // so we fire-and-forget it here. If it fails, the book will still be usable, but the front/back matter
    // will need to be created manually.
    try {
      const bookService = new BookService({ bookID: newBookID });
      // Fire-and-forget
      bookService.createDefaultFrontMatter({
        coverPagePath: bookPath,
        coverPageFullURL: bookURL,
        titlePageInfo: {
          author: "",
          title,
          summary: "",
        }
      }).catch((err) => {
        logger.error(`Error creating default front matter: ${err instanceof Error ? err.message : err}`);
      });

      // Fire-and-forget
      bookService.createDefaultBackMatter({
        coverPagePath: bookPath,
      }).catch((err) => {
        logger.error(`Error creating default back matter: ${err instanceof Error ? err.message : err}`);
      });
    } catch (err) {
      logger.error(`Error initializing BookService for front/back matter creation: ${err instanceof Error ? err.message : err}`);
    }

    const permsUpdated = await updateTeamWorkbenchPermissions(
      projectID,
      subdomain,
      newCoverPageID.toString(),
    );

    if (!permsUpdated) {
      logger.info(`Failed to update permissions for ${projectID}.`); // Silent fail
      warnings.push(
        "Your book was created, but team permissions could not be applied automatically. Team members may need to be granted access manually.",
      );
    }

    logger.info(`Created ${bookPath}.`);
    return res.send({
      err: false,
      path: bookPath,
      url: bookURL,
      warnings,
    });
  } catch (err: any) {
    if (err instanceof ProjectError) {
      return returnProjectError(res, err);
    }

    if (err.name === "DocumentNotFoundError") {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    logger.error({ err }, "createBook failed");
    return conductor500Err(res);
  }
}

/**
 * Deletes a book (and its related resources) from both the Conductor DB and LibreTexts central listings.
 *
 * @param {express.Request} req - Incoming request.
 * @param {express.Response} res - Outgoing response.
 */
async function deleteBook(
  req: ZodReqWithUser<z.infer<typeof deleteBookSchema>>,
  res: Response,
) {
  try {
    const deleteProject = !!req.query?.deleteProject;
    const bookID = req.params.bookID;
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    if (!lib || !coverID) {
      return conductor400Err(res);
    }

    const foundBook = await Book.findOne({ bookID });
    if (!foundBook || !foundBook?.links?.online) {
      return conductor400Err(res);
    }

    // <find and delete project and associated resources>
    const attachedProject = await Project.findOne({
      libreCoverID: coverID,
      libreLibrary: lib,
    });
    if (attachedProject) {
      const projectID = attachedProject.projectID;
      await PeerReview.deleteMany({ projectID });
      if (deleteProject) {
        logger.info(`Deleting project ${projectID}`);
        const projDelRes = await projectsAPI.deleteProjectInternal(projectID);
        if (!projDelRes) {
          return conductor500Err(res);
        }
      }
    }
    // </find and delete project and associated resources>

    await Promise.allSettled([
      AdoptionReport.deleteMany({ "resource.id": bookID }),
      collectionsAPI.removeResourceFromAnyCollectionInternal(bookID),
    ]);

    // <delete from central API>
    try {
      if (process.env.NODE_ENV === "production") {
        await deleteBookFromAPI(bookID);
        logger.info(`Book ${bookID} deleted from API.`);
      } else {
        logger.info("Simulating book deletion from API.");
      }
    } catch (err: any) {
      logger.error({ err }, "deleteBook failed");
      return conductor500Err(res);
    }
    // </delete from central API>

    await Book.deleteOne({ bookID });

    /* Fire-and-forget: an unpublish must not fail on a Meilisearch hiccup. The
       book is gone from Mongo, so a dropped index write leaves a stale document
       until the next full re-sync — not a failed delete. */
    void removeBookFromSearchIndex(bookID);

    /* Same contract for the store: pull the book off sale now rather than leaving
       it purchasable until the nightly Stripe reconcile. The outcome is dropped
       on purpose — the Book is already gone from Mongo, and the nightly pass
       re-archives anything this misses. A delete must not fail on Stripe. */
    void archiveBookInStripe(bookID);

    return res.send({
      err: false,
      msg: "Book successfully deleted.",
    });
  } catch (err) {
    logger.error({ err }, "deleteBook failed");
    return conductor500Err(res);
  }
}

/**
 * Returns a Book object given a book ID.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookDetail'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookDetail(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response,
) {
  try {
    const { bookID } = req.params;
    const bookRes = await Book.aggregate([
      {
        $match: { bookID },
      },
      {
        $addFields: {
          coverID: {
            $arrayElemAt: [{ $split: ["$bookID", "-"] }, 1],
          },
        },
      },
      {
        $lookup: {
          from: "projects",
          let: {
            lib: "$library",
            coverID: "$coverID",
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
      {
        $lookup: {
          from: "peerreviews",
          let: {
            projectID: "$project.projectID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$projectID", "$$projectID"],
                },
              },
            },
          ],
          as: "peerReviews",
        },
      },
      {
        $addFields: {
          projectID: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$project.projectID", false] },
                  { $gt: [{ $strLenBytes: "$project.projectID" }, 0] },
                ],
              },
              "$project.projectID",
              "$projectID", // undefined
            ],
          },
          hasReaderResources: {
            $and: [
              { $ifNull: ["$readerResources", false] },
              { $gt: [{ $size: "$readerResources" }, 0] },
            ],
          },
          allowAnonPR: {
            $eq: ["$project.allowAnonPR", true],
          },
          hasPeerReviews: {
            $and: [
              { $ifNull: ["$peerReviews", false] },
              { $gt: [{ $size: "$peerReviews" }, 0] },
            ],
          },
          hasAdaptCourse: {
            $and: [
              { $ifNull: ["$project.adaptCourseID", false] },
              { $gt: [{ $strLenBytes: "$project.adaptCourseID" }, 0] },
            ],
          },
          adaptCourseID: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$project.adaptCourseID", false] },
                  { $gt: [{ $strLenBytes: "$project.adaptCourseID" }, 0] },
                ],
              },
              "$project.adaptCourseID",
              "$adaptCourseID", // undefined
            ],
          },
          isbns: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$project.isbns", false] },
                  { $gt: [{ $size: "$project.isbns" }, 0] },
                ],
              },
              "$project.isbns",
              [],
            ],
          },
          doi: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$doi", false] },
                  { $gt: [{ $strLenBytes: "$doi" }, 0] },
                ],
              },
              "$doi",
              "$project.doi", // undefined
            ],
          },
          sourceOriginalPublicationDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceOriginalPublicationDate", false] },
                  {
                    $gt: [
                      { $strLenBytes: "$sourceOriginalPublicationDate" },
                      0,
                    ],
                  },
                ],
              },
              "$sourceOriginalPublicationDate",
              "$project.sourceOriginalPublicationDate", // undefined
            ],
          },
          sourceHarvestDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceHarvestDate", false] },
                  { $gt: [{ $strLenBytes: "$sourceHarvestDate" }, 0] },
                ],
              },
              "$sourceHarvestDate",
              "$project.sourceHarvestDate", // undefined
            ],
          },
          sourceLastModifiedDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceLastModifiedDate", false] },
                  { $gt: [{ $strLenBytes: "$sourceLastModifiedDate" }, 0] },
                ],
              },
              "$sourceLastModifiedDate",
              "$project.sourceLastModifiedDate", // undefined
            ],
          },
          sourceLanguage: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceLanguage", false] },
                  { $gt: [{ $strLenBytes: "$sourceLanguage" }, 0] },
                ],
              },
              "$sourceLanguage",
              "$project.sourceLanguage", // undefined
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
          materials: 0,
          project: 0,
          peerReviews: 0,
          readerResources: {
            _id: 0,
          },
        },
      },
    ]);
    if (bookRes.length < 1) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    return res.send({
      err: false,
      book: bookRes[0],
    });
  } catch (e) {
    logger.error({ err: e }, "getBookDetail failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Checks if a Book has an associated Project, if it allows anonymous Peer Reviews,
 *  and the current Peer Reviews available.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookPeerReviews'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookPeerReviews(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response,
) {
  try {
    let allowsAnon = true;
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    if (isEmptyString(lib) || isEmptyString(coverID)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const project = await Project.findOne({
      $and: [
        { libreLibrary: lib },
        { libreCoverID: coverID },
        { visibility: "public" },
      ],
    }).lean();
    if (!project) {
      return res.send({
        err: false,
        msg: "No Projects associated with this resource.",
      });
    }

    if (project.allowAnonPR === false) {
      allowsAnon = false; // true by default
    }
    const peerReviews = await PeerReview.aggregate(
      buildPeerReviewAggregation(project.projectID),
    );
    return res.send({
      err: false,
      projectID: project.projectID,
      reviews: peerReviews,
      allowsAnon,
    });
  } catch (e) {
    logger.error({ err: e }, "getBookPeerReviews failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Adds the Book specified by @bookID in the request
 * body to the Custom Catalog for the organization
 * handled by the current server instance.
 * If the Book is already in the Custom Catalog,
 * no change is made (unique entries).
 * If the Custom Catalog record does not already
 * exists, it is created.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'addBookToCustomCatalog'
 */
const addBookToCustomCatalog = async (
  req: z.infer<typeof getWithBookIDBodySchema>,
  res: Response,
) => {
  try {
    await CustomCatalog.updateOne(
      { orgID: process.env.ORG_ID },
      {
        $setOnInsert: {
          orgID: process.env.ORG_ID,
        },
        $addToSet: {
          resources: req.body.bookID,
        },
        $pull: {
          automaticMatchingExclusions: req.body.bookID, // ensure not in excluded list
        },
      },
      {
        upsert: true,
      },
    );

    return res.send({
      err: false,
      msg: "Resource successfully added to Catalog.",
    });
  } catch (err: any) {
    logger.error({ err }, "addBookToCustomCatalog failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Removes the Book specified by @bookID in the request
 * body from the Custom Catalog for the organization
 * handled by the current server instance. If the
 * book is not in the Custom Catalog, no change is
 * made. All instances of the @bookID are removed from
 * the Custom Catalog to combat duplicate entries.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'removeBookFromCustomCatalog'
 */
const removeBookFromCustomCatalog = async (
  req: z.infer<typeof getWithBookIDBodySchema>,
  res: Response,
) => {
  try {
    await CustomCatalog.updateOne(
      { orgID: process.env.ORG_ID },
      {
        $pullAll: {
          resources: [req.body.bookID],
        },
      },
    );

    return res.send({
      err: false,
      msg: "Resource successfully removed from Catalog.",
    });
  } catch (err: any) {
    logger.error({ err }, "removeBookFromCustomCatalog failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

const excludeBookFromAutoMatch = async (
  req: z.infer<typeof getWithBookIDBodySchema>,
  res: Response,
) => {
  try {
    const orgData = await Organization.findOne(
      { orgID: process.env.ORG_ID },
      { _id: 0, autoCatalogMatchingDisabled: 1 },
    )
      .lean()
      .orFail();

    if (orgData?.autoCatalogMatchingDisabled) {
      return res.status(400).send({
        err: true,
        errMsg:
          "Automatic Catalog Matching is not enabled for this organization. Exclusion not necessary.",
      });
    }

    await CustomCatalog.updateOne(
      { orgID: process.env.ORG_ID },
      {
        $pullAll: {
          resources: [req.body.bookID],
        },
        $addToSet: {
          automaticMatchingExclusions: req.body.bookID,
        },
      },
    );

    return res.send({
      err: false,
      msg: "Resource successfully excluded from Automatic Catalog Matching.",
    });
  } catch (err: any) {
    logger.error({ err }, "excludeBookFromAutoMatch failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Makes a request to a Book's respective Project to retrieve a signed download URL for a given file
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookFiles'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function downloadBookFile(
  req: z.infer<typeof downloadBookFileSchema>,
  res: Response,
) {
  try {
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    const fileID = req.params.fileID;
    if (isEmptyString(lib) || isEmptyString(coverID)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const project = await Project.findOne({
      $and: [
        { libreLibrary: lib },
        { libreCoverID: coverID },
        { visibility: "public" },
      ],
    }).lean();
    if (!project) {
      return res.send({
        err: false,
        msg: "No Projects associated with this resource.",
      });
    }

    const downloadURLs = await downloadProjectFiles(
      project.projectID,
      [fileID],
      true,
      "",
      true,
    );

    if (
      !downloadURLs ||
      !Array.isArray(downloadURLs) ||
      downloadURLs.length < 1
    ) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    return res.send({
      err: false,
      msg: "Successfully generated download link!",
      url: downloadURLs[0], // only first index because only one file requested
    });
  } catch (e) {
    logger.error({ err: e }, "downloadBookFile failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a Book's Table of Contents via an internal call to the LibreTexts API.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookTOC'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookTOC(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response,
) {
  try {
    const bookService = new BookService({ bookID: req.params.bookID });
    const toc = await bookService.getBookTOCNew();
    return res.send({
      err: false,
      toc,
    });
  } catch (e) {
    logger.error({ err: e }, "getBookTOC failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a Book's Content Licensing Report from the LibreTexts API
 * Server and returns the data, if it exists.
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getLicenseReport(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response,
) {
  const notFoundResponse = {
    err: false,
    found: false,
    msg: "Couldn't find a Content Licensing Report for that resource.",
  };
  try {
    const { bookID } = req.params;
    let notFound = false;
    const licRep = await axios
      .get(`https://api.libretexts.org/licensereports/${bookID}.json`)
      .catch((err) => {
        if (err.response?.status === 404) {
          notFound = true;
        } else {
          throw err;
        }
      });
    if (notFound || !licRep.data?.id) {
      return res.send(notFoundResponse);
    }

    return res.send({
      err: false,
      found: true,
      msg: `Found Content Licensing Report for ${bookID}.`,
      data: licRep.data,
    });
  } catch (e) {
    logger.error({ err: e }, "getLicenseReport failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getBookPagesDetails(
  req: ZodReqWithUser<z.infer<typeof getWithBookIDParamSchema>>,
  res: Response,
) {
  try {
    const { bookID } = req.params;

    const bookService = new BookService({ bookID });
    const toc = await bookService.getBookTOCNew();

    const [overviews, tags] = await Promise.all([
      bookService.getAllPageOverviews(toc),
      bookService.getAllPageTags(toc),
    ]);

    // Loop through table of contents and add overviews and tags to each page (based on ID)
    // Table of contents is a nested array, so we need to loop through each level
    const addOverviewsAndTags = (
      toc: TableOfContents,
    ): TableOfContentsDetailed => {
      const pageOverview = overviews.find((o) => o.id === toc.id);
      const pageTags = tags.find((t) => t.id === toc.id)?.tags || [];

      const page: TableOfContentsDetailed = {
        ...toc,
        overview: pageOverview?.overview || "",
        tags: pageTags,
        children: toc.children.map(addOverviewsAndTags),
      };

      return page;
    };

    const detailedToc = addOverviewsAndTags(toc);

    return res.send({
      err: false,
      toc: detailedToc,
    });
  } catch (err) {
    logger.error({ err }, "getBookPagesDetails failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getPageDetail(
  req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
  res: Response,
) {
  try {
    const { pageID: fullPageID } = req.params;
    const { coverPageID } = req.query;

    const bookService = new BookService({ bookID: coverPageID });
    const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

    // Check if the user has access to the page (always true for superadmins, assuming page is actually in book TOC)
    const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const details = await bookService.getPageDetails(pageID);
    if (!details) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    return res.send({
      err: false,
      overview: details.overview,
      tags: details.tags,
    });
  } catch (e) {
    logger.error({ err: e }, "getPageDetail failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function updatePageDetails(
  req: ZodReqWithUser<z.infer<typeof updatePageDetailsSchema>>,
  res: Response,
) {
  try {
    const { pageID } = req.params;
    const { coverPageID } = req.query;
    const { summary, tags } = req.body;

    const bookService = new BookService({ bookID: coverPageID });
    const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [error, success] = await bookService.updatePageDetails(
      pageID,
      summary,
      tags,
    );

    if (error) {
      switch (error) {
        case "location":
          return res.status(404).send({
            err: true,
            errMsg: conductorErrors.err2,
          });
        case "internal":
          return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
          });
      }
    }

    if (!success) {
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }

    return res.send({
      err: false,
      msg: "Page details updated successfully.",
    });
  } catch (err) {
    logger.error({ err }, "updatePageDetails failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function bulkUpdatePageTags(
  req: ZodReqWithUser<z.infer<typeof bulkUpdatePageTagsSchema>>,
  res: Response,
) {
  try {
    const { bookID } = req.params;
    const { pages } = req.body;

    const bookService = new BookService({ bookID });

    const updatePromises = [];
    for (let i = 0; i < pages.length; i++) {
      const promise = new Promise((resolve, reject) => {
        setTimeout(async () => {
          const page = pages[i];
          const [error, success] = await bookService.updatePageDetails(
            page.id,
            undefined,
            page.tags,
          );
          if (error) {
            reject(error);
          }
          resolve({ error, success });
        }, 1000);
      });
      updatePromises.push(promise);
    }

    const results = await Promise.allSettled(updatePromises);
    const failed = results.filter((r) => r.status === "rejected").length;
    const processed = results.filter((r) => r.status === "fulfilled").length;

    return res.send({
      err: false,
      failed,
      processed,
    });
  } catch (err) {
    logger.error({ err }, "bulkUpdatePageTags failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Generates a JSON file containing Commons Books listings for use by 3rd parties.
 * @returns {boolean} True if export creation succeeded, false otherwise.
 */
const generateKBExport = () => {
  let kbExport = {
    date: new Date().toISOString(),
    titles: [],
  };
  return new Promise((resolve, _reject) => {
    resolve(
      Book.aggregate([
        {
          $addFields: {
            coverID: {
              $arrayElemAt: [{ $split: ["$bookID", "-"] }, 1],
            },
          },
        },
        {
          $lookup: {
            from: "projects",
            let: {
              lib: "$library",
              coverID: "$coverID",
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
        {
          $addFields: {
            isbn: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$isbn", false] },
                    { $gt: [{ $strLenBytes: "$isbn" }, 0] },
                  ],
                },
                "$isbn",
                "$project.isbn", // undefined
              ],
            },
            sourceOriginalPublicationDate: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$sourceOriginalPublicationDate", false] },
                    {
                      $gt: [
                        { $strLenBytes: "$sourceOriginalPublicationDate" },
                        0,
                      ],
                    },
                  ],
                },
                "$sourceOriginalPublicationDate",
                "$project.sourceOriginalPublicationDate", // undefined
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            bookID: 1,
            title: 1,
            author: 1,
            library: 1,
            license: 1,
            summary: 1,
            thumbnail: 1,
            isbn: 1,
            sourceOriginalPublicationDate: 1,
            lastUpdated: 1,
          },
        },
      ]),
    );
  })
    .then((commonsBooks) => {
      if (Array.isArray(commonsBooks)) {
        kbExport.expected = commonsBooks.length;
        commonsBooks.forEach((item) => {
          let bookOut = {
            publication_title: String(item.title)
              .trim()
              .replace(/\\n/gi, " ")
              .replace("Book: ", ""),
            title_id: item.bookID,
            title_url: genPermalink(item.bookID),
            coverage_depth: "fulltext",
            access_type: "F",
            publisher_name: "LibreTexts",
          };
          if (
            typeof item.thumbnail === "string" &&
            !isEmptyString(item.thumbnail)
          ) {
            bookOut.thumbnail_url = item.thumbnail;
          }
          if (
            typeof item.license === "string" &&
            !isEmptyString(item.license)
          ) {
            bookOut.license = item.license;
          }
          if (typeof item.isbn === "string" && !isEmptyString(item.isbn)) {
            bookOut.print_identifier = item.isbn;
          }
          if (item.sourceOriginalPublicationDate) {
            bookOut.date_monograph_published_online =
              item.sourceOriginalPublicationDate.toString();
          }
          if (typeof item.lastUpdated === "string") {
            const lastUpdateDate = new Date(item.lastUpdated);
            if (isValidDateObject(lastUpdateDate)) {
              bookOut.date_last_updated = item.lastUpdated;
            }
          }
          if (
            typeof item.summary === "string" &&
            !isEmptyString(item.summary)
          ) {
            bookOut.description = item.summary;
          }
          if (item.library === "espanol") {
            bookOut.language = "spanish";
          } else {
            bookOut.language = "english";
          }
          if (typeof item.author === "string" && !isEmptyString(item.author)) {
            let itemAuthors = [];
            let textmapMatch = item.author.match(/textmap/gi);
            if (textmapMatch === null) {
              // not a textmap, try to parse authors
              let authorsString = item.author.replace(/(&|\band\b)/gi, ",");
              let authors = authorsString.split(/,/gi);
              if (authors.length > 0) {
                authors.forEach((author) => {
                  let authorProcess = author.trim();
                  if (
                    authorProcess.toLowerCase() !==
                    "no attribution by request" &&
                    authorProcess.length > 0
                  ) {
                    itemAuthors.push(authorProcess);
                  }
                });
              }
            } else {
              // textmap, mark author as LibreTexts
              itemAuthors.push("LibreTexts");
            }
            if (itemAuthors.length > 0) bookOut.authors = itemAuthors;
          }
          kbExport.titles.push(bookOut);
        });
        return fs.ensureDir("./public");
      } else throw new Error("notarray");
    })
    .then(() => fs.writeJson("./public/kbexport.json", kbExport))
    .then(() => true)
    .catch((err) => {
      logger.error({ err }, "generateKBExport failed");
      return false;
    });
};

/**
 * Attempts to retrieve the Knowledge Base export file(s) if available or generate them
 * immediately if not found.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const retrieveKBExport = (_req: Request, res: Response) => {
  fs.pathExists("./public/kbexport.json")
    .then((exists) => {
      if (exists === true) return true;
      return generateKBExport(); // generate on-the-fly
    })
    .then((generated) => {
      if (generated === true) {
        return res
          .status(200)
          .sendFile("./public/kbexport.json", { root: "." });
      }
      throw new Error("kbexport-notfound");
    })
    .catch((err) => {
      logger.error({ err }, "retrieveKBExport failed");
      return res.status(500).send({
        err: true,
        msg: conductorErrors.err45,
      });
    });
};

export async function syncWithSearchIndex(req: Request, res: Response) {
  try {
    // Return response immediately to avoid timeout
    res.send({
      err: false,
      msg: "Commons Books search index sync initiated. This process will run in the background.",
    });

    // Run the actual sync in the background (don't await)
    syncBooksInBackground().catch((e) => {
      logger.error({ err: e }, "Error in background sync");
    });
  } catch (e) {
    logger.error({ err: e }, "syncWithSearchIndex failed");
    // Only send error if response hasn't been sent yet
    if (!res.headersSent) {
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }
  }
}

/* A 500-document Meilisearch task can outrun the SearchService default on a
   loaded instance, and this is a background job — give it room. */
const SEARCH_INDEX_TASK_TIMEOUT_MS = 120_000;

/* Each catch-up pass covers a strictly shorter window than the last, so a small
   budget is enough to converge. Anything still outstanding waits for the next
   re-sync rather than holding this run open indefinitely. */
const SEARCH_INDEX_CATCH_UP_PASSES = 3;

/* The catch-up assumes only a handful of Books change while a re-sync runs. A
   concurrent library walk breaks that assumption wholesale: `buildBookUpsertOp`
   $sets `lastSyncedAt` on every Book it touches, so Mongoose stamps `updatedAt`
   across the whole corpus whether or not any field actually changed. Past this
   many hits the window is not a catch-up, it is a second full rebuild — skip it
   and let the next re-sync cover the ground. */
const SEARCH_INDEX_CATCH_UP_MAX = 5_000;

/**
 * Re-indexes every Book written since `since`, repeating until a pass finds
 * nothing new or the pass budget (`SEARCH_INDEX_CATCH_UP_PASSES`) runs out.
 * Returns the number of documents rewritten.
 *
 * The full walk pages through `Book.aggregate`, so a Book written after its page's
 * snapshot was read gets indexed from stale data. Meilisearch is last-write-wins
 * per document with no conditional update, so the walk's older payload silently
 * overwrites whatever a concurrent incremental upsert (Shapeshift webhook, a Book
 * edit, another instance) had just written. Reading Mongo again closes that window
 * no matter which process opened it — an in-process lock could not, because every
 * instance shares one Meilisearch.
 */
async function catchUpSearchIndexSince(
  since: Date,
  batchSize: number,
): Promise<number> {
  const searchService = await SearchService.getInstance();
  let cursor = since;
  let rewritten = 0;

  for (let pass = 0; pass < SEARCH_INDEX_CATCH_UP_PASSES; pass += 1) {
    /* Stamped before the read, so a write landing during this pass is caught by
       the next one rather than falling through the gap. */
    const passStartedAt = new Date();
    const changed = await Book.find(
      { updatedAt: { $gt: cursor } },
      { bookID: 1, _id: 0 },
    )
      /* One over the cap, purely to tell "at the cap" from "over it". */
      .limit(SEARCH_INDEX_CATCH_UP_MAX + 1)
      .lean();
    if (changed.length === 0) break;

    if (changed.length > SEARCH_INDEX_CATCH_UP_MAX) {
      logger.info(`Catch-up window covers more than ${SEARCH_INDEX_CATCH_UP_MAX} books — a library ` +
                  `walk most likely overlapped this run and restamped every lastSyncedAt. ` +
                  `Skipping the catch-up; the next re-sync covers it.`);
      break;
    }

    const bookIDs = changed.map((book) => book.bookID);
    for (let i = 0; i < bookIDs.length; i += batchSize) {
      /* Already applies attachAssetCounts and sanitizeForSearchIndex, so these
         documents are shaped identically to the ones the walk writes. A Book
         deleted mid-run simply drops out here; the prune removes it. */
      const docs = await buildBookSearchDocuments(
        bookIDs.slice(i, i + batchSize),
      );
      if (docs.length === 0) continue;

      await searchService.addDocuments("books", docs, {
        waitForCompletion: true,
        timeOutMs: SEARCH_INDEX_TASK_TIMEOUT_MS,
      });
      rewritten += docs.length;
    }

    cursor = passStartedAt;
  }

  if (rewritten > 0) {
    logger.info(`Re-indexed ${rewritten} book(s) written while the re-sync was running.`);
  }

  return rewritten;
}

/**
 * Syncs all books to the search index in batches to avoid memory issues
 * and timeouts with large datasets. Runs in the background.
 * INTERNAL USE ONLY.
 */
export async function syncBooksInBackground() {
  try {
    logger.info("Initiating Commons Books search index synchronization...");
    const searchService = await SearchService.getInstance();

    const batchSize = 500; // Process 500 books at a time
    let skip = 0;
    let hasMore = true;
    let totalSynced = 0;

    /* Any Book written from here on may be read by the walk below from a snapshot
       taken before that write — see the catch-up pass that follows the loop. */
    const syncStartedAt = new Date();

    while (hasMore) {
      const books = await Book.aggregate([
        ...bookSearchIndexAggregationStages,
        { $skip: skip },
        { $limit: batchSize },
      ]);

      if (books.length === 0) {
        hasMore = false;
        break;
      }

      // Attach public/instructor asset counts so the search index can filter on them.
      await attachAssetCounts(books);

      /* Waited to completion, not just enqueued: document-level rejections are
         reported through task status, never the HTTP response, so without this the
         success logged below would be indistinguishable from a batch Meilisearch
         threw away. It also keeps the loop from outrunning the task queue. */
      await searchService.addDocuments("books", sanitizeForSearchIndex(books), {
        waitForCompletion: true,
        timeOutMs: SEARCH_INDEX_TASK_TIMEOUT_MS,
      });
      totalSynced += books.length;
      logger.info(`Synced batch of ${books.length} books (${totalSynced} total)...`);

      skip += batchSize;

      // If we got fewer results than batchSize, we're done
      if (books.length < batchSize) {
        hasMore = false;
      }
    }

    const caughtUp = await catchUpSearchIndexSince(syncStartedAt, batchSize);

    /* Upserts alone never remove anything, so a book deleted while Meilisearch was
       unreachable would stay searchable forever. Reconcile now that every live Book
       has been written — applied, not merely enqueued, so no stale document can
       still be in flight and slip past the index read this performs. */
    const pruned = await pruneDeletedBooksFromSearchIndex();

    logger.info(`Commons Books search index sync completed. Total synced: ${totalSynced}, caught up: ${caughtUp}, pruned: ${pruned}`);
  } catch (e) {
    logger.error({ err: e }, "Error in syncBooksInBackground");
    throw e;
  }
}

async function importPressBooksBook(
  req: ZodReqWithUser<z.infer<typeof importPressBooksBookSchema>>,
  res: Response,
) {
  try {
    const { library, title, projectID, pbBookURL } = req.body;
    const { uuid: userID } = req.user.decoded;
    const user = await User.findOne({ uuid: userID }).orFail();
    const project = await Project.findOne({ projectID }).orFail();

    const libraryApp = await centralIdentity.getApplicationById(library);
    if (!libraryApp) {
      throw new Error("badlibrary");
    }
    if (!projectsAPI.checkProjectMemberPermission(project, user)) {
      throw new Error(conductorErrors.err8);
    }
    if (!await centralIdentity.checkUserApplicationAccessInternal(user.centralID, libraryApp.id)) {
      throw new Error(conductorErrors.err8);
    }

    const jobID = base62(10);

    await PressbooksImportJob.create({
      jobID,
      projectID,
      userID,
      library,
      pbBookURL,
      title,
      status: "pending",
      messages: ["Pressbooks import job created."],
    });

    res.send({
      err: false,
      jobID,
    });

    void runPressbooksImportJob({
      jobID,
      library,
      title,
      projectID,
      pbBookURL,
      userID,
    });
  } catch (err: any) {
    return res.status(500).send({
      err: true,
      errMsg: err.message,
    });
  }
}

type PressbooksImportJobParams = {
  jobID: string;
  library: number;
  title?: string;
  projectID: string;
  pbBookURL: string;
  userID: string;
};
async function appendPressbooksJobMessages(jobID: string, messages: string[]) {
  if (!messages.length) return;
  await PressbooksImportJob.updateOne(
    { jobID },
    {
      $push: {
        messages: {
          $each: messages,
        },
      },
    },
  );
}


async function runPressbooksImportJob(params: PressbooksImportJobParams) {
  const { jobID, library, title, projectID, pbBookURL, userID } = params;

  try {
    await PressbooksImportJob.updateOne(
      { jobID },
      {
        $set: {
          status: "running",
        },
      },
    );

    await appendPressbooksJobMessages(jobID, [
      "Validating user, project, and library access...",
    ]);

    const user = await User.findOne({ uuid: userID }).orFail();
    const project = await Project.findOne({ projectID }).orFail();

    const libraryApp = await centralIdentity.getApplicationById(library);
    if (!libraryApp) {
      throw new Error("badlibrary");
    }

    const subdomain = getSubdomainFromUrl(libraryApp.main_url);
    if (!subdomain) {
      throw new Error("badlibrary");
    }

    // Check project permissions
    const canCreate = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canCreate) {
      throw new Error(conductorErrors.err8);
    }

    const hasLibAccess =
      await centralIdentity.checkUserApplicationAccessInternal(
        user.centralID,
        libraryApp.id,
      );

    if (!hasLibAccess) {
      throw new Error(conductorErrors.err8);
    }

    const scraper = new PressBookScraper(pbBookURL, subdomain, title);
    const result = await scraper.publishBook({
      log: (message: string) => {
        void appendPressbooksJobMessages(jobID, [message]);
      },
    });

    await appendPressbooksJobMessages(jobID, [
      "Updating associated project with new Workbench information...",
    ]);

    project.libreLibrary = subdomain;
    project.libreCoverID = result.bookID;
    project.didCreateWorkbench = true;
    result.authorsName && (project.author = result.authorsName);
    result.license && (project.license = result.license);
    // result.sourcePublicationDate && (project.sourceOriginalPublicationDate = result.sourcePublicationDate);
    result.thumbnail && (project.thumbnail = result.thumbnail);
    result.resourceURL && (project.projectURL = result.resourceURL);
    await project.save();

    await PressbooksImportJob.updateOne(
      { jobID },
      {
        $set: {
          status: "success",
          resultPath: result.path,
          resultURL: result.url,
        },
      },
    );

    await appendPressbooksJobMessages(jobID, [
      "Pressbooks import completed successfully.",
    ]);
  } catch (err: any) {
    logger.error({ err }, "runPressbooksImportJob failed");
    await PressbooksImportJob.updateOne(
      { jobID },
      {
        $set: {
          status: "error",
          errorMessage: err?.message || conductorErrors.err6,
        },
      },
    );
    await appendPressbooksJobMessages(jobID, [
      `Pressbooks import failed: ${err?.message || conductorErrors.err6}`,
    ]);
  }
}

async function getPressBooksImportJobStatus(
  req: ZodReqWithUser<z.infer<typeof getPressbooksImportJobStatusSchema>>,
  res: Response,
) {
  try {
    const { jobID } = req.params;
    const requesterID = req.user.decoded.uuid;

    const job = await PressbooksImportJob.findOne({ jobID }).lean();
    if (!job) {
      return res.status(404).send({
        err: true,
        errMsg: "Import job not found.",
      });
    }

    if (job.userID !== requesterID) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    return res.send({
      err: false,
      job: {
        jobID: job.jobID,
        status: job.status,
        messages: job.messages || [],
        errorMessage: job.errorMessage,
        resultPath: job.resultPath,
        resultURL: job.resultURL,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "getPressBooksImportJobStatus failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getActivePressBooksImportJob(
  req: ZodReqWithUser<z.infer<typeof getActivePressbooksImportJobSchema>>,
  res: Response,
) {
  try {
    const { projectID } = req.query;
    const requesterID = req.user.decoded.uuid;

    const job = await PressbooksImportJob.findOne({
      projectID,
      userID: requesterID,
      status: { $in: ["pending", "running"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!job) {
      return res.send({
        err: false,
        job: null,
      });
    }

    return res.send({
      err: false,
      job: {
        jobID: job.jobID,
        status: job.status,
        messages: job.messages || [],
      },
    });
  } catch (e) {
    logger.error({ err: e }, "getActivePressBooksImportJob failed");
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getCoverIdByUrl(req: Request, res: Response) {
  try {
    const { url } = req.query as { url: string };
    const result = await resolveCoverPageIdFromUrl(url);
    if (!result) {
      return res
        .status(404)
        .send({ err: true, errMsg: "Could not resolve cover page ID." });
    }
    return res.send({ err: false, id: result.id, bookID: result.bookID });
  } catch (err) {
    logger.error({ err }, "getCoverIdByUrl failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function getGlossaryTermSearch(req: Request, res: Response) {
  try {
    const { term } = req.query as { term: string };
    const results = await Glossary.find(
      { term: { $regex: escapeRegEx(term), $options: "i" } },
      { term: 1, _id: 0 },
    )
      .limit(10)
      .lean();
    return res.send({
      err: false,
      data: results.map((entry) => entry.term),
    });
  } catch (err) {
    logger.error({ err }, "getGlossaryTermSearch failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function getBookGlossary(
  req: ZodReqWithUser<z.infer<typeof getWithCoverIDParamSchema>>,
  res: Response,
) {
  try {
    const { coverID, library } = req.params;
    const glossaryService = new GlossaryService();
    const project = await glossaryService.getProject({
      coverID: coverID.toString(),
      library,
    });
    const { uuid: userID } = req.user.decoded;

    const user = await User.findOne({ uuid: userID }).orFail();
    const isSuperAdmin = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "superadmin",
      true,
    );
    if (!project && !isSuperAdmin) {
      return res.status(404).send({ err: true, errMsg: "Project not found for this book." });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canAccess && !isSuperAdmin) {
      throw new Error(conductorErrors.err8);
    }

    const glossary = await glossaryService.getGlossary({
      coverID: coverID.toString(),
      library,
    });
    return res.send({ err: false, data: glossary });
  } catch (err) {
    logger.error({ err }, "getBookGlossary failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}


async function addBookGlossary(
  req: ZodReqWithUser<z.infer<typeof addWithCoverIDParamSchema>> & { image: Express.Multer.File },
  res: Response,
) {
  try {
    const { glossaryID, term, definition, pageId, bookId, altText, caption, link, source, imageSource, imageAuthor, imageLicense, aliases, author, usageID, removeImage } = req.body;
    const { coverID, library } = req.params;

    const glossaryService = new GlossaryService();
    const project = await glossaryService.getProject({
      coverID: coverID.toString(),
      library,
    });
    const { uuid: userID } = req.user.decoded;
    const user = await User.findOne({ uuid: userID }).orFail();
    const isSuperAdmin = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "superadmin",
      true,
    );
    if (!project && !isSuperAdmin) {
      return res.status(404).send({ err: true, errMsg: "Project not found for this book." });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canAccess && !isSuperAdmin) {
      throw new Error(conductorErrors.err8);
    }
    if (usageID) {
      await glossaryService.updateGlossaryUsage(usageID, {
        glossaryID: glossaryID?.toString().trim() === "" ? undefined : glossaryID?.toString().trim(),
        removeImage,
        term: term.trim(),
        definition: definition.trim(),
        pageId,
        bookId: bookId?.trim() === "" ? undefined : bookId?.trim(),
        library: library.trim(),
        coverID: coverID.toString(),
        addedBy: req.user.decoded.uuid,
        imageFile: req.file,
        altText: altText?.trim() || undefined,
        caption: caption?.trim() || undefined,
        aliases: aliases?.split(",").map((alias) => alias.trim()).filter((alias) => alias !== "") || [],
        author: author?.trim() || undefined,
        link: link?.trim() || undefined,
        source: source?.trim() || undefined,
        imageSource: imageSource?.trim() || undefined,
        imageAuthor: imageAuthor?.trim() || undefined,
        imageLicense: imageLicense?.trim() || undefined,
      });
      return res.send({ err: false, pageId, termID: usageID });
    }
    const aliasesArray = aliases?.split(",").map((alias) => alias.trim()).filter((alias) => alias !== "") || [];
    const termID = await glossaryService.addGlossary({
      term: term.trim(),
      definition: definition.trim(),
      pageId,
      bookId: bookId?.trim() === "" ? undefined : bookId?.trim(),
      library: library.trim(),
      coverID: coverID.toString(),
      addedBy: req.user.decoded.uuid,
      imageFile: req.file,
      altText: altText?.trim() || undefined,
      caption: caption?.trim() || undefined,
      aliases: aliases?.split(",").map((alias) => alias.trim()).filter((alias) => alias !== "") || [],
      author: author?.trim() || undefined,
      link: link?.trim() || undefined,
      source: source?.trim() || undefined,
      imageSource: imageSource?.trim() || undefined,
      imageAuthor: imageAuthor?.trim() || undefined,
      imageLicense: imageLicense?.trim() || undefined,
      glossaryID: glossaryID?.toString().trim() === "" ? undefined : glossaryID?.toString().trim(),
    });
    return res.send({ err: false, pageId, termID });
  } catch (err) {
    logger.error({ err }, "addBookGlossary failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function addPageToGlossaryUsage(
  req: ZodReqWithUser<z.infer<typeof addPageWithCoverIDParamSchema>>,
  res: Response,
) {
  try {
    const { pageIds, usageIds } = req.body;
    const { coverID, library } = req.params;
    const glossaryService = new GlossaryService();
    const project = await glossaryService.getProject({
      coverID: coverID.toString(),
      library,
    });
    const { uuid: userID } = req.user.decoded;
    const user = await User.findOne({ uuid: { $eq: userID } }).orFail();
    const isSuperAdmin = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "superadmin",
      true,
    );
    if (!project && !isSuperAdmin) {
      return res.status(404).send({ err: true, errMsg: "Project not found for this book." });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canAccess && !isSuperAdmin) {
      throw new Error(conductorErrors.err8);
    }
    await glossaryService.addPageToGlossaryUsage(pageIds, usageIds, coverID.toString(), library);
    return res.send({ err: false, msg: "Page added to glossary usage successfully." });
  } catch (err) {
    logger.error({ err }, "addPageToGlossaryUsage failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function deleteBookGlossary(
  req: ZodReqWithUser<z.infer<typeof getWithCoverIDParamSchema>>,
  res: Response,
) {
  try {
    const { coverID, library } = req.params;
    const glossaryService = new GlossaryService();
    const project = await glossaryService.getProject({
      coverID: coverID.toString(),
      library,
    });
    const { uuid: userID } = req.user.decoded;
    const user = await User.findOne({ uuid: { $eq: userID } }).orFail();
    const isSuperAdmin = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "superadmin",
      true,
    );
    if (!project && !isSuperAdmin) {
      return res.status(404).send({ err: true, errMsg: "Project not found for this book." });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canAccess && !isSuperAdmin) {
      throw new Error(conductorErrors.err8);
    }

    await glossaryService.deleteBookGlossary({
      coverID: coverID.toString(),
      library,
    });
    return res.send({ err: false, msg: "Glossary deleted successfully." });
  } catch (err) {
    logger.error({ err }, "deleteBookGlossary failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}


async function deleteBookGlossaryUsage(
  req: ZodReqWithUser<z.infer<typeof deleteWithUsageIDParamSchema>>,
  res: Response,
) {
  const { usageID, pageID } = req.params;
  try {
    const glossaryService = new GlossaryService();
    const project = await glossaryService.getProjectByUsageID(usageID.toString());
    const { uuid: userID } = req.user.decoded;
    const user = await User.findOne({ uuid: { $eq: userID } }).orFail();
    const isSuperAdmin = authAPI.checkHasRole(
      req.user,
      "libretexts",
      "superadmin",
      true,
    );
    if (!project && !isSuperAdmin) {
      return res.status(404).send({ err: true, errMsg: "Project not found for this book." });
    }
    const canAccess = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canAccess && !isSuperAdmin) {
      throw new Error(conductorErrors.err8);
    }
    await glossaryService.deleteGlossaryUsage(usageID, pageID?.toString() || undefined);
    return res.send({ err: false, msg: "Glossary usage deleted successfully." });
  }
  catch (err) {

    return res.status(500).send({ err: true, errMsg: "Failed to delete glossary usage." });
  }
}
async function getGlossaryPage(
  req: ZodReqWithOptionalUser<z.infer<typeof getWithPageIDParamAndLibraryParamSchema>>,
  res: Response,
) {
  const { pageID, library } = req.params;
  try {
    const glossaryService = new GlossaryService();
    const glossary = await glossaryService.getGlossaryPage(pageID, library);
    return res.send({ err: false, data: glossary });
  }
  catch (err) {
    logger.error({ err }, "getGlossaryPage failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function getGlossaryDetails(
  req: ZodReqWithOptionalUser<z.infer<typeof getWithPageIDParamAndLibraryParamSchema>>,
  res: Response,
) {
  const { pageID, library } = req.params;
  try {
    const glossaryService = new GlossaryService();
    const glossaryDetails = await glossaryService.getGlossaryDetails(pageID, library);
    return res.send({ err: false, ...glossaryDetails })
  }
  catch (err) {
    logger.error({ err }, "getGlossaryDetails failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}
async function addExternalGlossaryToGlossaryUsage(
  req: ZodReqWithUser<z.infer<typeof readFromCxOneGlossaryAndAddToGlossaryUsageSchema>>,
  res: Response,
) {
  try {
    const { glossaryID } = req.body;
    const { library, coverID } = req.params;
    const { auxGlossaryID, auxGlossaryParentID } = req.body;
    const glossaryService = new GlossaryService();
    if (!auxGlossaryID && !auxGlossaryParentID) {
      const result = await glossaryService.addExternalGlossaryToGlossaryUsage(glossaryID.toString(), coverID.toString(), library, req.user.decoded.uuid);
      return res.send({ err: false, msg: "External glossary added to glossary usage successfully.", data: result });
    }
    else if (auxGlossaryID) {
      const result = await glossaryService.addExternalAuxGlossaryToGlossaryUsage(glossaryID.toString(), coverID.toString(), library, req.user.decoded.uuid, auxGlossaryID.toString(), auxGlossaryParentID?.toString());
      return res.send({ err: false, msg: "External glossary added to glossary usage successfully.", data: result });
    }
    else {
      throw new Error("Invalid request.");
    }
  }
  catch (err) {
    logger.error({ err }, "addExternalGlossaryToGlossaryUsage failed");
    return res.status(500).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

async function glossaryImageUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const config = multer({
    storage: memoryStorage(),
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("notimagefile"));
      }
      return cb(null, true);
    },
  }).single("image");

  return config(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err6;
      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        errMsg = conductorErrors.err60;
      }
      if (err.message === "notimagefile") {
        errMsg = conductorErrors.err55;
      }
      return res.status(400).send({ err: true, errMsg });
    }
    return next();
  });
}

async function getGlossaryUsageImage(
  req: ZodReqWithOptionalUser<z.infer<typeof getWithUsageIDParamSchema>>,
  res: Response,
) {
  try {
    const { usageID } = req.params;
    const glossaryService = new GlossaryService();
    const { data, contentType } =
      await glossaryService.getGlossaryUsageImage(usageID);
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    return res.send(data);
  } catch (err) {
    logger.error({ err }, "getGlossaryUsageImage failed");
    return res.status(404).send({ err: true, errMsg: conductorErrors.err6 });
  }
}

export default {
  syncWithLibraries,
  getCoverIdByUrl,
  runAutomatedSyncWithLibraries,
  getCommonsCatalog,
  getMasterCatalog,
  getMasterCatalogV2,
  checkBookTitleAvailability,
  createBook,
  importPressBooksBook,
  getPressBooksImportJobStatus,
  getActivePressBooksImportJob,
  deleteBook,
  getBookDetail,
  getBookPeerReviews,
  getCatalogFilterOptions,
  addBookToCustomCatalog,
  removeBookFromCustomCatalog,
  excludeBookFromAutoMatch,
  downloadBookFile,
  getBookTOC,
  getLicenseReport,
  getBookPagesDetails,
  getPageDetail,
  updatePageDetails,
  bulkUpdatePageTags,
  retrieveKBExport,
  syncWithSearchIndex,
  syncBooksInBackground,
  getGlossaryTermSearch,
  addBookGlossary,
  getBookGlossary,
  deleteBookGlossary,
  deleteBookGlossaryUsage,
  getGlossaryPage,
  getGlossaryDetails,
  glossaryImageUploadHandler,
  getGlossaryUsageImage,
  addPageToGlossaryUsage,
  addExternalGlossaryToGlossaryUsage,
};
