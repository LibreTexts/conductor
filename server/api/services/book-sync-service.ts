import axios from "axios";
import { debugCommonsSync, debugError } from "../../debug.js";
import Book, { BookInterface } from "../../models/book.js";
import Library from "../../models/library.js";
import { isEmptyString } from "../../util/helpers.js";
import {
  sanitizeLibraryText,
  sanitizeOptionalLibraryText,
} from "../../util/sanitize-text.js";
import {
  genBookstoreLink,
  genLMSFileLink,
  genPDFLink,
  genPubFilesLink,
  genThumbnailLink,
  genZIPLink,
  getLibraryAndPageFromBookID,
  hashStringToFloat,
} from "../../util/bookutils.js";
import { mapWithConcurrency } from "../../util/concurrency.js";
import LibrarySyncService, {
  LibraryCoverpage,
} from "./library-sync-service.js";
import { upsertBookToSearchIndex } from "./book-search-service.js";

/**
 * A Book as assembled from a library coverpage, ready for upsert.
 */
export type SyncedBook = Pick<BookInterface, "bookID" | "title" | "library"> &
  Partial<
    Pick<
      BookInterface,
      | "author"
      | "affiliation"
      | "subject"
      | "location"
      | "course"
      | "program"
      | "license"
      | "summary"
      | "thumbnail"
      | "thumbnailIsAnimated"
      | "links"
      | "lastUpdated"
      | "libraryTags"
    >
  >;

/**
 * The library root a Book lives under determines where Commons files it.
 */
export const LOCATION_BY_SYNC_ROOT: Record<string, string> = {
  Bookshelves: "central",
  Courses: "campus",
};

/**
 * Turns a library path segment into a display label. Segments are underscored
 * and occasionally percent-encoded.
 */
export const readPathSegment = (segment: string) => {
  const spaced = segment.replace(/_/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    // A stray '%' that isn't a valid escape — use the segment as-is.
    return spaced;
  }
};

/**
 * Maps a coverpage discovered by {@link LibrarySyncService} onto a Book.
 *
 * Subject/course come from the coverpage's `path`, which is host-free and
 * already decoded — the legacy sync parsed them out of the full URL by string-
 * replacing a reconstructed base URL.
 */
export const toBookRecord = (
  subdomain: string,
  coverpage: LibraryCoverpage,
): SyncedBook => {
  const bookID = `${subdomain}-${coverpage.id}`;

  let location = "";
  let subject = "";
  let course = "";

  const segments = (coverpage.path ?? "").split("/").filter(Boolean);
  const root = segments[0];
  if (root && LOCATION_BY_SYNC_ROOT[root]) {
    location = LOCATION_BY_SYNC_ROOT[root];
    const label = segments[1] ? sanitizeLibraryText(readPathSegment(segments[1])) : "";
    if (location === "central") {
      subject = label;
    } else {
      course = label;
    }
  } else {
    location = "central"; // If the root isn't recognized, default to central.
  }

  let license = "";
  let program = "";
  coverpage.tags.forEach((tag) => {
    if (tag.startsWith("license:")) {
      license = sanitizeLibraryText(tag.replace("license:", ""));
    }
    if (tag.startsWith("program:")) {
      program = sanitizeLibraryText(tag.replace("program:", ""));
    }
  });

  // Title, author, affiliation, and summary are sanitized by LibrarySyncService
  // as it builds the coverpage. Re-running the sanitizer here is idempotent and
  // keeps this mapping safe on its own terms.
  return {
    bookID,
    title: sanitizeLibraryText(coverpage.title),
    library: subdomain,
    author: sanitizeOptionalLibraryText(coverpage.author),
    affiliation: sanitizeOptionalLibraryText(coverpage.affiliation),
    subject,
    location,
    course,
    program,
    license,
    summary: sanitizeOptionalLibraryText(coverpage.summary),
    thumbnail: genThumbnailLink(subdomain, coverpage.id),
    links: {
      online: coverpage.url,
      pdf: genPDFLink(bookID),
      buy: genBookstoreLink(bookID),
      zip: genZIPLink(bookID),
      files: genPubFilesLink(bookID),
      lms: genLMSFileLink(bookID),
    },
    lastUpdated: coverpage.dateModified,
    // Tags are rendered on Commons, so the stored copy is sanitized. The raw
    // tags stay on the coverpage for the parsing above and in the service.
    libraryTags: coverpage.tags
      .map((tag) => sanitizeLibraryText(tag))
      .filter(Boolean),
  };
};

/**
 * Checks that a mapped Book has the required fields to be imported.
 * @returns {Boolean} True if ready for import, false otherwise (logged).
 */
export const checkValidImport = (book: SyncedBook) => {
  // NB: isEmptyString() returns false for undefined, so check truthiness too.
  const missing = (["bookID", "title", "library"] as const).filter(
    (field) => !book[field] || isEmptyString(book[field]),
  );
  if (missing.length > 0) {
    debugCommonsSync(
      `Not importing 1 book — missing fields: ${missing.join(",")}`,
    );
    return false;
  }
  return true;
};

/**
 * How many thumbnail HEAD requests may be in flight at once.
 *
 * The reuse short-circuit below keeps steady-state runs almost free, but the
 * first run after a deploy has no stored results to reuse and would otherwise
 * open one request per book — thousands at once, against a handful of library
 * hosts.
 */
export const THUMBNAIL_HEAD_CONCURRENCY = 8;

/**
 * Detects animated thumbnails (GIFs and friends) via HEAD requests, with
 * bounded concurrency. Server-side requests avoid the CORS restrictions that
 * block client-side detection.
 */
export const detectAnimatedThumbnails = async (
  books: SyncedBook[],
  existingBooks: Map<string, { thumbnail?: string; thumbnailIsAnimated?: boolean }>,
) => {
  const ANIMATED_TYPES = [
    "image/gif",
    "image/webp",
    "image/apng",
    "image/avif",
  ];

  await mapWithConcurrency(
    books,
    THUMBNAIL_HEAD_CONCURRENCY,
    async (book) => {
      if (!book.thumbnail) return;

      // Short-circuit: URL clearly identifies a GIF
      if (/\.gif(\?|$)/i.test(book.thumbnail)) {
        book.thumbnailIsAnimated = true;
        return;
      }

      // Skip the HEAD request if the thumbnail URL hasn't changed and we
      // already have a detection result from a previous sync cycle
      const existing = existingBooks.get(book.bookID);
      if (
        existing &&
        existing.thumbnail === book.thumbnail &&
        existing.thumbnailIsAnimated !== undefined
      ) {
        book.thumbnailIsAnimated = existing.thumbnailIsAnimated;
        return;
      }

      try {
        const headRes = await axios.head(book.thumbnail, { timeout: 5000 });
        const contentType = headRes.headers["content-type"];
        if (
          typeof contentType === "string" &&
          ANIMATED_TYPES.includes(contentType.toLowerCase())
        ) {
          book.thumbnailIsAnimated = true;
        }
      } catch {
        // Request failed — leave thumbnailIsAnimated unset
      }
    },
  );
};

/**
 * The single write that turns a mapped coverpage into a stored Book.
 *
 * Shared by the full library walk and the single-book refresh so the two can
 * never drift into writing different field sets for the same coverpage.
 *
 * `syncedAt` is passed in rather than stamped here: the bulk sync needs every
 * Book in a run to carry the run's *start* time, so missing-book detection can
 * find everything the run did not touch with a single range query.
 *
 * Deliberately does not touch `exportInfo`. Compilation status is owned by the
 * Shapeshift webhook, which writes it under its own conditional guard.
 */
export const buildBookUpsertOp = (book: SyncedBook, syncedAt: Date) => ({
  updateOne: {
    filter: { bookID: book.bookID },
    update: {
      $setOnInsert: { bookID: book.bookID },
      $set: {
        title: book.title,
        author: book.author,
        affiliation: book.affiliation,
        library: book.library,
        subject: book.subject,
        location: book.location,
        course: book.course,
        program: book.program,
        license: book.license,
        thumbnail: book.thumbnail,
        thumbnailIsAnimated: !!book.thumbnailIsAnimated,
        summary: book.summary,
        links: book.links,
        lastUpdated: book.lastUpdated,
        libraryTags: book.libraryTags,
        randomIndex: hashStringToFloat(book.bookID),
        lastSyncedAt: syncedAt,
        // Marks this record as written by the direct library walk rather
        // than the retired nodePrint DownloadsCenter import. Untouched
        // Books keep an absent `syncedBy`, so the two are separable while
        // their field values are being compared.
        syncedBy: "conductor" as const,
      },
      // The Book is present in its library again.
      $unset: { syncMissingSince: "" },
    },
    upsert: true,
  },
});

/**
 * What a single-book sync did, for logging and for the caller's follow-up.
 *
 * `ingested` means a Book document was created — the caller may need to apply
 * data it was holding for a record that did not exist a moment ago.
 */
export type SingleBookSyncOutcome =
  | { status: "ingested" | "refreshed" }
  | { status: "skipped" | "marked_missing" | "error"; reason: string };

/**
 * Fetches one book live from its library and writes it to Commons.
 *
 * This is the incremental counterpart to the nightly walk in
 * `runLibrarySync`: same eligibility rules, same mapping, same upsert — for a
 * single coverpage instead of every coverpage in every library. A book that
 * does not yet exist locally is created; one that does is refreshed.
 *
 * A book that fails eligibility is never written. If it is already stored, it
 * is marked with `syncMissingSince` — the same marker the bulk walk sets for a
 * book that has vanished from its library.
 */
export const syncSingleBook = async (
  bookID: string,
): Promise<SingleBookSyncOutcome> => {
  try {
    const [subdomain, coverID] = getLibraryAndPageFromBookID(bookID);
    if (isEmptyString(subdomain) || isEmptyString(coverID)) {
      return { status: "skipped", reason: `"${bookID}" is not a valid bookID.` };
    }

    // Same predicate the bulk walk selects libraries with — a library Commons
    // does not sync from cannot gain books through this path either.
    const library = await Library.findOne({
      subdomain,
      hidden: false,
      syncSupported: true,
    });
    if (!library) {
      return {
        status: "skipped",
        reason: `${subdomain} is not a synced library.`,
      };
    }

    const found = await new LibrarySyncService().syncSingleCoverpage(
      library,
      coverID,
    );

    if (!found.ok) {
      if (found.reason === "error") {
        return {
          status: "error",
          reason: `Could not reach ${subdomain} to sync ${bookID}.`,
        };
      }

      /* The page is gone or no longer publishable. Absence is only actionable
         for a book Commons already lists; an unknown ineligible page is simply
         not a book. */
      const marked = await Book.updateOne(
        { bookID: { $eq: bookID }, syncMissingSince: { $exists: false } },
        { $set: { syncMissingSince: new Date() } },
      );
      if (marked.modifiedCount > 0) {
        debugCommonsSync(
          `Marked ${bookID} missing — live fetch reported ${found.reason}.`,
        );
        /* Upsert, not remove: it re-reads the Book and deletes only if the
           aggregation still yields nothing, so a concurrent restore cannot be
           undone by a delete decided a moment earlier. Fire-and-forget per the
           contract on these helpers — the Book is already marked, so a
           Meilisearch hiccup leaves a stale document until the next re-sync
           prunes it, not a failed sync. */
        void upsertBookToSearchIndex(bookID);
        return { status: "marked_missing", reason: found.reason };
      }
      return { status: "skipped", reason: found.reason };
    }

    const book = toBookRecord(subdomain, found.coverpage);
    if (!checkValidImport(book)) {
      return {
        status: "skipped",
        reason: `${bookID} is missing fields required for import.`,
      };
    }

    /* Seeds the same reuse short-circuit the bulk run relies on, so an
       unchanged thumbnail costs no HEAD request. */
    const existing = await Book.findOne(
      { bookID: { $eq: bookID } },
      { _id: 0, bookID: 1, thumbnail: 1, thumbnailIsAnimated: 1 },
    ).lean();
    await detectAnimatedThumbnails(
      [book],
      new Map(existing ? [[existing.bookID, existing]] : []),
    );

    const { updateOne } = buildBookUpsertOp(book, new Date());
    const res = await Book.updateOne(
      updateOne.filter,
      updateOne.update,
      { upsert: true },
    );

    const status = (res.upsertedCount ?? 0) > 0 ? "ingested" : "refreshed";
    debugCommonsSync(`Live sync ${status} ${bookID}.`);

    /* Same fire-and-forget contract. This is also what puts a book that came
       back — the upsert above `$unset`s `syncMissingSince` — into the index
       again without waiting for the nightly walk. */
    void upsertBookToSearchIndex(bookID);

    return { status };
  } catch (err) {
    debugError(err);
    return {
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
};
