import Project from "../models/project";
import type { RemixerSubPageState } from "../models/projectremixer";
import type { RemixerPageStatus } from "../types/Remixer";

export const slugifyNode = (title: string): string => {
  const cleaned = title
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\-]/g, "");
  return cleaned.length > 0 ? cleaned : "Section";
};

const stripLeadingNumbering = (value: string): string =>
  value.replace(/^\s*\d+(?:\.\d+)*\s*[:.\-]\s*/, "").trim();

const stripDefaultTitlePrefixBeforeColon = (value: string): string => {
  for (
    let index = value.lastIndexOf(":");
    index >= 0;
    index = value.lastIndexOf(":", index - 1)
  ) {
    const remainder = value.slice(index + 1);
    if (remainder.trim().length > 0) {
      return remainder.trim();
    }
  }
  return value.trim();
};

/** LibreTexts-style title slug for a path segment (e.g. `New Page` → `New_Page`). */
export const titleToRemixerPathSegment = (title: string): string => {
  const cleaned = stripDefaultTitlePrefixBeforeColon(
    stripLeadingNumbering(title),
  )
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\-()]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.length > 0 ? cleaned : "Section";
};

type RemixerPathNumbering = {
  formattedPath?: string;
  numberedPath?: string;
  pathNumber?: string[];
  overrideUriUiEnding?: string;
};

/**
 * Path-segment-safe characters only — mirrors the client's `sanitizeUriEnding`.
 * Never trust client sanitization alone since the API can be called directly.
 *
 * The alphabet matches what the auto-generated segment produces (see
 * `buildRemixerPagePathSegment`): a raw `:` as in `01:_Introduction`, never a
 * percent-encoded one. `%` is deliberately excluded — callers encode the whole
 * path once or twice on the way out, so a stored `%3A` would reach MindTouch as
 * three literal characters and land the page at `01%253A_Introduction`.
 * The value is decoded first so an override seeded from an encoded `uri.ui`
 * leaf heals into `01:_Introduction` rather than being stripped to
 * `013A_Introduction`.
 */
export const sanitizeRemixerUriEnding = (
  value: string | undefined,
): string | undefined => {
  if (!value) return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed percent-encoding (e.g. a lone "%") — fall through with the raw
    // value; the character class below drops whatever cannot be a path segment.
  }
  // Same alphabet as the client's `sanitizeUriEnding`; `&` and `?` are left
  // out for the reason given at RESERVED_PATH_SEGMENT_CHARS.
  const cleaned = decoded.replace(/[^A-Za-z0-9._~():-]/g, "");
  // `/` is already stripped, but a dots-only leaf ("." / "..") is still a
  // relative path segment; reject it rather than build a path around it.
  if (cleaned.length === 0 || /^\.+$/.test(cleaned)) return undefined;
  return cleaned;
};

/**
 * MindTouch path leaf matching Workbench URLs such as `3.04%3A_New_Page`
 * (`3.04:_New_Page` before URL encoding).
 */
export const buildRemixerPagePathSegment = (
  page: RemixerPathNumbering,
  rawTitle: string,
  siblingTitleIndex: number | undefined,
): string => {
  // An explicit URL-ending override replaces the auto-numbered/slugified
  // segment entirely. siblingTitleIndex is intentionally not appended here —
  // a collision from an explicit override is the user's responsibility and
  // surfaces as a 409, already handled by the TitleConflictError retry /
  // placeholder-relocation machinery in runRemixerJob.
  const sanitizedOverride = sanitizeRemixerUriEnding(page.overrideUriUiEnding);
  if (sanitizedOverride) return sanitizedOverride;

  const titleSegment = titleToRemixerPathSegment(rawTitle);
  const siblingTitleIndexPostfix = siblingTitleIndex
    ? `_${siblingTitleIndex.toString()}`
    : "";
  // pathNumber is authoritative: the client's change detection compares live URLs
  // against its dot-joined segments (services.ts hasFormattedPathChanged), so slugs
  // must be built from the same source. numberedPath/formattedPath are fallbacks for
  // pages that predate pathNumber; note they apply level `delimiter`/`excludeParent`
  // and, for formattedPath, the autoNumbering `start` offset, none of which belong
  // in a URL segment.
  // formattedPath can carry a user-typed override prefix; keep it URL-safe.
  const numbering = stripReservedPathChars(
    page.numberedPath?.trim() || page.formattedPath?.trim() || "",
  );
  // An empty pathNumber marks the book root rather than "no numbering info",
  // so fall through to numbering instead of letting `[]` win as truthy. The
  // copy keeps the padding below from mutating the caller's stored array.
  const parts = page.pathNumber?.length
    ? [...page.pathNumber]
    : numbering
      ? numbering.split(".")
      : [];
  if (parts.length > 0) {
    parts[parts.length - 1] = parts[parts.length - 1]!.padStart(2, "0");
  }
  const paddedNumbering = parts.join(".");
  return paddedNumbering
    ? `${paddedNumbering}:_${titleSegment}${siblingTitleIndexPostfix}`
    : titleSegment;
};
export const generatePagePath = (parent: string, title: string): string => {
  const slug = slugifyNode(title);
  return encodeURIComponent(`${parent}/${slug}`);
};

/**
 * Library path of a page URL, percent-encoded per segment like a normal
 * `uri.ui` pathname (`Workbench/Book/00%3A_Front_Matter`).
 *
 * MindTouch reports a page whose path contains a URL-reserved character
 * (e.g. `&`) in query form — `https://<lib>.libretexts.org/?title=<path>` —
 * instead of as a pathname. Taking that string as-is yields a "path" of
 * `?title=…`; pages moved or created under it land in a phantom top-level
 * tree outside the book. Read the `title` value instead.
 */
export const extractPagePath = (pagePath: string): string => {
  const withoutHost = pagePath.replace(
    /^https?:\/\/[^/]*libretexts\.org\//i,
    "",
  );
  const query = withoutHost.match(/^(?:index\.php)?\?(.*)$/i);
  if (!query) return withoutHost;
  const title = readQueryTitle(query[1]);
  if (!title) return withoutHost;
  return title.split("/").map(encodeURIComponent).join("/");
};

/**
 * The `title` value of a query string, %-decoded only. Not URLSearchParams:
 * that also turns `+` into a space, which would rename `C++_Programming` to
 * `C  _Programming`. A malformed escape (a bare `%`) is kept as-is.
 * Mirrored on the client by `readQueryTitle` in remixer/services.ts.
 */
const readQueryTitle = (query: string): string | null => {
  const match = query.match(/(?:^|&)title=([^&]*)/i);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

/**
 * The one rule for text that becomes part of a library page path, shared with
 * the client (`RESERVED_PATH_SEGMENT_CHARS` in
 * `client/src/components/remixer/services.ts`; keep the two identical).
 *
 * `&` and `?` are dropped: MindTouch serves any page whose path holds one only
 * in its `?title=` query form, and even redirects the %-encoded pathname
 * (`…/remixer_book_%26_test`) back to it (checked on dev). `/` and `\` split
 * the path, `#` starts a fragment, `%` would be read as an escape when
 * MindTouch decodes the double-encoded path, and the rest are not valid in a
 * page name. `:` is kept: it is the numbering separator (`01:_Introduction`).
 */
const RESERVED_PATH_SEGMENT_CHARS = /[&?#%+/\\"'<>|{}^[\]`]/g;

/** Drops the characters {@link RESERVED_PATH_SEGMENT_CHARS} rules out of a path. */
export const stripReservedPathChars = (value: string): string =>
  value.replace(RESERVED_PATH_SEGMENT_CHARS, "");

/**
 * URL segment for a book root (cover) page, from its title. The cover-slug
 * style from master (lowercase, spaces → `-`, then `:` `.` `-` → `_`), with
 * the reserved characters above dropped, so `Reading & Writing` becomes
 * `reading__writing` and never a path MindTouch only serves as `?title=`.
 */
export const bookRootPathSegment = (title: string): string => {
  const slug = stripReservedPathChars(
    title
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[:.\-]/g, "_"),
  );
  return slug.length > 0 ? slug : "book";
};

/**
 * The canonical form of a library page URL: a pathname with each segment
 * %-encoded the way MindTouch encodes ordinary pages (`:` → `%3A`, and for
 * existing pages whose path holds them, `&` → `%26`, `?` → `%3F`).
 *
 * MindTouch reports a page whose path contains `&` or `?` in query form
 * (`https://<lib>.libretexts.org/?title=Workbench/a_&_b`). New paths never
 * contain those characters (see RESERVED_PATH_SEGMENT_CHARS), but pages created
 * elsewhere can, and storing their query form is what let `?title=` leak into
 * new page paths, so every URL the remixer keeps goes through here. The
 * pathname form still opens the page: MindTouch redirects it to the query form.
 * Anything that is not a LibreTexts query-form URL (pathname URLs, API URLs,
 * `#` placeholders) is returned as-is.
 */
export const toCanonicalPageUrl = (uri: string): string => {
  if (typeof uri !== "string" || uri.length === 0) return uri;
  const match = uri.match(/^(https?:\/\/[^/]*libretexts\.org)\/(?:index\.php)?\?/i);
  if (!match) return uri;
  const path = extractPagePath(uri);
  // extractPagePath leaves the value unchanged when there is no usable title.
  if (/^(?:index\.php)?\?/i.test(path)) return uri;
  return `${match[1]}/${path}`;
};

/**
 * Last line of defence before a move/create: a target path that still looks
 * like a query-form URL would create a phantom `?title=…` tree in the library.
 * Throws so the job fails on the first page instead of scattering the book.
 */
export const assertLibraryPagePath = (path: string): void => {
  if (/^[/]*(?:index\.php)?\?/i.test(path) || /[?&]title=/i.test(path)) {
    throw new Error(
      `Refusing to write page to "${path}": it is a query-form URL, not a library path.`,
    );
  }
};

/** Subdomain label from a LibreTexts page URL (e.g. dev from https://dev.libretexts.org/...). */
export const extractLibretextsSubdomain = (uri: string): string | null => {
  const m = uri.trim().match(/^https?:\/\/([^.]+)\.libretexts\.org/i);
  return m?.[1] ?? null;
};

export const getUserWorkbenchProjects = async (
  subdomain: string,
  userId: string,
): Promise<string[]> => {
  const projects = await Project.find({
    $or: [
      { leads: userId },
      { liaisons: userId },
      { members: userId },
      { auditors: userId },
    ],
    didCreateWorkbench: true,
    libreCoverID: { $exists: true, $ne: "" },
    libreLibrary: subdomain,
  }).lean();

  return projects.map((project) => project.libreCoverID);
};

/**
 * Classifies what the remixer job will do with a page, from the client-supplied
 * change-tracking flags. Lives here (rather than in remixer-service) so the
 * ownership validator and the job can share one source of truth.
 */
export const getPageStatus = (page: RemixerSubPageState): RemixerPageStatus => {
  if (page.isDeleted && (!page.addedItem || !page.isImported)) return "deleted";
  if (page.addedItem && !page.isDeleted && page["@id"].startsWith("new-"))
    return "new";

  if (page.isImported || page.addedItem) return "imported";

  if (page.movedItem || page.isPlacementChanged || page.renamedItem)
    return "modified";

  return "unchanged";
};

export const shouldSkipPage = (
  page: RemixerSubPageState,
  status: RemixerPageStatus,
): boolean => {
  const pathLen = page.pathNumber?.length ?? 0;
  const isBookRoot = pathLen === 0;
  const pageStatus = getPageStatus(page);
  const isDeleteNoExisting =
    (page.isDeleted && (pageStatus === "imported" || pageStatus === "new")) ||
    false;
  return isBookRoot || status === "unchanged" || isDeleteNoExisting;
};

/**
 * Security gate for the remixer: given a proposed book (the client-supplied
 * `remixerCurrentBook`) and the set of page IDs that genuinely belong to the
 * project's book (resolved from the live cover TOC via
 * `BookService.getBookPageIDs()`), returns the page IDs that fall outside the
 * book and therefore must NOT be touched.
 *
 * Two distinct violations are reported:
 *  - `mutated`: an existing page (numeric `@id`) flagged for in-place
 *    move/rename/delete whose `@id` is not in the owned set. This is the
 *    cross-book IDOR — deleting or moving another project's pages.
 *  - `grafted`: a newly created / imported node whose parent chain does not
 *    anchor on an owned in-book page (the cover or an existing book page),
 *    i.e. an attempt to attach new content into a book the user doesn't own.
 *
 * Page IDs are compared as strings; the caller decides the failure policy
 * (this project fails the whole job closed when either array is non-empty).
 * Note: an imported node's own `@id` is the SOURCE page's id (from another
 * library) and is intentionally never required to be in `ownedIDs` — only its
 * anchor parent is checked.
 */
export const findUnownedRemixerPageIDs = (
  pages: RemixerSubPageState[],
  ownedIDs: Set<string>,
): { mutated: string[]; grafted: string[] } => {
  const mutated: string[] = [];
  const grafted: string[] = [];
  const byId = new Map(pages.map((p) => [p["@id"], p]));

  // A creation is legitimately rooted if, climbing its parentID chain (through
  // other in-payload nodes), we reach a parent that is an owned in-book page
  // (the cover qualifies — getBookPageIDs includes it). Reaching the top ("-1")
  // or an external, non-owned parent means the subtree isn't in this book.
  const isAnchoredInBook = (page: RemixerSubPageState): boolean => {
    const seen = new Set<string>();
    let current = page.parentID ?? "-1";
    while (current && current !== "-1") {
      if (ownedIDs.has(current)) return true;
      if (!byId.has(current)) return false; // external, non-owned parent
      if (seen.has(current)) return false; // cycle guard
      seen.add(current);
      current = byId.get(current)!.parentID ?? "-1";
    }
    return false;
  };

  for (const page of pages) {
    const status = getPageStatus(page);
    if (status === "modified" || status === "deleted") {
      const id = page["@id"];
      // `new-` ids are never mutated in place by the job handlers.
      if (id.startsWith("new-")) continue;
      const numericId = id.split("-")[0]; // what handleModifiedPage will actually act on
      if (!ownedIDs.has(numericId)) mutated.push(id);
    } else if (status === "new" || status === "imported") {
      if (!isAnchoredInBook(page)) grafted.push(page["@id"]);
    }
  }

  return { mutated, grafted };
};
