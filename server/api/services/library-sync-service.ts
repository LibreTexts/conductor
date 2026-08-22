import { debugError, debugCommonsSync } from "../../debug.js";
import Library, { LibraryInterface } from "../../models/library.js";
import { AuthorInterface } from "../../models/author.js";
import Expert from "../../util/ExpertWithSSM.js";
import type {
  default as ExpertClient,
  PageBase,
  PageTag,
  Tags,
} from "@libretexts/cxone-expert-node";
import AuthorService from "./author-service.js";
import CXOnePageProperties from "../../util/CXOne/CXOnePageProperties.js";
import { sanitizeOptionalLibraryText } from "../../util/sanitize-text.js";
import { mapWithConcurrency } from "../../util/concurrency.js";

/** CXOne returns repeated elements as object | array | "" depending on cardinality. */
function toArray<T>(value: T | T[] | "" | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type FoundPage = Partial<PageBase> & Partial<Tags>;

/**
 * Tag titles for a page returned by `/find?include=tags`. The SDK types the
 * result as `PageBase & Tags` (tags flattened onto the page), but the wire
 * format nests them under `tags`. Read both.
 */
function tagTitles(page: FoundPage): string[] {
  const nested = (page as { tags?: Partial<Tags> | "" }).tags;
  const raw: (Partial<PageTag> | "")[] = [
    ...toArray(page.tag),
    ...toArray(nested ? nested.tag : undefined),
  ];
  return raw
    .map((t) => (t ? t.title : undefined))
    .filter((t): t is string => typeof t === "string");
}

/**
 * Tag marking a page as the cover of a LibreText.
 *
 * `coverpage:nocommons` is deliberately not queried. The legacy nodePrint walk
 * collected those pages because its PDF pipeline needed them, but the Commons
 * ingest has always discarded them — so fetching them only to filter them out
 * doubles the request count for nothing.
 */
const COVERPAGE_TAG = "coverpage:yes";

/**
 * Path segments naming scratch content that must never reach Commons.
 *
 * These subtrees hold in-progress and personal drafts. They deny anonymous
 * browsing but are readable by the authenticated API user this sync runs as, so
 * neither the `coverpage:yes` tag nor a `Public` page restriction is enough to
 * keep them out — a draft carrying a coverpage tag would otherwise sync cleanly.
 *
 * Compared as whole segments, case-insensitively, so a published book whose own
 * title contains one of these words (`Bookshelves/Physics/Physics_Workbench`)
 * is unaffected. Stored lowercase; see {@link pathSegments}.
 */
const EXCLUDED_PATH_SEGMENTS = new Set(["sandboxes", "workbench"]);

/**
 * Splits a page path or URL into lowercased, percent-decoded segments.
 *
 * Works on both shapes: a bare `Courses/Alma_College/Book` path and a full
 * `uri.ui`, whose scheme and host simply become segments that match nothing.
 */
function pathSegments(value: string): string[] {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment).toLowerCase();
      } catch {
        // A stray '%' that isn't a valid escape — compare the raw segment.
        return segment.toLowerCase();
      }
    });
}

/**
 * True if a page lives in — or anywhere under — a scratch location.
 */
function isExcludedLocation(page: FoundPage): boolean {
  // `path` is `"" | Partial<PagePath>` on the wire, so it needs a truthiness
  // guard rather than optional chaining.
  const path = page.path ? page.path["#text"] ?? "" : "";
  const segments = [
    ...pathSegments(path),
    ...pathSegments(page["uri.ui"] ?? ""),
  ];
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

/**
 * True if a page path sits at or beneath one of a library's sync roots.
 *
 * The bulk walk gets this for free — it only ever searches beneath
 * `syncLocations`. A page fetched directly by ID has not been constrained that
 * way, so the check has to be explicit: without it a coverpage in an unsynced
 * subtree would be ingested and then silently filed as `location: "central"` by
 * the record mapping.
 *
 * Compared segment-wise so `Coursework/X` does not match a `Courses` root.
 */
function isUnderSyncRoot(path: string, roots: string[]): boolean {
  const segments = pathSegments(path);
  return roots.some((root) => {
    const rootSegments = pathSegments(root);
    if (rootSegments.length === 0 || rootSegments.length > segments.length) {
      return false;
    }
    return rootSegments.every((segment, i) => segments[i] === segment);
  });
}

/**
 * CXOne restrictions whose pages are readable by an anonymous visitor, and so
 * belong on Commons. Verified live: `Semi-Public` coverpages return 200 to an
 * unauthenticated request on both the API and the public site.
 */
const PUBLIC_RESTRICTIONS = new Set(["Public", "Semi-Public"]);

/** Restrictions known to be private — skipped quietly rather than logged. */
const UNLISTED_RESTRICTIONS = new Set(["Private", "Semi-Private"]);

/**
 * How many times a truncated search may be split into child subtrees.
 *
 * CXOne caps `/pages/{id}/find` at 1000 results and does not paginate it.
 * `page`, `limit`, and `offset` are accepted without error but have no effect —
 * against a 1028-result query, every combination (including `page=99` and
 * `page=0`) returned a byte-identical list of 1000 IDs. Accepting the parameter
 * is not the same as honoring it; don't spend time re-testing this.
 *
 * `/site/search` does paginate, but its adaptive ranking shifts between
 * requests: walking chem's 655 coverpages there yielded only 611 distinct IDs,
 * silently dropping 44. It also omits `restriction`.
 *
 * Splitting the search by subtree is therefore the only lossless option. Three
 * levels is far more than the libraries need — a library root splits into
 * campuses or shelves, which are individually well under the cap.
 */
const MAX_FIND_SPLIT_DEPTH = 3;

/** Delay between page-property requests. See {@link createThrottle}. */
const SUMMARY_REQUEST_INTERVAL_MS = 500;

/** How many property requests may be in flight at once. */
const SUMMARY_CONCURRENCY = 4;

export type LibraryCoverpage = {
  id: string;
  title?: string;
  path?: string;
  url?: string;
  tags: string[];
  dateModified?: string;
  author?: string;
  affiliation?: string;
  summary?: string;
};

/**
 * A library's coverpages, plus whether the walk that found them saw everything.
 *
 * `complete: false` means the search was truncated — the pages returned are
 * real, but absence from the list proves nothing. Callers that act on absence
 * (missing-book detection, and any future reaper) MUST check it: a truncated
 * walk that is treated as authoritative flags live books as gone.
 */
export type LibrarySyncResult =
  | {
      ok: true;
      subdomain: string;
      complete: boolean;
      coverpages: LibraryCoverpage[];
    }
  | { ok: false; subdomain: string; error: string };

/** Coverpages found beneath one root, and whether that search was exhaustive. */
type FindResult = { pages: FoundPage[]; complete: boolean };

/**
 * Caps that shrink a sync run down to something you can watch end-to-end.
 *
 * A full run walks every library and makes one throttled request per book, so
 * verifying a change otherwise means waiting the better part of an hour. These
 * are read from the environment rather than hardcoded so a narrowed run can
 * never be committed by accident:
 *
 * - `LIBRARY_SYNC_ONLY` — comma-separated subdomains, e.g. `chem,espanol`
 * - `LIBRARY_SYNC_MAX_LIBRARIES` — take only the first N libraries
 * - `LIBRARY_SYNC_MAX_BOOKS_PER_LIBRARY` — take only the first N books each
 *
 * A limited run is NOT a complete picture of any library, so callers must not
 * act on absence — see {@link isLimitedSync}.
 */
export type LibrarySyncLimits = {
  only?: string[];
  maxLibraries?: number;
  maxBooksPerLibrary?: number;
};

/**
 * Reads a positive integer env var.
 *
 * Throws rather than falling back to "unlimited": setting this variable at all
 * means the operator wanted a short run, and silently promoting a typo into a
 * full sync would run for the better part of an hour and mutate the catalog.
 */
function readPositiveInt(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `${name}="${raw}" is not a positive integer. Fix it or unset it — ` +
      `refusing to fall back to a full sync.`
    );
  }
  return value;
}

export function getLibrarySyncLimits(): LibrarySyncLimits {
  const only = process.env.LIBRARY_SYNC_ONLY?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    only: only && only.length > 0 ? only : undefined,
    maxLibraries: readPositiveInt("LIBRARY_SYNC_MAX_LIBRARIES"),
    maxBooksPerLibrary: readPositiveInt("LIBRARY_SYNC_MAX_BOOKS_PER_LIBRARY"),
  };
}

/**
 * True when the run covers less than everything.
 *
 * Callers that prune or flag Books by absence MUST check this: under a limit,
 * "not in the batch" means "not looked for", not "gone from the library".
 */
export function isLimitedSync(limits: LibrarySyncLimits): boolean {
  return Boolean(limits.only || limits.maxLibraries || limits.maxBooksPerLibrary);
}

/** Human-readable description of the active limits, for logs and responses. */
export function describeLimits(limits: LibrarySyncLimits): string {
  const first = (n: number, singular: string, plural: string) =>
    `first ${n} ${n === 1 ? singular : plural}`;

  const parts: string[] = [];
  if (limits.only) parts.push(`only ${limits.only.join(", ")}`);
  if (limits.maxLibraries) {
    parts.push(first(limits.maxLibraries, "library", "libraries"));
  }
  if (limits.maxBooksPerLibrary) {
    parts.push(`${first(limits.maxBooksPerLibrary, "book", "books")} per library`);
  }
  return parts.join("; ");
}

/**
 * Spaces the *start* of every task at least `intervalMs` apart.
 *
 * One throttle is shared across the whole sync, so it — not the concurrency
 * window — sets throughput. A per-library throttle would run 16 of these in
 * parallel and multiply the intended request rate.
 *
 * Slots are reserved synchronously, so concurrent callers each get a distinct
 * start time rather than racing for the same one.
 *
 * Every library request in a run passes through here, which makes this the one
 * place cancellation has to be honored: once `signal` aborts, no further
 * request is issued and the in-flight ones unwind through their callers, so an
 * abandoned run stops walking instead of grinding on unwatched.
 */
function createThrottle(intervalMs: number, signal?: AbortSignal) {
  let nextStart = 0;
  return async <T>(task: () => Promise<T>): Promise<T> => {
    signal?.throwIfAborted();
    const now = Date.now();
    const start = Math.max(now, nextStart);
    nextStart = start + intervalMs;
    if (start > now) {
      await new Promise((resolve) => setTimeout(resolve, start - now));
      // The wait can outlast the abort, so re-check rather than firing a
      // request the caller has already given up on.
      signal?.throwIfAborted();
    }
    return task();
  };
}

type Throttle = ReturnType<typeof createThrottle>;

/**
 * Shared by every single-book sync in the process.
 *
 * Single-book syncs arrive from webhooks, so their rate is set by whatever is
 * compiling books rather than by a loop this code controls. One module-level
 * throttle keeps a burst of deliveries spaced the same way the bulk walk spaces
 * its requests; a per-call throttle would space nothing at all.
 */
const singleFetchThrottle = createThrottle(SUMMARY_REQUEST_INTERVAL_MS);

/** How long a single-book sync may reuse an already-built author index. */
const AUTHOR_INDEX_TTL_MS = 5 * 60 * 1000;

let cachedAuthorIndex: { index: AuthorIndex; builtAt: number } | null = null;

/** Author/institution lookup, built once per sync run rather than per book. */
type AuthorIndex = {
  byNameKey: Map<string, AuthorInterface>;
  byName: Map<string, AuthorInterface>;
};

const EMPTY_AUTHOR_INDEX: AuthorIndex = {
  byNameKey: new Map(),
  byName: new Map(),
};

/**
 * Delimiters the `lulu` publishing tag is written with. All three appear in the
 * libraries; the legacy walk accepted each.
 */
const LULU_DELIMITERS = ["@", "|", ","] as const;

/**
 * Cleans one field of a `lulu` tag.
 *
 * A backslash inside a segment is a legacy line-break marker: a title was
 * authored as `Athabasca University\Chemistry 350\Organic Chemistry I` to
 * control where it wrapped on a printed cover. Nothing downstream renders those
 * breaks, so they collapse to spaces — storing them verbatim yields a title no
 * search or sort can match.
 */
function cleanLuluSegment(segment: string | undefined): string | undefined {
  return segment?.replace(/\\/g, " ").trim() || undefined;
}

/**
 * Pulls title and authorship hints out of a coverpage's tags.
 *
 * Three conventions coexist in the libraries:
 * - `lulu@Title@Author@Institution@SpineTitle` — the explicit publishing
 *   override, also written with `|` or `,` as the delimiter.
 * - `authorname:<slug>` — a reference into an author directory.
 * - `author@<Name> (<Institution>)` — a display string.
 */
function parsePublishingTags(tags: string[]): {
  luluTitle?: string;
  luluAuthor?: string;
  luluAffiliation?: string;
  nameKey?: string;
  authorLiteral?: string;
} {
  const parsed: ReturnType<typeof parsePublishingTags> = {};

  for (const rawTag of tags) {
    if (!rawTag) continue;
    // The legacy walk unescaped doubled backslashes before splitting.
    const tag = rawTag.replace(/\\\\/g, "\n");

    const delimiter = LULU_DELIMITERS.find((d) => tag.startsWith(`lulu${d}`));
    if (delimiter) {
      // [0] "lulu", [1] title, [2] author, [3] institution, [4] spine title
      const parts = tag.split(delimiter);
      parsed.luluTitle = cleanLuluSegment(parts[1]) || parsed.luluTitle;
      parsed.luluAuthor = parts[2]?.trim() || parsed.luluAuthor;
      parsed.luluAffiliation = parts[3]?.trim() || parsed.luluAffiliation;
      continue;
    }

    if (tag.startsWith("authorname:")) {
      parsed.nameKey = tag.slice("authorname:".length).trim() || parsed.nameKey;
      continue;
    }

    if (tag.startsWith("author@")) {
      parsed.authorLiteral =
        tag.slice("author@".length).trim() || parsed.authorLiteral;
    }
  }

  return parsed;
}

/**
 * Splits `Jane Doe (Some College)` into its name and institution. The `author@`
 * tag is written this way throughout the libraries.
 */
function splitAuthorLiteral(literal: string): {
  author: string;
  affiliation?: string;
} {
  const match = literal.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { author: literal };
  return { author: match[1].trim(), affiliation: match[2].trim() || undefined };
}

/**
 * Resolves author and affiliation from tags.
 *
 * `lulu` wins because it is the explicit per-book override. Failing that, an
 * `authorname:`/`author@` tag is looked up in Conductor's own Authors
 * collection — the legacy resolver
 * (`api.libretexts.org/endpoint/getAuthors/{lib}`) now returns `{}`. If nothing
 * matches, the literal tag value is used so a book with authorship information
 * in its tags is never stored blank.
 */
function resolveAuthor(
  parsed: ReturnType<typeof parsePublishingTags>,
  index: AuthorIndex
): { author?: string; affiliation?: string } {
  const { luluAuthor, luluAffiliation, nameKey, authorLiteral } = parsed;

  if (luluAuthor) {
    return { author: luluAuthor, affiliation: luluAffiliation };
  }

  const literal = authorLiteral ? splitAuthorLiteral(authorLiteral) : undefined;
  const match =
    (nameKey ? index.byNameKey.get(nameKey.toLowerCase()) : undefined) ??
    (literal ? index.byName.get(literal.author.toLowerCase()) : undefined);

  if (match) {
    return {
      author: match.name,
      affiliation: match.campusName || literal?.affiliation,
    };
  }

  return literal ?? {};
}

/**
 * Discovers the LibreTexts published under a library.
 *
 * Replaces the legacy `nodePrint` refresh routine, which fetched the library's
 * `sitemap.xml`, rebuilt it into a tree, then walked that tree one page at a
 * time (with a 100ms delay per page) hydrating each node via the API just to
 * read its tags. Everything in that walk other than the coverpage tag check
 * existed to keep the traversal cheap and terminating.
 *
 * CXOne's `/pages/{id}/find?tags=` endpoint performs the same subtree search
 * server-side, so the traversal — and with it the topic-category descent, the
 * `coverpage:toc` skip, the Remixer University filter, and the restricted-page
 * sentinel — is no longer needed.
 *
 * `find` will not return page properties (`include=properties` is silently
 * ignored), so book summaries still cost one request each. Those are throttled;
 * see {@link createThrottle}.
 */
export default class LibrarySyncService {
  /**
   * Returns every coverpage beneath the given root.
   *
   * Throws on request failure. The caller needs to tell "this library has no
   * books" apart from "this library could not be reached" — Commons prunes
   * books that are absent from a sync, and a swallowed error here would look
   * exactly like an empty library.
   */
  private async findCoverpages(
    expert: ExpertClient,
    rootPath: string,
    subdomain: string,
    throttle: Throttle,
    depth = 0
  ): Promise<FindResult> {
    const res = await throttle(() =>
      expert.pages.getPageFind(rootPath, {
        tags: COVERPAGE_TAG,
        include: "tags",
      })
    );

    const count = Number(res["@count"] ?? 0);
    const total = Number(res["@totalcount"] ?? 0);
    const kept = this.dropScratchLocations(
      toArray(res.page),
      `${subdomain}/${rootPath}`
    );

    if (total <= count) return { pages: kept, complete: true };

    /* Truncated. Re-run the search against each child subtree so every branch
       stays under the cap, then union the results — the truncated set is still
       a valid subset, and keeping it covers the root page itself, which the
       child searches don't reach. */
    if (depth >= MAX_FIND_SPLIT_DEPTH) {
      debugError(
        `Coverpage search for ${subdomain}/${rootPath} is still truncated at ` +
        `${count} of ${total} after ${depth} splits. Some books were not synced.`
      );
      return { pages: kept, complete: false };
    }

    const children = await this.childPaths(expert, rootPath, throttle);
    if (children.length === 0) {
      debugError(
        `Coverpage search for ${subdomain}/${rootPath} returned ${count} of ` +
        `${total} results and has no subpages to split on. ` +
        `Some books were not synced.`
      );
      return { pages: kept, complete: false };
    }

    debugCommonsSync(
      `Splitting ${subdomain}/${rootPath} across ${children.length} subtrees ` +
      `(${count} of ${total} results returned).`
    );

    const nested = await Promise.all(
      children.map((child) =>
        this.findCoverpages(expert, child, subdomain, throttle, depth + 1)
      )
    );

    const byID = new Map<string, FoundPage>();
    for (const page of [...kept, ...nested.flatMap((n) => n.pages)]) {
      const id = page["@id"];
      if (id) byID.set(id, page);
    }
    // One truncated branch makes the whole subtree non-authoritative.
    return {
      pages: [...byID.values()],
      complete: nested.every((n) => n.complete),
    };
  }

  /**
   * Paths of a page's direct children, used to split an oversized search.
   *
   * Scratch subtrees are dropped here too, so a `Sandboxes` branch is never
   * recursed into.
   */
  private async childPaths(
    expert: ExpertClient,
    path: string,
    throttle: Throttle
  ): Promise<string[]> {
    const res = await throttle(() =>
      expert.pages.getPageSubpages(path, { limit: "all" })
    );

    return toArray(res["page.subpage"])
      .filter((page) => !isExcludedLocation(page))
      .map((page) => (page.path ? page.path["#text"] : undefined))
      .filter((p): p is string => typeof p === "string" && p.length > 0);
  }

  /**
   * Removes pages in scratch locations. Every coverpage passes through here
   * before anything downstream can see it.
   */
  private dropScratchLocations(pages: FoundPage[], label: string): FoundPage[] {
    const kept = pages.filter((page) => !isExcludedLocation(page));
    if (kept.length < pages.length) {
      debugCommonsSync(
        `Excluded ${pages.length - kept.length} page(s) in scratch locations ` +
        `from ${label}.`
      );
    }
    return kept;
  }

  /**
   * Excludes pages the API surfaced but that shouldn't be synced.
   *
   * `find` runs as the authenticated API user, who can see more than an
   * anonymous visitor, so restriction is checked against an allow-list rather
   * than a deny-list: an unrecognized restriction is treated as non-public and
   * logged, because wrongly publishing a restricted book to Commons is worse
   * than wrongly omitting one. `Semi-Public` is included — those pages are
   * readable anonymously and have always been listed on Commons.
   */
  private isSyncable(page: FoundPage, subdomain: string): boolean {
    if (page["@deleted"] === "true") return false;

    const restriction = page.restriction;
    if (!restriction) {
      debugError(`Skipping ${subdomain} page ${page["@id"]}: no restriction property.`);
      return false;
    }

    if (PUBLIC_RESTRICTIONS.has(restriction)) return true;
    if (UNLISTED_RESTRICTIONS.has(restriction)) return false;

    debugError(
      `Skipping ${subdomain} page ${page["@id"]}: unrecognized restriction ` +
      `"${restriction}". Add it to PUBLIC_RESTRICTIONS if it is publicly readable.`
    );
    return false;
  }

  private toCoverpage(page: FoundPage, index: AuthorIndex): LibraryCoverpage | null {
    const id = page["@id"];
    if (!id) return null;

    const tags = tagTitles(page);
    // Tag parsing reads the tags verbatim — the `lulu` delimiters and
    // `authorname:` slugs are structure, not display text. Only the values it
    // produces are sanitized.
    const parsed = parsePublishingTags(tags);
    const { author, affiliation } = resolveAuthor(parsed, index);
    return {
      id,
      // A `lulu` tag is the explicit per-book override, so its title wins over
      // the page title for the same reason its author does.
      title:
        sanitizeOptionalLibraryText(parsed.luluTitle) ??
        sanitizeOptionalLibraryText(page.title),
      path: page.path ? page.path["#text"] : undefined,
      url: page["uri.ui"],
      tags,
      dateModified: page["date.modified"],
      author: sanitizeOptionalLibraryText(author),
      affiliation: sanitizeOptionalLibraryText(affiliation),
    };
  }

  /**
   * Reads a coverpage's overview property, which becomes the book's summary.
   *
   * A book without an overview is normal, so a 404 is not worth logging.
   */
  private async fetchSummary(
    expert: ExpertClient,
    coverpageID: string,
    throttle: Throttle
  ): Promise<string | undefined> {
    try {
      const overview = await throttle(() =>
        expert.pages.getPagePropertiesByKey(
          coverpageID,
          CXOnePageProperties.PageOverview
        )
      );
      // The overview property is authored in a rich-text editor, so it is the
      // one field that routinely arrives as markup.
      return typeof overview === "string"
        ? sanitizeOptionalLibraryText(overview)
        : undefined;
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status !== 404) {
        debugError(err);
      }
      return undefined;
    }
  }

  /** Indexes the Authors collection by slug and by display name. */
  private async buildAuthorIndex(): Promise<AuthorIndex> {
    try {
      const authors = await new AuthorService().getAllAuthors();
      const index: AuthorIndex = { byNameKey: new Map(), byName: new Map() };
      for (const author of authors) {
        if (author.nameKey) index.byNameKey.set(author.nameKey.toLowerCase(), author);
        if (author.name) index.byName.set(author.name.toLowerCase(), author);
      }
      return index;
    } catch (err) {
      // Author enrichment is not worth failing a sync over; `lulu` tags and
      // literal `author@` values still resolve without the index.
      debugError(err);
      return EMPTY_AUTHOR_INDEX;
    }
  }

  /**
   * The author index, reused across single-book syncs for a few minutes.
   *
   * A full walk builds one index and spends it over thousands of books, so the
   * cost is irrelevant there and it keeps building its own. A single-book sync
   * would otherwise read the whole Authors collection to enrich one record.
   */
  private async getCachedAuthorIndex(): Promise<AuthorIndex> {
    const now = Date.now();
    if (cachedAuthorIndex && now - cachedAuthorIndex.builtAt < AUTHOR_INDEX_TTL_MS) {
      return cachedAuthorIndex.index;
    }
    const index = await this.buildAuthorIndex();
    cachedAuthorIndex = { index, builtAt: now };
    return index;
  }

  /**
   * Fetches one coverpage live and applies the same eligibility rules the full
   * walk applies, so a book ingested this way is indistinguishable from one the
   * nightly sync would have produced.
   *
   * `find` supplies tags alongside each page; a direct fetch does not, so tags
   * are read separately and merged back into the shape the rest of this class
   * already understands.
   *
   * @param library - The library the coverpage belongs to.
   * @param coverpageID - The page's numeric library ID.
   */
  async syncSingleCoverpage(
    library: LibraryInterface,
    coverpageID: string,
  ): Promise<
    | { ok: true; coverpage: LibraryCoverpage }
    | { ok: false; reason: "not_found" | "ineligible" | "error" }
  > {
    const { subdomain } = library;

    let merged: FoundPage;
    let expert: ExpertClient;
    try {
      expert = await Expert.getInstance().forLibrary(subdomain);

      const [page, tags] = await Promise.all([
        singleFetchThrottle(() => expert.pages.getPage(coverpageID)),
        singleFetchThrottle(() => expert.pages.getPageTags(coverpageID)),
      ]);
      if (!page || !page["@id"]) return { ok: false, reason: "not_found" };

      // `tagTitles` reads both the flattened and the nested shape, so handing
      // it the tags response under `tags` needs no further translation.
      merged = { ...page, tags } as FoundPage;
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        return { ok: false, reason: "not_found" };
      }
      debugError(err);
      return { ok: false, reason: "error" };
    }

    try {
      if (!tagTitles(merged).includes(COVERPAGE_TAG)) {
        debugCommonsSync(
          `${subdomain} page ${coverpageID} is not tagged ${COVERPAGE_TAG}.`,
        );
        return { ok: false, reason: "ineligible" };
      }

      const path = merged.path ? merged.path["#text"] ?? "" : "";
      const roots = library.syncLocations ?? [];
      if (!isUnderSyncRoot(path, roots)) {
        debugCommonsSync(
          `${subdomain} page ${coverpageID} ("${path}") is not under a sync ` +
          `location (${roots.join(", ") || "none configured"}).`,
        );
        return { ok: false, reason: "ineligible" };
      }

      if (isExcludedLocation(merged)) {
        debugCommonsSync(
          `${subdomain} page ${coverpageID} is in a scratch location.`,
        );
        return { ok: false, reason: "ineligible" };
      }

      if (!this.isSyncable(merged, subdomain)) {
        return { ok: false, reason: "ineligible" };
      }

      const coverpage = this.toCoverpage(merged, await this.getCachedAuthorIndex());
      if (!coverpage) return { ok: false, reason: "ineligible" };

      coverpage.summary = await this.fetchSummary(
        expert,
        coverpage.id,
        singleFetchThrottle,
      );

      return { ok: true, coverpage };
    } catch (err) {
      debugError(err);
      return { ok: false, reason: "error" };
    }
  }

  /**
   * Collects every coverpage in a library, across all of its sync locations.
   *
   * Pass `context` when syncing several libraries so the request throttle and
   * author index are shared; called on its own, this builds throwaway ones.
   */
  async syncLibrary(
    library: LibraryInterface,
    context?: {
      throttle: Throttle;
      authorIndex: AuthorIndex;
      limits?: LibrarySyncLimits;
    }
  ): Promise<LibrarySyncResult> {
    const { subdomain } = library;

    try {
      const throttle =
        context?.throttle ?? createThrottle(SUMMARY_REQUEST_INTERVAL_MS);
      const authorIndex = context?.authorIndex ?? (await this.buildAuthorIndex());

      const roots = library.syncLocations;
      if (!roots || roots.length === 0) {
        throw new Error(`No sync locations configured for library ${subdomain}.`);
      }

      const expert = await Expert.getInstance().forLibrary(subdomain);

      const found = await Promise.all(
        roots.map((root) =>
          this.findCoverpages(expert, root, subdomain, throttle)
        )
      );
      let complete = found.every((f) => f.complete);
      if (!complete) {
        debugError(
          `Coverpage search for ${subdomain} was truncated. Its books will be ` +
          `synced, but absence from this run proves nothing, so missing-book ` +
          `detection is skipped for this library.`
        );
      }

      // Dedupe across roots: the Courses/Bookshelves subtrees can overlap via
      // moved or aliased pages.
      const byID = new Map<string, LibraryCoverpage>();
      for (const page of found.flatMap((f) => f.pages)) {
        if (!this.isSyncable(page, subdomain)) continue;
        const coverpage = this.toCoverpage(page, authorIndex);
        if (!coverpage || byID.has(coverpage.id)) continue;
        byID.set(coverpage.id, coverpage);
      }

      // Trim before the summary fetch, not after — otherwise a capped run still
      // pays for a throttled request per book it is about to discard.
      const maxBooks = context?.limits?.maxBooksPerLibrary;
      const all = [...byID.values()];
      const coverpages = maxBooks ? all.slice(0, maxBooks) : all;
      if (coverpages.length < all.length) {
        complete = false;
        debugCommonsSync(
          `Limited ${subdomain} to ${coverpages.length} of ${all.length} books.`
        );
      }

      await mapWithConcurrency(coverpages, SUMMARY_CONCURRENCY, async (coverpage) => {
        coverpage.summary = await this.fetchSummary(expert, coverpage.id, throttle);
      });

      return { ok: true, subdomain, complete, coverpages };
    } catch (err) {
      debugError(err);
      return {
        ok: false,
        subdomain,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Walks every library Commons syncs from.
   *
   * Libraries run concurrently and each reports its own outcome, so one
   * unreachable library neither fails the run nor is mistaken for a library
   * that has no books.
   *
   * Aborting `signal` stops the walk at the next throttled request; libraries
   * caught mid-flight come back as failures, which is what the caller wants —
   * an abandoned run must never look authoritative about what a library holds.
   */
  async syncAllLibraries(
    options?: { signal?: AbortSignal }
  ): Promise<LibrarySyncResult[]> {
    const all = await Library.find({ hidden: false, syncSupported: true });
    const limits = getLibrarySyncLimits();

    let libraries = all;
    if (limits.only) {
      libraries = libraries.filter((l) =>
        limits.only!.includes(l.subdomain.toLowerCase())
      );
      const missing = limits.only.filter(
        (s) => !all.some((l) => l.subdomain.toLowerCase() === s)
      );
      if (missing.length > 0) {
        debugError(
          `LIBRARY_SYNC_ONLY names ${missing.join(", ")}, which ` +
          `${missing.length === 1 ? "is" : "are"} not a synced library.`
        );
      }
    }
    if (limits.maxLibraries) {
      libraries = libraries.slice(0, limits.maxLibraries);
    }

    if (isLimitedSync(limits)) {
      debugCommonsSync(
        `LIMITED SYNC (${describeLimits(limits)}) — ${libraries.length} of ` +
        `${all.length} libraries. Books absent from this run will NOT be ` +
        `marked missing.`
      );
    } else {
      debugCommonsSync(`Syncing ${libraries.length} libraries.`);
    }

    const authorIndex = await this.buildAuthorIndex();
    const throttle = createThrottle(
      SUMMARY_REQUEST_INTERVAL_MS,
      options?.signal
    );

    return Promise.all(
      libraries.map((library) =>
        this.syncLibrary(library, { throttle, authorIndex, limits })
      )
    );
  }
}
