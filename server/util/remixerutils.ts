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
  const titleSegment = titleToRemixerPathSegment(rawTitle);
  const siblingTitleIndexPostfix = siblingTitleIndex
    ? `_${siblingTitleIndex.toString()}`
    : "";
  // Prefer formattedPath so autoNumbering `start` (incl. 0 → `00%3A_…`) is honored.
  const numbering =
  page.numberedPath?.trim() ||page.formattedPath?.trim() ||  "";
  const parts = page?.pathNumber|| numbering.split(".");
  if (parts.length > 0) {
    parts[parts.length - 1] = parts[parts.length - 1]!.padStart(2, "0");
  }
  const paddedNumbering = numbering ? parts.join(".") : "";
  return paddedNumbering
    ? `${paddedNumbering}:_${titleSegment}${siblingTitleIndexPostfix}`
    : titleSegment;
};
export const generatePagePath = (parent: string, title: string): string => {
  const slug = slugifyNode(title);
  return encodeURIComponent(`${parent}/${slug}`);
};

export const extractPagePath = (pagePath: string): string => {
  const withoutHost = pagePath.replace(
    /^https?:\/\/[^/]*libretexts\.org\//i,
    "",
  );
  return withoutHost;
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
  
  if (
    page.movedItem ||
    page.isPlacementChanged ||
    page.renamedItem
  )
    return "modified";

  return "unchanged";
};

export const shouldSkipPage = (page: RemixerSubPageState,  status: RemixerPageStatus): boolean => {
  const pathLen = page.pathNumber?.length ?? 0;
  const isBookRoot = pathLen === 0;
  const pageStatus = getPageStatus(page);
  const isDeleteNoExisting = page.isDeleted && (pageStatus === "imported" || pageStatus === "new") || false;
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
