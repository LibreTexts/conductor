import logger, { childLogger } from "../../logger.js";
import base62 from "base62-random";
import PrejectRemixerJob from "../../models/projectremixerjob";
import PrejectRemixer, {
  RemixerSubPageState,
} from "../../models/projectremixer";
import RemixerTemplates from "../../util/CXOne/CXOneRemixerTemplates";
import CXOnePageAPIEndpoints from "../../util/CXOne/CXOnePageAPIEndpoints";
import {
  addPageProperty,
  CXOneFetch,
  generateAPIRequestHeaders,
  getPage,
} from "../../util/librariesclient";
import MindTouch from "../../util/CXOne/index.js";
import {
  buildRemixerPagePathSegment,
  extractLibretextsSubdomain,
  extractPagePath,
  findUnownedRemixerPageIDs,
  getPageStatus,
  shouldSkipPage,
} from "../../util/remixerutils";
import * as cheerio from "cheerio";
import { detectTranscludeStub } from "../../util/transclusion.js";
import { RemixerSubPage } from "../../types/Remixer";
import BookService from "./book-service";
const remixerLog = childLogger("remixer");

export type RemixerCopyMode = "Transclude" | "Fork" | "Full";

const normalizeRemixerCopyMode = (
  copyModeState: string | undefined,
): RemixerCopyMode => {
  if (copyModeState === "Fork" || copyModeState === "Full") {
    return copyModeState;
  }
  return "Transclude";
};

const mapToRemixerSubPagesResponse = (
  response: any,
  parentID?: string,
): RemixerSubPage[] => {
  const rawSubpages = response?.["page.subpage"];
  const subpages = Array.isArray(rawSubpages)
    ? rawSubpages
    : rawSubpages
      ? [rawSubpages]
      : [];

  return subpages.map((subpage: any) => ({
    "@id": subpage["@id"],
    "@title": subpage["@title"],
    "@href": subpage["@href"],
    "@subpages": String(subpage["@subpages"]) === "true",
    article: subpage["article"],
    namespace: subpage["namespace"],
    title: subpage["title"],
    "uri.ui": subpage["uri.ui"],
    parentID,
  }));
};

const mapToRemixerPageDetailsResponse = (
  response: any,
  currentbook: boolean = true,
  parentID: string = "-1",
): RemixerSubPage | RemixerSubPage[] => {
  let resolvedParentID =
    parentID ??
    response?.["page.parent.@id"] ??
    response?.["page.parent"]?.["@id"] ??
    response?.page?.parent?.["@id"] ??
    response?.parent?.["@id"] ??
    "-1";

  if (!currentbook) {
    resolvedParentID =
      response?.["page.parent.@id"] ??
      response?.["page.parent"]?.["@id"] ??
      response?.page?.parent?.["@id"] ??
      response?.parent?.["@id"] ??
      parentID ??
      "-1";
  }
  return {
    "@id": response["@id"],
    "@title": response["title"],
    "@href": response["uri.ui"],
    "@subpages": response["subpages"]?.length > 0,
    article: response["article"],
    namespace: response["namespace"],
    title: response["title"],
    "uri.ui": response["uri.ui"],
    parentID: resolvedParentID,
  };
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

/**
 * Thrown when a MindTouch request fails for reasons that are likely temporary
 * (timeouts, gateway errors, rate-limiting, transient network failures).
 * Callers can retry the same operation safely from the user's perspective.
 */
class TransientMindTouchError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TransientMindTouchError";
  }
}

/**
 * Thrown when MindTouch rejects a create/move/rename with 409 Conflict
 * because the target title or URL path is already occupied. This is not
 * retried with backoff (retrying the same request won't help) — callers
 * instead defer the page and reprocess it later, once other pages in the
 * same run have had a chance to vacate the conflicting title/path.
 */
class TitleConflictError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TitleConflictError";
  }
}

/**
 * A deferral caused by the page's *parent* not existing yet, rather than by a
 * contested title/URL. Kept distinct from a plain `TitleConflictError` because
 * the deadlock breaker must never relocate one of these: this page's own title
 * is not the contested slot, so moving it to a throwaway path frees nothing and
 * just churns a live library page once per retry pass.
 */
class ParentNotReadyError extends TitleConflictError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ParentNotReadyError";
  }
}

const isTransientStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || status >= 500;

/** Throws an appropriate error for a non-OK MindTouch response. */
const throwForMindTouchResponse = (
  response: Response,
  prefix: string,
): never => {
  const message = `${prefix}: ${response.status} ${response.statusText}`;
  if (response.status === 409) {
    throw new TitleConflictError(message);
  }
  if (isTransientStatus(response.status)) {
    throw new TransientMindTouchError(message);
  }
  throw new Error(message);
};

const TRANSIENT_ERROR_PATTERNS = [
  "timeout",
  "timed out",
  "etimedout",
  "econnreset",
  "econnrefused",
  "econnaborted",
  "enotfound",
  "socket hang up",
  "network",
  "fetch failed",
];

const isTransientError = (error: unknown): boolean => {
  if (error instanceof TransientMindTouchError) return true;
  // fetch throws TypeError for network-level failures in Node/undici.
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return TRANSIENT_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
  }
  return false;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` and retries on transient MindTouch failures using exponential
 * backoff. Non-transient errors propagate immediately.
 */
const withRetryOnTransient = async <T>(
  fn: () => Promise<T>,
  {
    attempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 8000,
    onRetry,
  }: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
  } = {},
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientError(error)) {
        throw error;
      }
      if (onRetry) {
        await onRetry(attempt, error);
      }
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt - 1),
      );
      await sleep(delay);
    }
  }
  throw lastError;
};

/** CXOne / flat JSON use `"uri.ui"`; Mongoose maps that schema path to nested `uri.ui`. */
const getRemixerPageUriUi = (page: RemixerSubPageState): string => {
  const rec = page as unknown as Record<string, unknown>;
  const flat = rec["uri.ui"];
  if (typeof flat === "string" && flat.length > 0) return flat;
  const uri = rec.uri as Record<string, unknown> | undefined;
  if (uri && typeof uri.ui === "string") return uri.ui as string;
  return page["@href"] ?? "";
};

const setRemixerPageUriUi = (page: RemixerSubPageState, uri: string) => {
  const rec = page as unknown as Record<string, unknown>;
  rec["uri.ui"] = uri;
  if (typeof rec.uri === "object" && rec.uri !== null) {
    (rec.uri as Record<string, unknown>).ui = uri;
  } else {
    rec.uri = { ui: uri };
  }
};

/**
 * Returns a human-readable LibreTexts URI suitable for path construction.
 * If the stored uri.ui is an API URL (e.g. `@api/deki/pages/123?redirects=0`)
 * we resolve the real uri.ui via the page-info endpoint and cache it back on
 * the page object so subsequent callers don't need to re-fetch.
 */
const resolveUiUri = async (
  page: RemixerSubPageState,
  subdomain: string,
): Promise<string> => {
  const uri = getRemixerPageUriUi(page);
  const isApiUrl = uri.includes("/@api/deki/") || uri.startsWith("@api/deki/");
  if (!isApiUrl) return uri;

  const pid = parseInt(page["@id"], 10);
  if (!Number.isNaN(pid)) {
    const info = await getPage(pid, subdomain);
    const realUri =
      typeof info?.["uri.ui"] === "string" &&
      (info["uri.ui"] as string).length > 0
        ? (info["uri.ui"] as string)
        : undefined;
    if (realUri) {
      setRemixerPageUriUi(page, realUri);
      return realUri;
    }
  }
  return uri;
};

/**
 * After a page is renamed or moved, its cached `uri.ui` is refreshed — but
 * every descendant's cached `uri.ui` still embeds that page's *old* path
 * segment as a prefix (MindTouch renames/moves an entire subtree's URLs in
 * one operation). Rewrite each descendant's cached URL in place by swapping
 * the old path prefix for the new one, so later steps in this run (new-page
 * creation, further moves, the final published snapshot) see the real,
 * current URL instead of a now-incorrect cached one — without an extra
 * MindTouch fetch per descendant.
 *
 * `childrenByParent` is the parentID → child-nodes index; the caller builds it
 * once per job (parentID relationships are fixed for the run) and reuses it
 * across every modified page.
 */
const remapDescendantUriPaths = (
  childrenByParent: Map<string, RemixerSubPageState[]>,
  changedPageId: string,
  oldUri: string,
  newUri: string,
  subdomain: string,
): void => {
  // extractPagePath only strips the host; the inputs may also arrive as
  // already-relative paths or `@href` values that carry a leading and/or
  // trailing slash. Trim both ends so the prefix comparison and the sliced
  // remap below stay aligned (and the rebuilt URL never doubles its slash).
  const toNormalizedPagePath = (value: string): string =>
    extractPagePath(value).replace(/^\/+|\/+$/g, "");

  const oldPath = toNormalizedPagePath(oldUri);
  const newPath = toNormalizedPagePath(newUri);
  if (!oldPath || oldPath === newPath) return;

  const queue: RemixerSubPageState[] = [
    ...(childrenByParent.get(changedPageId) ?? []),
  ];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    const id = node["@id"];
    if (visited.has(id)) continue;
    visited.add(id);

    const currentPath = toNormalizedPagePath(getRemixerPageUriUi(node));
    // API-form URLs (@api/deki/…) are never human-readable UI paths — skip them.
    const isApiUrl = currentPath.startsWith("@api/deki/");
    if (
      !isApiUrl &&
      (currentPath === oldPath || currentPath.startsWith(`${oldPath}/`))
    ) {
      const remappedPath = `${newPath}${currentPath.slice(oldPath.length)}`;
      setRemixerPageUriUi(
        node,
        `https://${subdomain}.libretexts.org/${remappedPath}`,
      );
    }
    queue.push(...(childrenByParent.get(id) ?? []));
  }
};

/**
 * Every node beneath `rootId`, breadth-first. Shares `childrenByParent` with
 * `remapDescendantUriPaths` — when a rename shifts a page's URL it shifts every
 * descendant's too, so callers that snapshot descendants need the same walk.
 */
const collectDescendants = (
  childrenByParent: Map<string, RemixerSubPageState[]>,
  rootId: string,
): RemixerSubPageState[] => {
  const out: RemixerSubPageState[] = [];
  const queue: RemixerSubPageState[] = [
    ...(childrenByParent.get(rootId) ?? []),
  ];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    const id = node["@id"];
    if (visited.has(id)) continue;
    visited.add(id);
    out.push(node);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return out;
};

const isMatterNode = (page: {
  "@title": string;
  title: string;
  "uri.ui": string;
  "@href": string;
}): boolean => {
  const normalized = stripLeadingNumbering(
    page["@title"] || page.title || "",
  ).toLowerCase();
  if (normalized === "front matter" || normalized === "back matter")
    return true;
  const uri = getRemixerPageUriUi(page as RemixerSubPageState).toLowerCase();
  return uri.includes("front_matter") || uri.includes("back_matter");
};

const isBackMatterNode = (page: {
  "@title": string;
  title: string;
  "uri.ui": string;
  "@href": string;
}): boolean => {
  const normalized = stripLeadingNumbering(
    page["@title"] || page.title || "",
  ).toLowerCase();
  if (normalized === "back matter") return true;
  const uri = getRemixerPageUriUi(page as RemixerSubPageState).toLowerCase();
  return uri.includes("back_matter") && uri.includes("zz");
};

/**
 * Moves Back Matter to the end of its sibling list via CXOne's page order API.
 *
 * PUT /pages/{backMatterId}/order?afterid={lastSiblingId}
 * — path is the last page on the same level; afterid is the Back Matter page.
 * @returns true when an order request was issued.
 */
const orderBackMatterLast = async (
  book: RemixerSubPageState[],
  subdomain: string,
): Promise<boolean> => {
  const backMatter = book.find((p) => isBackMatterNode(p));
  if (!backMatter) return false;

  const backMatterId = parseInt(backMatter["@id"], 10);
  if (Number.isNaN(backMatterId)) return false;

  const parentId = backMatter.parentID ?? "-1";
  const siblings = book.filter((p) => {
    if ((p.parentID ?? "-1") !== parentId) return false;
    if (p["@id"] === backMatter["@id"]) return false;
    return !Number.isNaN(parseInt(p["@id"], 10));
  });
  if (siblings.length === 0) return false;

  const lastSibling = [...siblings]
    .sort((a, b) => {
      const aPath = (a.pathNumber ?? []).join(".");
      const bPath = (b.pathNumber ?? []).join(".");
      return aPath.localeCompare(bPath, undefined, { numeric: true });
    })
    .at(-1)!;
  const lastSiblingId = parseInt(lastSibling["@id"], 10);
  if (Number.isNaN(lastSiblingId)) return false;

  const response = await CXOneFetch({
    scope: "page",
    path: backMatterId,
    api: CXOnePageAPIEndpoints.ORDER_PAGES(String(lastSiblingId)),
    subdomain,
    options: {
      method: "PUT",
    },
  });

  if (!response.ok) {
    throwForMindTouchResponse(
      response,
      "Error ordering Back Matter as the last chapter",
    );
  }
  return true;
};

/**
 * Places a newly created/imported page right after its nearest preceding
 * sibling (by pathNumber) using the MindTouch page-order API.
 * Non-fatal: logs a warning if the call fails so the rest of the job continues.
 */
const orderPageAfterPreviousSibling = async (
  newPageId: string,
  page: RemixerSubPageState,
  pages: RemixerSubPageState[],
  subdomain: string,
): Promise<void> => {
  const newPid = parseInt(newPageId, 10);
  if (Number.isNaN(newPid)) return;

  const parentId = page.parentID ?? "-1";
  const currentPath = (page.pathNumber ?? []).join(".");

  // Siblings with a real, resolved numeric ID (excludes still-pending new- pages)
  const siblings = pages.filter((p) => {
    if (p["@id"] === newPageId) return false;
    if ((p.parentID ?? "-1") !== parentId) return false;
    return !Number.isNaN(parseInt(p["@id"], 10));
  });

  if (siblings.length === 0) return; // First child — MindTouch orders it first automatically

  // Sort ascending by pathNumber so we can find the nearest predecessor
  const sorted = [...siblings].sort((a, b) =>
    (a.pathNumber ?? [])
      .join(".")
      .localeCompare((b.pathNumber ?? []).join("."), undefined, {
        numeric: true,
      }),
  );

  // Nearest sibling whose pathNumber is strictly less than ours
  const prevSibling = [...sorted]
    .reverse()
    .find(
      (s) =>
        (s.pathNumber ?? [])
          .join(".")
          .localeCompare(currentPath, undefined, { numeric: true }) < 0,
    );

  if (!prevSibling) return; // Page is first in position; no ordering call needed

  const prevSiblingPid = parseInt(prevSibling["@id"], 10);
  if (Number.isNaN(prevSiblingPid)) return;

  try {
    const response = await CXOneFetch({
      scope: "page",
      path: newPid,
      api: CXOnePageAPIEndpoints.ORDER_PAGES(String(prevSiblingPid)),
      subdomain,
      options: { method: "PUT" },
    });
    if (!response.ok) {
      remixerLog.warn(
        `Could not order page ${newPageId} after ${prevSibling["@id"]}: ${response.status}`,
      );
    }
  } catch (err) {
    remixerLog.warn({ err }, "Non-fatal error ordering new page");
  }
};

// Disambiguates duplicate sibling titles set by applySiblingDuplicateTitleSuffixes
// on the client; 0/undefined is hidden, 1+ is shown as a "(n)" suffix.
const appendSiblingTitleSuffix = (
  displayTitle: string,
  page: RemixerSubPageState,
): string => {
  const index = page.siblingTitleIndex ?? 0;
  if (index === 0) return displayTitle;
  return `${displayTitle} (${index})`;
};

const getDisplayTitle = (
  page: RemixerSubPageState,
  inMatterBranch: boolean,
  inDeletedBranch: boolean,
  autoNumbering: boolean,
): string => {
  const rawTitle = page.title || page["@title"] || "Untitled";
  if (page.parentID === "-1") {
    return rawTitle;
  }
  const cleanTitle = stripDefaultTitlePrefixBeforeColon(
    stripLeadingNumbering(rawTitle),
  );

  if (!autoNumbering || inDeletedBranch || inMatterBranch)
    return appendSiblingTitleSuffix(cleanTitle, page);

  // Empty pathNumber means this is the book root — no numbering
  const numberPath = page.pathNumber ?? [];
  if (numberPath.length === 0)
    return appendSiblingTitleSuffix(cleanTitle, page);

  // formattedPath is pre-computed by buildBookPaths (already handles formattedPathOverride)
  const formattedPath = page.formattedPath?.trim() ?? "";
  const titleWithPath = formattedPath
    ? `${formattedPath}: ${cleanTitle}`
    : cleanTitle;
  return appendSiblingTitleSuffix(titleWithPath, page);
};

const applyDefaultRemixerPageProperties = async (
  subdomain: string,
  pageID: string,
): Promise<void> => {
  await addPageProperty(
    subdomain,
    pageID,
    "GuideTabs",
    MindTouch.Templates.PROP_GuideTabs,
    "PUT",
  );
  await addPageProperty(subdomain, pageID, "GuideDisplay", "single", "PUT");
  await addPageProperty(subdomain, pageID, "WelcomeHidden", true);
};

/** Book root → topic-category; cover children → topic-guide; everyone else → topic. */
type RemixerArticleKind = "topic-category" | "topic-guide" | "topic";

const articleKindForPlacement = (
  pageId: string | undefined,
  parentId: string | undefined,
  coverId?: string,
): RemixerArticleKind => {
  if (coverId && (pageId === coverId || pageId === "-1")) {
    return "topic-category";
  }
  if (coverId && parentId === coverId) {
    return "topic-guide";
  }
  return "topic";
};

const contentTemplateForArticleKind = (kind: RemixerArticleKind): string => {
  if (kind === "topic-category") {
    return RemixerTemplates.POST_CreateBlankTopicCategory;
  }
  if (kind === "topic-guide") {
    return RemixerTemplates.POST_CreateBlankTopicGuide;
  }
  return RemixerTemplates.POST_CreateBlankPage("topic");
};

const localArticleField = (
  kind: RemixerArticleKind,
): RemixerSubPageState["article"] => (kind === "topic" ? "article" : kind);

const applyArticleKindToPage = async (
  page: RemixerSubPageState,
  kind: RemixerArticleKind,
  subdomain: string,
  coverId: string,
  /**
   * MindTouch page id to write to. Defaults to `page["@id"]`, which is only
   * the real id once it has been adopted from a create response. An imported
   * node still carries its local `<sourceID>-<ts>-<rand>` id until then, and
   * every BookService helper does `parseInt` on what it is given, so passing
   * the un-adopted page would target the SOURCE page id instead, a write to a
   * page this job does not own.
   */
  pageID: string = page["@id"],
): Promise<void> => {
  const bookService = new BookService({
    bookID: `${subdomain}-${coverId}`,
  });
  const tag = kind === "topic" ? "article:topic" : (`article:${kind}` as const);
  await bookService.updatePageDetails(pageID, undefined, [tag]);
  await bookService.activateShowOrg(
    pageID,
    kind === "topic-guide" || kind === "topic-category",
  );
  page.article = localArticleField(kind);
};

type CreatePageOptions = {
  /** Bypass numbered-path construction (used for throwaway placeholder pages). */
  pathSegmentOverride?: string;
  titleOverride?: string;
};

const handleNewPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
  coverId?: string,
  options?: CreatePageOptions,
): Promise<{ pageID: string; pageURI: string }> => {
  const kind = articleKindForPlacement(page["@id"], parent["@id"], coverId);
  const content = contentTemplateForArticleKind(kind);
  page.article = localArticleField(kind);
  const createTitle = options?.titleOverride || title;
  const rawTitle = page["@title"] || page.title || title;
  // segment must be un-encoded here — we double-encode the full path below,
  // matching CXOneFetch's encodeURIComponent(encodeURIComponent(path)) convention.
  const segment =
    options?.pathSegmentOverride ||
    buildRemixerPagePathSegment(page, rawTitle, page.siblingTitleIndex);

  const parentUri = await resolveUiUri(parent, subdomain);
  // uri.ui already has %3A-encoded colons; decode once so the combined path
  // contains only raw characters before we apply the double-encode.
  const parentPath = (() => {
    try {
      return decodeURIComponent(extractPagePath(parentUri));
    } catch {
      return extractPagePath(parentUri);
    }
  })();
  const rawPath = `${parentPath}/${segment}`;
  // MindTouch pages/=<path> requires the content path to be double-encoded:
  // the HTTP server decodes once, then the DekiWiki router decodes again.
  const pathEnc = encodeURIComponent(encodeURIComponent(rawPath));
  const url = `https://${subdomain}.libretexts.org/@api/deki/pages/=${pathEnc}/${CXOnePageAPIEndpoints.POST_Contents_Title(createTitle)}`;
  const dekiHeaders = await generateAPIRequestHeaders(subdomain);
  if (!dekiHeaders) {
    throw new Error(
      "Error generating library API headers for remixer request.",
    );
  }
  const response = await fetch(url, {
    method: "POST",
    body: content,
    headers: {
      "Content-Type": "text/plain",
      ...dekiHeaders,
    },
  });

  if (!response.ok) {
    throwForMindTouchResponse(response, `Error creating page "${createTitle}"`);
  }
  const createdPage = await getPage(rawPath, subdomain);
  const pageID = createdPage?.["@id"]?.toString();
  // Only accept uri.ui — @href from the info endpoint is the API URL form
  // and must not be stored as the page's human-readable URI.
  const rawUri = createdPage?.["uri.ui"];
  const pageURI = typeof rawUri === "string" && rawUri.length > 0 ? rawUri : "";
  if (!pageID) {
    throw new Error(`Error locating CXOne page ID for "${rawPath}"`);
  }

  await applyDefaultRemixerPageProperties(subdomain, pageID);

  return { pageID, pageURI };
};

/** Path segment for move `to` / rename `name` (LibreTexts-style padded slug). */
const remixerPagePaddedSlug = (
  page: RemixerSubPageState,
  displayTitle: string,
  isBookRoot: boolean = false,
): string => {
  const rawTitle = page["@title"] || page.title || displayTitle;
  if (isBookRoot) {
    return rawTitle
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[\:\.\-]/g, "_");
  }
  return buildRemixerPagePathSegment(page, rawTitle, page.siblingTitleIndex);
};

const handleDeletedPage = async (
  page: RemixerSubPageState,
  subdomain: string,
): Promise<void> => {
  const pageId = page["@id"];
  const isImported = pageId?.split("-").length === 3;
  if (!pageId || pageId.startsWith("new-") || isImported) return;

  const pid = parseInt(pageId, 10);
  if (Number.isNaN(pid)) return;

  const dekiHeaders = await generateAPIRequestHeaders(subdomain);
  if (!dekiHeaders) {
    throw new Error("Error generating library API headers for delete.");
  }

  const response = await fetch(
    `https://${subdomain}.libretexts.org/@api/deki/pages/${pid}?dream.out.format=json&origin=mt-web&recursive=true`,
    {
      method: "DELETE",
      headers: {
        ...dekiHeaders,
      },
    },
  );

  // Deletes are recursive, and a subtree's descendants are queued as their own
  // entries, so by the time a child's DELETE runs its ancestor has usually
  // already taken it. "Not there" is the outcome this call wanted, not a
  // failure. Reporting it as one would flag every multi-level delete.
  // Same reasoning for a page removed out of band since the draft was loaded.
  if (response.status === 404 || response.status === 410) {
    return;
  }

  if (!response.ok) {
    throwForMindTouchResponse(response, "Error deleting page");
  }
};

const handleModifiedPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState | undefined,
  title: string,
  subdomain: string,
  coverId?: string,
): Promise<void> => {
  if (!page.renamedItem && !page.movedItem && !page.isPlacementChanged) {
    return;
  }

  const isBookRoot = page?.["@id"] === "-1" || page?.["@id"] === coverId;

  const pageId = page["@id"];
  if (!pageId || pageId.startsWith("new-")) return;

  const pid = parseInt(pageId, 10);
  if (Number.isNaN(pid)) return;

  const isMoved = page.movedItem === true || page.isPlacementChanged === true;
  const isRenamed = page.renamedItem === true;

  if (isMoved && !parent) {
    // No parent found in the book at all — a genuinely broken reference,
    // not a transient ordering conflict. Fail fast with the specific,
    // actionable message rather than burning through the deferred-retry
    // budget only to fail later with a generic "conflict" message.
    throw new Error(
      "Moving or reordering a page requires a published parent in the target book.",
    );
  }

  if (isMoved && parent?.["@id"]?.startsWith("new-")) {
    // Defer rather than fail the job: the parent may still be a placeholder
    // `new-…` id whose create is waiting on a deleted occupant to vacate.
    throw new ParentNotReadyError(
      "Moving or reordering a page requires a published parent in the target book.",
    );
  }

  const dekiHeaders = await generateAPIRequestHeaders(subdomain);
  if (!dekiHeaders) {
    throw new Error("Error generating library API headers for move/rename.");
  }

  const titleEnc = encodeURIComponent(title);
  const base = `https://${subdomain}.libretexts.org/@api/deki/pages/${pid}`;

  let moveUrl: string;

  // Decode path segments from uri.ui (which may have %3A-encoded colons)
  // before double-encoding, to avoid triple-encoding colons in the final URL.
  const safeDecPath = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };

  if (isMoved && !isRenamed) {
    const pageUri = await resolveUiUri(page, subdomain);
    const currentPathSegments = extractPagePath(pageUri)
      .split("/")
      .filter(Boolean);
    const leaf =
      currentPathSegments.length > 0
        ? safeDecPath(currentPathSegments[currentPathSegments.length - 1]!)
        : remixerPagePaddedSlug(page, title, isBookRoot);
    const parentPath = safeDecPath(
      extractPagePath(await resolveUiUri(parent!, subdomain)),
    );
    const newPathRaw = `${parentPath}/${leaf}`;
    const toEnc = encodeURIComponent(encodeURIComponent(newPathRaw));
    moveUrl = `${base}/move?title=${titleEnc}&to=${toEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isRenamed && !isMoved) {
    const padded = remixerPagePaddedSlug(page, title, isBookRoot);
    const nameEnc = encodeURIComponent(padded);

    moveUrl = `${base}/move?title=${titleEnc}&name=${nameEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isMoved && isRenamed) {
    const parentPath = safeDecPath(
      extractPagePath(await resolveUiUri(parent!, subdomain)),
    );
    const padded = remixerPagePaddedSlug(page, title, isBookRoot);
    const newPathRaw = `${parentPath}/${padded}`;
    const toEnc = encodeURIComponent(encodeURIComponent(newPathRaw));
    moveUrl = `${base}/move?title=${titleEnc}&to=${toEnc}&allow=deleteredirects&dream.out.format=json`;
  } else {
    return;
  }

  const response = await fetch(moveUrl, {
    method: "POST",
    body: "",
    headers: {
      "Content-Type": "text/plain",
      ...dekiHeaders,
    },
  });

  if (!response.ok) {
    throwForMindTouchResponse(response, "Error moving/renaming page");
  }

  // Placement: cover children are topic-guide; nested pages are topic.
  if (isMoved && coverId && parent) {
    const kind = articleKindForPlacement(page["@id"], parent["@id"], coverId);
    await applyArticleKindToPage(page, kind, subdomain, coverId);
  }
};

/**
 * Moves an existing page to a throwaway, guaranteed-unique title/path
 * under its current parent, without touching our local record of its
 * intended final title. Used to break title/URL swap deadlocks: relocating
 * one page out of the way frees the slot another pending page needs; the
 * relocated page keeps its real target and is simply retried again on a
 * later scheduling pass, by which point its target should be vacated.
 */
const temporarilyRelocatePage = async (
  page: RemixerSubPageState,
  subdomain: string,
): Promise<void> => {
  const pid = parseInt(page["@id"], 10);
  if (Number.isNaN(pid)) return;

  const dekiHeaders = await generateAPIRequestHeaders(subdomain);
  if (!dekiHeaders) {
    throw new Error(
      "Error generating library API headers for temporary relocation.",
    );
  }

  const tempName = `remixer-swap-tmp-${pid}-${base62(8)}`;
  const nameEnc = encodeURIComponent(tempName);
  const titleEnc = encodeURIComponent(tempName);
  const moveUrl = `https://${subdomain}.libretexts.org/@api/deki/pages/${pid}/move?title=${titleEnc}&name=${nameEnc}&allow=deleteredirects&dream.out.format=json`;

  const response = await fetch(moveUrl, {
    method: "POST",
    body: "",
    headers: {
      "Content-Type": "text/plain",
      ...dekiHeaders,
    },
  });

  if (!response.ok) {
    throwForMindTouchResponse(
      response,
      "Error temporarily relocating page to break a title/URL conflict",
    );
  }
};

/**
 * A deleted sibling that currently occupies the title/URL the given page wants.
 * Matching is by original ordinal path (what the deleted page used to be) or
 * by the live URI leaf vs the segment we would create — either is enough to
 * know a first-pass create would 409 and a recursive delete of the occupant
 * would cascade-wipe children that still live under it.
 */
const findDeletedPathOccupant = (
  page: RemixerSubPageState,
  allPages: RemixerSubPageState[],
): RemixerSubPageState | undefined => {
  const parentID = page.parentID ?? "-1";
  const intendedPath = (page.pathNumber ?? []).join(".");
  const rawTitle = page["@title"] || page.title || "";
  const intendedSegment = buildRemixerPagePathSegment(
    page,
    rawTitle,
    page.siblingTitleIndex,
  );

  return allPages.find((candidate) => {
    if (candidate === page) return false;
    if (getPageStatus(candidate) !== "deleted") return false;
    if ((candidate.parentID ?? "-1") !== parentID) return false;

    const occupantPath = (
      candidate.originalPathNumber ??
      candidate.pathNumber ??
      []
    ).join(".");
    if (intendedPath.length > 0 && occupantPath === intendedPath) return true;

    const rawLeaf =
      (getRemixerPageUriUi(candidate).split("/").pop() ?? "").split("?")[0] ??
      "";
    // Malformed legacy percent-encoding (e.g. a lone "%" from an old,
    // partially-encoded title) must not abort the whole publish job — treat
    // an undecodable leaf as simply not matching, same as the other
    // decodeURIComponent call sites in this file.
    let leaf: string;
    try {
      leaf = decodeURIComponent(rawLeaf);
    } catch {
      leaf = rawLeaf;
    }
    return leaf.length > 0 && leaf === intendedSegment;
  });
};

/** Rename a page that was created at a placeholder path onto its intended slug. */
const renamePageToIntended = async (
  page: RemixerSubPageState,
  title: string,
  subdomain: string,
): Promise<void> => {
  const pid = parseInt(page["@id"], 10);
  if (Number.isNaN(pid)) return;

  const dekiHeaders = await generateAPIRequestHeaders(subdomain);
  if (!dekiHeaders) {
    throw new Error(
      "Error generating library API headers for placeholder rename.",
    );
  }

  const padded = remixerPagePaddedSlug(page, title, false);
  const nameEnc = encodeURIComponent(padded);
  const titleEnc = encodeURIComponent(title);
  const moveUrl = `https://${subdomain}.libretexts.org/@api/deki/pages/${pid}/move?title=${titleEnc}&name=${nameEnc}&allow=deleteredirects&dream.out.format=json`;

  const response = await fetch(moveUrl, {
    method: "POST",
    body: "",
    headers: {
      "Content-Type": "text/plain",
      ...dekiHeaders,
    },
  });

  if (!response.ok) {
    throwForMindTouchResponse(
      response,
      `Error renaming placeholder page to "${title}"`,
    );
  }
};

/**
 * Resolves the true source of a transcluded page by inspecting its raw
 * wikitext. `detectTranscludeStub` only reports a source when the page body is
 * *nothing but* a pointer at another page, in either the cross-library
 * (CrossTransclude/Web) or same-library (whole-page content reuse) form.
 *
 * A page that merely *embeds* content-reuse blocks owns its content and is its
 * own source — resolving it to one of its embedded blocks would publish that
 * block in place of the page.
 *
 * Recursively follows the chain (a stub that itself points at another stub)
 * until reaching a page that owns its content, or returns the fallback.
 */
const resolveTranscludeSource = async ({
  subdomain,
  pageId,
  fallbackUri,
  visited = new Set<string>(),
}: {
  subdomain: string;
  pageId: number;
  fallbackUri: string;
  /** Guards against cyclic transclusion chains (A→B→A, or a page reusing itself). */
  visited?: Set<string>;
}): Promise<{
  sourceSubdomain: string;
  sourceId: number;
  sourceUri: string;
}> => {
  const fallback = {
    sourceSubdomain: subdomain,
    sourceId: pageId,
    sourceUri: fallbackUri,
  };

  // Stop if we've already resolved this page in the current chain (cycle) or
  // the chain is unreasonably deep — either way, treat the current page as the
  // source rather than recursing forever.
  const visitKey = `${subdomain}:${pageId}`;
  if (visited.has(visitKey) || visited.size >= 20) return fallback;
  visited.add(visitKey);

  const sourceHeaders = await generateAPIRequestHeaders(subdomain);
  const rawRes = await CXOneFetch({
    scope: "page",
    path: pageId,
    api: MindTouch.API.Page.GET_page_RawContents,
    subdomain,
    options: { headers: { ...sourceHeaders } },
  });

  if (!rawRes.ok) return fallback;

  const rawContents = await rawRes.text();

  // A page that owns its content — including one that embeds content-reuse
  // blocks — is the source. Only a pure pointer page resolves onward.
  const stub = detectTranscludeStub(rawContents);
  if (!stub) return fallback;

  remixerLog.debug(
    { subdomain, pageId, stub },
    "Resolved transclusion stub to its source",
  );

  // ── Cross-library (CrossTransclude/Web) ───────────────────────────────────
  if (stub.kind === "cross-library") {
    const nestedSubdomain = stub.subdomain;
    const nestedId = stub.pageID;

    const nestedHeaders = await generateAPIRequestHeaders(nestedSubdomain);
    const nestedPageRes = await CXOneFetch({
      scope: "page",
      path: nestedId,
      api: MindTouch.API.Page.GET_Page,
      subdomain: nestedSubdomain,
      options: { headers: { ...nestedHeaders } },
    });

    let nestedUri = fallbackUri;
    if (nestedPageRes.ok) {
      const nestedPage = (await nestedPageRes.json()) as Record<
        string,
        unknown
      >;
      const resolvedUri = nestedPage["uri.ui"];
      if (typeof resolvedUri === "string" && resolvedUri.length > 0) {
        nestedUri = resolvedUri;
      }
    }

    return resolveTranscludeSource({
      subdomain: nestedSubdomain,
      pageId: nestedId,
      fallbackUri: nestedUri,
      visited,
    });
  }

  // ── Same-library whole-page content reuse ─────────────────────────────────
  // The path carries a URL whose first segment is the library subdomain:
  // /<subdomain>/<...rest>  OR  <subdomain>/<...rest>
  // detectTranscludeStub only emits this variant with a non-empty path.

  // Resolve the path to a real page ID on MindTouch
  const pageInfo = await getPage(stub.path, subdomain);
  if (!pageInfo) return fallback;

  const resolvedId = parseInt(pageInfo["@id"]?.toString() ?? "", 10);
  if (Number.isNaN(resolvedId)) return fallback;

  const resolvedUri =
    typeof pageInfo["uri.ui"] === "string" && pageInfo["uri.ui"].length > 0
      ? (pageInfo["uri.ui"] as string)
      : fallbackUri;

  return resolveTranscludeSource({
    subdomain,
    pageId: resolvedId,
    fallbackUri: resolvedUri,
    visited,
  });
};

const hasSubpages = (
  page: RemixerSubPageState,
  book: RemixerSubPageState[],
): boolean => {
  return book.some((p) => p.parentID === page["@id"] && p.deletedItem !== true);
};

const PAGE_THUMBNAIL_FILENAME = "mindtouch.page#thumbnail";

type RemixerFileMigration = {
  original: string;
  final: string;
  oldID: string;
  newID: string;
};

const hrefPathname = (href: string): string => {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
};

const formatMiB = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

/**
 * Copies every attached file (except the page thumbnail, which is handled
 * separately) from a source page onto a newly created target page, and
 * returns URL/id substitutions for rewriting the copied HTML.
 *
 * A file that cannot be copied (unavailable, or larger than
 * `MAX_COPYABLE_FILE_BYTES`) is skipped individually rather than failing the
 * page: its HTML keeps pointing at the source library's copy, which still
 * resolves. Each skip is reported through `warnings` so the publish log says
 * so instead of leaving it to the server logs.
 */
const copySourcePageFiles = async ({
  sourceService,
  sourceId,
  targetService,
  targetId,
  warnings,
}: {
  sourceService: BookService;
  sourceId: string;
  targetService: BookService;
  targetId: string;
  warnings: string[];
}): Promise<RemixerFileMigration[]> => {
  const sourceFiles = await sourceService.getPageFiles(sourceId);
  const migrations: RemixerFileMigration[] = [];
  const maxBytes = BookService.MAX_COPYABLE_FILE_BYTES;

  for (const file of sourceFiles) {
    const filename = file.filename;
    const oldID = file["@id"];
    if (!filename || !oldID) continue;
    if (filename === PAGE_THUMBNAIL_FILENAME) continue;
    if (file["@res-is-deleted"] === "true") continue;

    // Skip on the listing's declared size before opening the download at all;
    // getFileBytes re-checks for responses that arrive without a Content-Length.
    const declaredSize = Number(file.contents?.["@size"]);
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      warnings.push(
        `attachment "${filename}" (${formatMiB(declaredSize)}) exceeds the ${formatMiB(maxBytes)} copy limit and still points at the source library`,
      );
      continue;
    }

    const downloaded = await sourceService.getFileBytes(oldID, { maxBytes });
    if (!downloaded.ok) {
      const detail =
        downloaded.reason === "too-large"
          ? `${formatMiB(downloaded.size)} exceeds the ${formatMiB(maxBytes)} copy limit`
          : "could not be downloaded";
      warnings.push(
        `attachment "${filename}" ${detail} and still points at the source library`,
      );
      remixerLog.warn(
        `Full copy: skipping file ${oldID} (${filename}) from source page ${sourceId}: ${downloaded.reason}`,
      );
      continue;
    }

    const contentType =
      file.contents?.["@type"] ||
      downloaded.contentType ||
      "application/octet-stream";
    const uploaded = await targetService.putPageFile(
      targetId,
      filename,
      downloaded.bytes,
      contentType,
    );
    const newID = uploaded?.["@id"];
    if (!uploaded || !newID) {
      warnings.push(
        `attachment "${filename}" could not be uploaded and still points at the source library`,
      );
      remixerLog.warn(
        `Full copy: could not upload file ${filename} to target page ${targetId}`,
      );
      continue;
    }

    const oldHref = file.contents?.["@href"] || file["@href"] || "";
    const newHref = uploaded.contents?.["@href"] || uploaded["@href"] || "";
    const oldPath = hrefPathname(oldHref);
    const newPath = hrefPathname(newHref);

    if (oldHref && newHref) {
      migrations.push({ original: oldHref, final: newHref, oldID, newID });
    }
    if (oldPath && newPath && oldPath !== oldHref) {
      migrations.push({ original: oldPath, final: newPath, oldID, newID });
    }
    migrations.push({
      original: `/@api/deki/files/${oldID}/`,
      final: `/@api/deki/files/${newID}/`,
      oldID,
      newID,
    });
  }

  return migrations;
};

const handleImportedPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
  copyModeState: RemixerCopyMode,
  hasChildren: boolean,
  coverId?: string,
  options?: CreatePageOptions,
): Promise<{ pageID: string; pageURI: string; warnings: string[] }> => {
  // Per-page, non-fatal notes (skipped attachments, file-copy fallback) that the
  // caller folds into the job log so they reach the publish panel, not just pino.
  const warnings: string[] = [];
  const sourceUri = getRemixerPageUriUi(page);
  const sourceSubdomain = extractLibretextsSubdomain(sourceUri);
  if (!sourceSubdomain) {
    throw new Error(
      "Could not determine source library subdomain for imported page.",
    );
  }

  const sourceId = parseInt(page.sourceID ?? page["@id"], 10);
  if (Number.isNaN(sourceId)) {
    throw new Error("Imported page is missing a numeric source page id.");
  }

  const { pageID, pageURI } = await handleNewPage(
    page,
    parent,
    title,
    subdomain,
    coverId,
    options,
  );

  let contentsBody: string;
  let postComment: string;
  const dekiHeaders = await generateAPIRequestHeaders(subdomain);

  const sourceService = new BookService({
    bookID: `${sourceSubdomain}-${sourceId}`,
  });
  const sourceTags = await sourceService.getPageTags(sourceId.toString());
  // Drop the source page's own article:* tag — its kind reflected the
  // source's position, not this import's target placement. The correct
  // kind is computed below from the target parent/coverId and applied
  // explicitly via applyArticleKindToPage.
  const preservedTags = sourceTags
    .map((tag) => tag["@value"])
    .filter((tag) => !tag.startsWith("article:"));

  const shouldTransclude = copyModeState === "Transclude" && !hasChildren;
  if (shouldTransclude) {
    const resolvedSource = await resolveTranscludeSource({
      subdomain: sourceSubdomain,
      pageId: sourceId,
      fallbackUri: sourceUri,
    });

    if (resolvedSource.sourceSubdomain === subdomain) {
      const trimmedSourceUri = extractPagePath(resolvedSource.sourceUri);
      contentsBody = RemixerTemplates.POST_TranscludeSameLibrary(
        trimmedSourceUri,
        [],
      );
    } else {
      contentsBody = RemixerTemplates.POST_TranscludeCrossLibrary(
        resolvedSource.sourceSubdomain,
        resolvedSource.sourceId,
        resolvedSource.sourceUri,
        [],
      );
    }
    postComment = "Remixer transclude";
  } else {
    const htmlRes = await CXOneFetch({
      scope: "page",
      path: sourceId,
      api: MindTouch.API.Page.GET_Page_Contents("json", "edit"),
      subdomain: sourceSubdomain,
    });
    if (!htmlRes.ok) {
      throwForMindTouchResponse(htmlRes, "Error reading source page contents");
    }
    const htmlJson = await htmlRes.json();
    const rawBody = htmlJson?.body;
    const rawHtml =
      typeof rawBody === "string"
        ? rawBody
        : Array.isArray(rawBody)
          ? String(rawBody[0] ?? "")
          : "";
    // Fragment parse so we don't wrap the body in <html><head><body>.
    const $ = cheerio.load(rawHtml, null, false);
    $(".mt-guide-content").remove();
    const cleanedRawHtml = $.root().html() ?? $.html() ?? "";

    if (copyModeState === "Full") {
      try {
        const targetService = new BookService({
          bookID: `${subdomain}-${pageID}`,
        });
        const migrations = await copySourcePageFiles({
          sourceService,
          sourceId: sourceId.toString(),
          targetService,
          targetId: pageID,
          warnings,
        });
        contentsBody = RemixerTemplates.POST_FullCopyPage(
          cleanedRawHtml,
          migrations,
          [],
        );
        postComment = "Remixer full copy";
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        warnings.push(
          `full copy of attached files failed (${detail}); the page's files still point at the source library`,
        );
        remixerLog.warn(
          { err },
          `Full copy file migration failed for page ${sourceId}; falling back to fork URLs`,
        );
        contentsBody = RemixerTemplates.POST_ForkPage(
          cleanedRawHtml,
          sourceSubdomain,
          [],
        );
        postComment = "Remixer full copy (file copy failed, using source URLs)";
      }
    } else {
      contentsBody = RemixerTemplates.POST_ForkPage(
        cleanedRawHtml,
        sourceSubdomain,
        [],
      );
      postComment = "Remixer fork";
    }
  }
  const kind = articleKindForPlacement(page["@id"], parent["@id"], coverId);
  contentsBody = contentTemplateForArticleKind(kind) + contentsBody;
  const postRes = await CXOneFetch({
    scope: "page",
    path: parseInt(pageID, 10),
    api: MindTouch.API.Page.POST_Contents,
    subdomain,
    query: { edittime: "now", comment: postComment },
    options: {
      method: "POST",
      body: contentsBody,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...dekiHeaders },
    },
  });

  if (!postRes.ok) {
    throwForMindTouchResponse(postRes, "Error posting imported content");
  }
  const targetService = new BookService({
    bookID: `${subdomain}-${pageID}`,
  });
  try {
    if (shouldTransclude) {
      // make sure transcluded:yes is in the tags
      if (!preservedTags.includes("transcluded:yes")) {
        preservedTags.push("transcluded:yes");
      }
    } else {
      // make sure transcluded:no is in the tags
      if (!preservedTags.includes("transcluded:no")) {
        preservedTags.push("transcluded:no");
      }
    }
    await targetService.updatePageDetails(pageID, undefined, preservedTags);
  } catch (error) {
    logger.error({ err: error }, "handleImportedPage failed");
  }

  // Explicitly (re)apply the placement-derived article kind, mirroring the
  // move-handler's use of applyArticleKindToPage — this is the source of
  // truth for the tag/ShowOrg state, independent of whether the create-time
  // content template was parsed into a tag by MindTouch.
  // `pageID` is passed explicitly: the caller does not adopt it onto `page`
  // until this function returns, so `page["@id"]` is still the local import id.
  if (coverId) {
    try {
      await applyArticleKindToPage(page, kind, subdomain, coverId, pageID);
    } catch (error) {
      logger.error(
        { err: error },
        "handleImportedPage: failed to apply article kind",
      );
    }
  }

  await applyDefaultRemixerPageProperties(subdomain, pageID);

  // Copy thumbnail and overview (summary) from the source page — non-fatal.
  await copyPageThumbnailAndOverview({
    sourceSubdomain,
    sourceId,
    targetSubdomain: subdomain,
    targetId: pageID,
  });

  return { pageID, pageURI, warnings };
};

/**
 * Copies the thumbnail image and the overview/summary property from a source
 * page to a target page. Both operations are best-effort — failures are logged
 * but do not abort the import.
 */
const copyPageThumbnailAndOverview = async ({
  sourceSubdomain,
  sourceId,
  targetSubdomain,
  targetId,
}: {
  sourceSubdomain: string;
  sourceId: number;
  targetSubdomain: string;
  targetId: string;
}): Promise<void> => {
  const [sourceHeaders, targetHeaders] = await Promise.all([
    generateAPIRequestHeaders(sourceSubdomain),
    generateAPIRequestHeaders(targetSubdomain),
  ]);

  // ── Thumbnail ────────────────────────────────────────────────────────────
  try {
    const thumbRes = await CXOneFetch({
      scope: "page",
      path: sourceId,
      api: MindTouch.API.Page.PUT_File_Default_Thumbnail,
      subdomain: sourceSubdomain,
      options: {
        method: "GET",
        headers: { ...sourceHeaders },
      },
    });
    if (thumbRes.ok) {
      const thumbBlob = await thumbRes.blob();
      const contentType = thumbRes.headers.get("content-type") ?? "image/png";
      const putRes = await CXOneFetch({
        scope: "page",
        path: parseInt(targetId, 10),
        api: MindTouch.API.Page.PUT_File_Default_Thumbnail,
        subdomain: targetSubdomain,
        options: {
          method: "PUT",
          body: thumbBlob,
          headers: {
            "Content-Type": contentType,
            ...targetHeaders,
          },
        },
      });
      if (!putRes.ok) {
        remixerLog.warn(
          `Could not copy thumbnail to page ${targetId}: ${putRes.status}`,
        );
      }
    }
  } catch (err) {
    remixerLog.warn({ err }, "Non-fatal error copying thumbnail");
  }

  // ── Overview / Summary ───────────────────────────────────────────────────
  try {
    const sourceService = new BookService({
      bookID: `${sourceSubdomain}-${sourceId}`,
    });
    const { overview } = await sourceService.getPageOverview(
      sourceId.toString(),
    );
    if (overview) {
      const targetService = new BookService({
        bookID: `${targetSubdomain}-${targetId}`,
      });
      await targetService.updatePageDetails(targetId, overview);
    }
  } catch (err) {
    remixerLog.warn({ err }, "Non-fatal error copying Summary");
  }
};

interface RunRemixerJobParams {
  jobID: string;
  projectID: string;
  subdomain: string;
  coverId: string;
}

/** Plain snapshot of a remixer page for persistence (avoids spreading Mongoose subdocs). */
type RemixerSubPagePlain = Record<string, unknown>;

const remixerSubPageToPlain = (
  page: RemixerSubPageState,
): RemixerSubPagePlain => {
  const maybeDoc = page as unknown as {
    toObject?: (opts?: { getters?: boolean }) => RemixerSubPagePlain;
  };
  if (typeof maybeDoc.toObject === "function") {
    return maybeDoc.toObject({ getters: true });
  }
  return { ...(page as unknown as RemixerSubPagePlain) };
};

/** Plain remixer page for API responses (flat `"uri.ui"`, no Mongoose internals). */
const remixerSubPageToResponse = (
  page: RemixerSubPageState,
): RemixerSubPageState => {
  const raw = remixerSubPageToPlain(page) as RemixerSubPagePlain & {
    uri?: { ui?: string };
  };
  const { uri: _uri, ...rest } = raw;
  return {
    ...(rest as unknown as RemixerSubPageState),
    "uri.ui": getRemixerPageUriUi(page),
  };
};

const normalizeArticle = (value: unknown): RemixerSubPageState["article"] => {
  if (
    value === "article" ||
    value === "topic-category" ||
    value === "topic-guide"
  ) {
    return value;
  }
  return "article";
};

/**
 * Build a normalized entry for the post-publish remixer book snapshot.
 * Assumes `page` has already been mutated with the latest `@id`, `@href`,
 * and `uri.ui` from MindTouch. Resets all change-tracking flags since the
 * snapshot represents the newly published steady state.
 */
const toFinalBookEntry = (
  page: RemixerSubPageState,
  subdomain: string,
  book: RemixerSubPageState[],
  displayTitle?: string,
): RemixerSubPageState => {
  const plain = remixerSubPageToPlain(page);
  const rawTitle = plain["@title"] ?? plain.title;
  const title =
    typeof rawTitle === "string" && rawTitle.trim().length > 0
      ? rawTitle.trim()
      : "Untitled";
  // uri.ui must be the human-readable URL. @href from MindTouch is the API
  // URL (e.g. @api/deki/pages/123?redirects=0) and must never be used as
  // the uri.ui value — it would corrupt child-path construction on the next run.
  // Mongoose toObject() expands "uri.ui" into a nested { uri: { ui } } object
  // due to dot-notation path interpretation; fall back to the flat key for
  // plain (non-Mongoose) objects.
  const rawUriUi =
    (plain as unknown as { uri?: { ui?: unknown } }).uri?.ui ?? plain["uri.ui"];
  const rawHref = plain["@href"];
  const isApiUrl = (v: unknown): boolean =>
    typeof v === "string" &&
    (v.includes("/@api/deki/") || v.startsWith("@api/deki/"));
  const uriUi = String(
    typeof rawUriUi === "string" && rawUriUi.length > 0 && !isApiUrl(rawUriUi)
      ? rawUriUi
      : "",
  );
  const href = String(rawHref ?? rawUriUi ?? "");
  return {
    "@id": String(plain["@id"] ?? ""),
    "@title": displayTitle ?? title,
    "@href": href,
    "@subpages": hasSubpages(page, book),
    article: normalizeArticle(plain.article),
    title,
    parentID: typeof plain.parentID === "string" ? plain.parentID : undefined,
    namespace: subdomain,
    "uri.ui": uriUi,
    originalPathNumber: Array.isArray(plain.pathNumber)
      ? (plain.pathNumber as string[])
      : undefined,
    pathNumber: Array.isArray(plain.pathNumber)
      ? (plain.pathNumber as string[])
      : undefined,
    numberedPath:
      typeof plain.numberedPath === "string" ? plain.numberedPath : undefined,
    formattedPath:
      typeof plain.formattedPath === "string" ? plain.formattedPath : undefined,
    formattedPathOverride:
      typeof plain.formattedPathOverride === "boolean"
        ? plain.formattedPathOverride
        : undefined,
    // Carry the override value itself forward through publish, same as
    // formattedPathOverride/formattedPath above — its `original*` baseline is
    // intentionally left unset here (mirroring originalFormattedPathOverride/
    // originalFormattedPath, also absent here) so the client's normalizeBookState
    // re-seeds it from this just-published value on the next load, the same
    // mechanism the autonumber override baseline uses to avoid a false
    // "edited" flag right after a clean publish.
    overrideUriUiEnding:
      typeof plain.overrideUriUiEnding === "string" &&
      plain.overrideUriUiEnding.length > 0
        ? plain.overrideUriUiEnding
        : undefined,
    isDeleted: false,
    isImported: false,
    isRenamed: false,
    isPlacementChanged: false,
    addedItem: false,
    movedItem: false,
    renamedItem: false,
    deletedItem: false,
    deletedViaAncestor: false,
  };
};

/**
 * Renders a bounded preview of offending page IDs for an error/log message.
 * A malicious payload can carry thousands of out-of-book IDs; we always report
 * the full count but cap the enumerated list so the message can't blow up logs.
 */
const previewPageIDs = (ids: string[], limit = 20): string => {
  if (ids.length <= limit) return ids.join(", ");
  return `${ids.slice(0, limit).join(", ")}, …and ${ids.length - limit} more`;
};

const runRemixerJob = async ({
  jobID,
  projectID,
  subdomain,
  coverId,
}: RunRemixerJobParams) => {
  const job = await PrejectRemixerJob.findOne({ jobID: { $eq: jobID } }).sort({
    _id: -1,
  });
  const remixerState = await PrejectRemixer.findOne({
    projectID: { $eq: projectID },
  }).sort({
    _id: -1,
  });
  let finalBook: RemixerSubPageState[] = [];
  if (!remixerState) {
    throw new Error("Remixer state not found");
  }
  if (!job) {
    throw new Error("Job not found");
  }

  try {
    if (job.status === "pending") {
      job.status = "running";
      job.messages.push("Remixer job started.");
      await job.save();
    }

    const pages = remixerState.remixerCurrentBook;

    // ── Ownership gate ───────────────────────────────────────────────────────
    // Every mutation this job performs is keyed on client-supplied page IDs.
    // Before touching the library, confirm that no page outside THIS project's
    // book is moved/renamed/deleted, and that no new/imported content is
    // grafted onto a page the project doesn't own. Fail closed on any breach.
    // Book identity is `${subdomain}-${coverId}` (server-derived from the
    // project), the definitive source of truth per redirect/path caveats.
    let ownedPageIDs: string[];
    try {
      const bookService = new BookService({
        bookID: `${subdomain}-${coverId}`,
      });
      ownedPageIDs = await bookService.getBookPageIDs(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to resolve the project's book contents for authorization; refusing to publish (${detail}).`,
      );
    }
    if (ownedPageIDs.length === 0) {
      // A published book always resolves at least its cover page. An empty set
      // means the TOC lookup failed silently — do not treat "nothing owned" as
      // permission to skip the check.
      throw new Error(
        "Could not resolve any pages for the project's book; refusing to publish.",
      );
    }
    const ownedIDs = new Set(ownedPageIDs);
    const { mutated, grafted } = findUnownedRemixerPageIDs(pages, ownedIDs);
    if (mutated.length > 0 || grafted.length > 0) {
      const parts: string[] = [];
      if (mutated.length > 0) {
        parts.push(
          `${mutated.length} page(s) outside this book flagged for edit/delete (${previewPageIDs(mutated)})`,
        );
      }
      if (grafted.length > 0) {
        parts.push(
          `${grafted.length} new/imported page(s) not anchored in this book (${previewPageIDs(grafted)})`,
        );
      }
      throw new Error(
        `Refusing to publish: the remix references content outside this project's book — ${parts.join("; ")}.`,
      );
    }

    const copyModeState = normalizeRemixerCopyMode(remixerState.copyModeState);
    const byId = new Map(pages.map((p) => [p["@id"], p]));

    // parentID → child nodes, built once and reused by remapDescendantUriPaths
    // for every modified page (parentID relationships are fixed for the run).
    const childrenByParent = new Map<string, RemixerSubPageState[]>();
    pages.forEach((p) => {
      const pid = p.parentID ?? "-1";
      const siblings = childrenByParent.get(pid) ?? [];
      siblings.push(p);
      childrenByParent.set(pid, siblings);
    });

    // Topological sort: parents before children (BFS from roots)
    const childrenOf = new Map<string, string[]>();
    const roots: string[] = [];
    pages.forEach((p) => {
      const pid = p.parentID ?? "-1";
      if (pid === "-1" || !byId.has(pid)) {
        roots.push(p["@id"]);
      } else {
        const siblings = childrenOf.get(pid) ?? [];
        siblings.push(p["@id"]);
        childrenOf.set(pid, siblings);
      }
    });

    // BFS — propagate inMatterBranch and inDeletedBranch to children
    type OrderedEntry = {
      page: RemixerSubPageState;
      inMatterBranch: boolean;
      inDeletedBranch: boolean;
      /** Why this entry was last deferred; read by the deadlock breaker below. */
      lastConflictReason?: "title" | "parent-not-ready";
    };
    const ordered: OrderedEntry[] = [];
    const queue: Array<{
      id: string;
      inMatterBranch: boolean;
      inDeletedBranch: boolean;
    }> = roots.map((id) => ({
      id,
      inMatterBranch: false,
      inDeletedBranch: false,
    }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, inMatterBranch, inDeletedBranch } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = byId.get(id);
      if (!node) continue;
      const nodeMatter = inMatterBranch || isMatterNode(node);
      const nodeDeleted = inDeletedBranch || node.deletedItem === true;
      ordered.push({
        page: node,
        inMatterBranch: nodeMatter,
        inDeletedBranch: nodeDeleted,
      });
      (childrenOf.get(id) ?? []).forEach((childId) =>
        queue.push({
          id: childId,
          inMatterBranch: nodeMatter,
          inDeletedBranch: nodeDeleted,
        }),
      );
    }
    // Append any disconnected nodes not reached from roots
    pages.forEach((p) => {
      if (!visited.has(p["@id"]))
        ordered.push({
          page: p,
          inMatterBranch: false,
          inDeletedBranch: false,
        });
    });

    const autoNumbering = remixerState.autoNumbering === true;

    type PlaceholderRename = {
      page: RemixerSubPageState;
      intendedTitle: string;
    };
    const pendingFinalRenames: PlaceholderRename[] = [];

    /**
     * Real MindTouch ids created by this run. The ownership gate above vets the
     * *submitted* payload, and pages created here did not exist when it ran, so
     * any later pass that writes to a page has to treat these as owned too.
     */
    const createdPageIDs = new Set<string>();

    const adoptCreatedPageId = (
      oldPageId: string,
      page: RemixerSubPageState,
      pageID: string,
      pageURI: string,
    ) => {
      createdPageIDs.add(pageID);
      page["@id"] = pageID;
      setRemixerPageUriUi(page, pageURI || getRemixerPageUriUi(page));
      page["@href"] = pageURI || page["@href"];
      byId.delete(oldPageId);
      byId.set(pageID, page);
      pages.forEach((candidate) => {
        if (candidate.parentID === oldPageId) {
          candidate.parentID = pageID;
        }
      });
      const kids = childrenByParent.get(oldPageId);
      if (kids) {
        childrenByParent.delete(oldPageId);
        childrenByParent.set(pageID, kids);
      }
    };

    /**
     * Processes a single ordered page (create/import/move-rename/delete).
     * Returns "conflict" when MindTouch responds 409 — i.e. the title or
     * URL path this page needs is currently occupied — so the caller can
     * defer it and retry after other pages have had a chance to move.
     * Any other error propagates to the caller and fails the job.
     */
    const processOrderedEntry = async (
      entry: OrderedEntry,
    ): Promise<"success" | "conflict"> => {
      const { page, inMatterBranch, inDeletedBranch } = entry;
      const title = getDisplayTitle(
        page,
        inMatterBranch,
        inDeletedBranch,
        autoNumbering,
      );
      const status = getPageStatus(page);
      const shouldSkip = shouldSkipPage(page, status);

      let message = shouldSkip
        ? `${title} - skipped`
        : `${title} - processed, status: ${status}`;

      // Retry MindTouch-facing work on transient failures (timeouts, 5xx,
      // rate limits, network blips). Non-transient errors propagate.
      const logRetry = async (attempt: number, error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        job.messages.push(
          `${title} - transient failure on attempt ${attempt}; retrying (${msg})`,
        );
        await job.save();
      };

      try {
        if (status === "new") {
          if (shouldSkip) {
            return "success";
          }
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
          if (parent) {
            const occupant = findDeletedPathOccupant(page, pages);
            const placeholder = occupant
              ? `remixer-replace-tmp-${base62(8)}`
              : undefined;
            const createOptions: CreatePageOptions | undefined = placeholder
              ? { titleOverride: placeholder, pathSegmentOverride: placeholder }
              : undefined;
            const oldPageId = page["@id"];
            const { pageID, pageURI } = await withRetryOnTransient(
              () =>
                handleNewPage(
                  page,
                  parent,
                  title,
                  subdomain,
                  coverId,
                  createOptions,
                ),
              { onRetry: logRetry },
            );
            adoptCreatedPageId(oldPageId, page, pageID, pageURI);
            if (placeholder && occupant) {
              pendingFinalRenames.push({ page, intendedTitle: title });
              message = `${title} - created at a temporary path because "${occupant.title || occupant["@title"]}" still occupies the target`;
            }

            await orderPageAfterPreviousSibling(pageID, page, pages, subdomain);
          }
        } else if (status === "imported") {
          if (shouldSkip) {
            return "success";
          }
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
          if (parent) {
            const occupant = findDeletedPathOccupant(page, pages);
            const placeholder = occupant
              ? `remixer-replace-tmp-${base62(8)}`
              : undefined;
            const createOptions: CreatePageOptions | undefined = placeholder
              ? { titleOverride: placeholder, pathSegmentOverride: placeholder }
              : undefined;
            const oldPageId = page["@id"];
            const { pageID, pageURI, warnings } = await withRetryOnTransient(
              () =>
                handleImportedPage(
                  page,
                  parent,
                  title,
                  subdomain,
                  copyModeState,
                  hasSubpages(page, pages),
                  coverId,
                  createOptions,
                ),
              { onRetry: logRetry },
            );
            adoptCreatedPageId(oldPageId, page, pageID, pageURI);
            // The page itself imported fine; these are per-file degradations
            // that would otherwise only exist in the server log.
            for (const warning of warnings) {
              job.messages.push(`${title} - ${warning}`);
            }
            if (placeholder && occupant) {
              pendingFinalRenames.push({ page, intendedTitle: title });
              message = `${title} - created at a temporary path because "${occupant.title || occupant["@title"]}" still occupies the target`;
            }

            await orderPageAfterPreviousSibling(pageID, page, pages, subdomain);
          }
        } else if (status === "modified") {
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
          const oldUri = await resolveUiUri(page, subdomain);
          await withRetryOnTransient(
            () => handleModifiedPage(page, parent, title, subdomain, coverId),
            { onRetry: logRetry },
          );
          const pid = parseInt(page["@id"], 10);
          if (!Number.isNaN(pid)) {
            const info = await getPage(pid, subdomain);
            const uriUiVal = info?.["uri.ui"];
            if (typeof uriUiVal === "string" && uriUiVal.length > 0) {
              setRemixerPageUriUi(page, uriUiVal);
              page["uri.ui"] = uriUiVal as string;
              // The rename/move above just changed this page's own path
              // segment (e.g. renaming the book root changes its slug),
              // which shifts the URL of every descendant too — rewrite
              // their cached uri.ui so later steps in this run (new-page
              // creation, further moves, the final snapshot) use the real,
              // current URL instead of the now-stale cached one.
              remapDescendantUriPaths(
                childrenByParent,
                page["@id"],
                oldUri,
                uriUiVal,
                subdomain,
              );
            }
          }
        } else if (status === "deleted") {
          try {
            await withRetryOnTransient(
              () => handleDeletedPage(page, subdomain),
              { onRetry: logRetry },
            );
          } catch (error) {
            // Non-fatal so one undeletable page can't sink the whole publish,
            // but the page is still live upstream while the snapshot below
            // drops it — say so instead of reporting it as processed.
            const detail =
              error instanceof Error ? error.message : String(error);
            message = `${title} - delete FAILED; page still exists in the library (${detail})`;
          }
        }
      } catch (error) {
        if (error instanceof TitleConflictError) {
          const parentNotReady = error instanceof ParentNotReadyError;
          entry.lastConflictReason = parentNotReady
            ? "parent-not-ready"
            : "title";
          job.messages.push(
            parentNotReady
              ? `${title} - its new parent page has not been created yet; deferring for reprocessing.`
              : `${title} - title/URL already in use; deferring for reprocessing.`,
          );
          await job.save();
          return "conflict";
        }
        throw error;
      }

      // Include everything that still exists in the book in the final
      // snapshot. Deleted pages — by status, propagated deletion branch, or
      // direct flags — are dropped.
      const isDeletedPage =
        status === "deleted" ||
        inDeletedBranch ||
        page.isDeleted === true ||
        page.deletedItem === true;
      if (!isDeletedPage) {
        finalBook.push(toFinalBookEntry(page, subdomain, pages, title));
      }

      await new Promise((resolve) =>
        setTimeout(resolve, shouldSkip ? 100 : 100),
      );
      job.messages.push(message);
      await job.save();
      return "success";
    };

    // Pages are processed parent-before-child, but a create/rename/move can
    // hit a 409 from CXOne when the title or URL path it needs is currently
    // occupied — typically by another page in this same run that hasn't
    // been moved out of the way yet (e.g. two or more pages swapping
    // titles/URLs with each other). Rather than failing the whole job on
    // the first conflict, push conflicting pages onto a stack and reprocess
    // them once the rest of the run has had a chance to make progress.
    //
    // Deletes are held back until the straight-line pass over every
    // create/import/move/rename has run. MindTouch deletes use recursive=true,
    // so deleting a chapter while its former children still live under it on
    // the library (even though the draft already reparented them) would
    // cascade-wipe those survivors and cause their later move to fail.
    const isDeleteEntry = (entry: OrderedEntry): boolean => {
      const status = getPageStatus(entry.page);
      return (
        status === "deleted" ||
        entry.inDeletedBranch ||
        entry.page.isDeleted === true ||
        entry.page.deletedItem === true
      );
    };

    const nonDeleteOrdered = ordered.filter((entry) => !isDeleteEntry(entry));
    const deleteOrdered = ordered.filter((entry) => isDeleteEntry(entry));

    let deferredStack: OrderedEntry[] = [];
    for (const entry of nonDeleteOrdered) {
      const outcome = await processOrderedEntry(entry);
      if (outcome === "conflict") {
        deferredStack.push(entry);
      }
    }

    // Deletes run before the retry loop, not after it. A deferred page whose
    // target path is held by a page being deleted can only ever succeed once
    // that page is gone, so leaving deletes until after the loop guarantees
    // the loop exhausts its passes, relocates a live page to a throwaway
    // title on every one of them, and then throws — leaving the occupant
    // undeleted and the deferred page parked at `remixer-swap-tmp-…`.
    for (const entry of deleteOrdered) {
      const outcome = await processOrderedEntry(entry);
      if (outcome === "conflict") {
        deferredStack.push(entry);
      }
    }

    // Placeholder parents were created under a unique path so children could
    // move onto them without colliding with the deleted occupant. Now that
    // the occupant is gone, rename each placeholder to its intended title.
    for (const pending of pendingFinalRenames) {
      // Non-fatal, like the delete phase above. A 409 here means the occupant
      // never vacated (its delete failed), and a hard throw would fail the job
      // with this page still published under `remixer-replace-tmp-…`. Leave the
      // placeholder in place, say so, and let the rest of the run finish.
      try {
        await withRetryOnTransient(() =>
          renamePageToIntended(pending.page, pending.intendedTitle, subdomain),
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        job.messages.push(
          `${pending.intendedTitle} - still at its temporary path; rename FAILED (${detail}). Resolve the page holding that title/URL and publish again.`,
        );
        await job.save();
        continue;
      }

      const pid = parseInt(pending.page["@id"], 10);
      if (Number.isNaN(pid)) {
        job.messages.push(
          `${pending.intendedTitle} - renamed from its temporary path, but its id could not be resolved to refresh the saved URL.`,
        );
        await job.save();
        continue;
      }

      const info = await getPage(pid, subdomain);
      const uriUiVal = info?.["uri.ui"];
      if (typeof uriUiVal === "string" && uriUiVal.length > 0) {
        const oldUri = getRemixerPageUriUi(pending.page);
        setRemixerPageUriUi(pending.page, uriUiVal);
        pending.page["@href"] = uriUiVal;
        remapDescendantUriPaths(
          childrenByParent,
          pending.page["@id"],
          oldUri,
          uriUiVal,
          subdomain,
        );
      }

      // The rename shifted this page's URL and, recursively, every
      // descendant's. Their finalBook entries were snapshotted back when they
      // were processed, so they still carry the `remixer-replace-tmp-…` path —
      // re-snapshot them from the just-remapped nodes. Display titles are kept
      // from the existing entries; only the URL fields need refreshing.
      const toResnapshot: RemixerSubPageState[] = [
        pending.page,
        ...collectDescendants(childrenByParent, pending.page["@id"]),
      ];
      for (const node of toResnapshot) {
        const idx = finalBook.findIndex((p) => p["@id"] === node["@id"]);
        if (idx < 0) continue;
        const displayTitle =
          node === pending.page
            ? pending.intendedTitle
            : finalBook[idx]["@title"];
        finalBook[idx] = toFinalBookEntry(node, subdomain, pages, displayTitle);
      }

      job.messages.push(
        `${pending.intendedTitle} - renamed from temporary path to intended title.`,
      );
      await job.save();
    }

    const maxRetryPasses = pages.length + 10;
    let retryPass = 0;
    while (deferredStack.length > 0 && retryPass < maxRetryPasses) {
      retryPass++;
      const beforeCount = deferredStack.length;
      const stillStuck: OrderedEntry[] = [];

      // Retry most-recently-deferred first: whatever a page just gave up
      // its slot to is the one most likely to be unblocked now.
      while (deferredStack.length > 0) {
        const entry = deferredStack.pop()!;
        const outcome = await processOrderedEntry(entry);
        if (outcome === "conflict") {
          stillStuck.push(entry);
        }
      }

      if (stillStuck.length === beforeCount) {
        // No page in the deferred set made progress this pass — every
        // pending page is blocked by another pending page's *current*
        // title/URL, a cyclic swap that's a dead end for plain retries.
        // Break the cycle by relocating one already-existing page (one
        // with a real MindTouch id, not a not-yet-created "new" page) to a
        // throwaway temporary title/path. That frees the slot the next
        // page in the cycle needs; the relocated page keeps its real
        // target and gets retried again on a later pass, once whichever
        // page is ahead of it in the cycle has vacated that target.
        // Only a page whose *own* title/URL is the contested slot can break the
        // cycle by stepping aside. A page deferred because its parent has not
        // been created yet holds nothing anyone is waiting on, so relocating it
        // frees no slot and would move a live library page to a throwaway path
        // once per remaining pass before the loop gives up anyway.
        const relocatable = stillStuck.find(
          (entry) =>
            entry.lastConflictReason !== "parent-not-ready" &&
            !Number.isNaN(parseInt(entry.page["@id"], 10)),
        );
        if (!relocatable) {
          const titlesOf = (entries: OrderedEntry[]): string =>
            entries
              .map((entry) =>
                getDisplayTitle(
                  entry.page,
                  entry.inMatterBranch,
                  entry.inDeletedBranch,
                  autoNumbering,
                ),
              )
              .join(", ");
          const parentNotReady = stillStuck.filter(
            (entry) => entry.lastConflictReason === "parent-not-ready",
          );
          if (parentNotReady.length === stillStuck.length) {
            throw new Error(
              `Unable to place: ${titlesOf(parentNotReady)} — the new parent page each one moves under could not be created, because its title/URL is held by a page outside this remix. Resolve that page and publish again.`,
            );
          }
          const titleStuck = stillStuck.filter(
            (entry) => entry.lastConflictReason !== "parent-not-ready",
          );
          throw new Error(
            `Title/URL conflict for: ${titlesOf(titleStuck)} — the conflicting title/path belongs to a page outside this remix and must be resolved manually.`,
          );
        }

        const victimTitle = getDisplayTitle(
          relocatable.page,
          relocatable.inMatterBranch,
          relocatable.inDeletedBranch,
          autoNumbering,
        );
        job.messages.push(
          `${victimTitle} - detected a title/URL swap deadlock among ${stillStuck.length} page(s); temporarily relocating to break the cycle.`,
        );
        await job.save();
        await withRetryOnTransient(() =>
          temporarilyRelocatePage(relocatable.page, subdomain),
        );
      }

      deferredStack = stillStuck;
    }

    if (deferredStack.length > 0) {
      const remainingTitles = deferredStack
        .map((entry) =>
          getDisplayTitle(
            entry.page,
            entry.inMatterBranch,
            entry.inDeletedBranch,
            autoNumbering,
          ),
        )
        .join(", ");
      throw new Error(
        `Unable to resolve title/URL conflicts for: ${remainingTitles}`,
      );
    }

    const bookURL = remixerState.remixerCurrentBook[0]["@href"];

    // ── Article-kind reconciliation pass: guarantee every surviving page's
    // article type matches its final position (book root → topic-category,
    // cover's immediate children → topic-guide, everything else → topic).
    // Move/rename and import already apply the correct kind as they happen
    // (see applyArticleKindToPage above), so this is a cheap self-heal for
    // pages this run didn't touch — e.g. stale kinds left over from data
    // predating that fix — not a full re-apply: a page is only written back
    // to MindTouch when its locally-tracked kind disagrees with the kind its
    // final parentID implies.
    logger.info("[*] Article kind reconciliation pass...");
    if (coverId) {
      for (const finalPage of finalBook) {
        // ── Authorization, not hygiene ──────────────────────────────────────
        // This pass writes tags and, via activateShowOrg, the page BODY. The
        // ownership gate at the top of the job only inspects pages whose status
        // is new/imported/modified/deleted; an entry with no change flags reads
        // as `unchanged`, is never checked against ownedIDs, and still lands in
        // finalBook. `currentBook` is client-supplied (z.record(z.string(),
        // z.any())), so without this guard a project member could name any page
        // id in the library, give it a mismatched `article`, and have the pass
        // overwrite that page.
        //
        // A non-numeric id is refused for the same reason applyArticleKindToPage
        // takes an explicit pageID: every BookService helper parseInts what it
        // is handed, so an unadopted import id (`<sourceID>-<ts>-<rand>`) would
        // resolve to <sourceID> in the TARGET library. That happens whenever a
        // create was skipped because `byId` had no entry for the page's parent,
        // which the gate permits when the parent is an owned page absent from
        // the payload.
        const finalPageID = String(finalPage["@id"] ?? "");
        if (!/^\d+$/.test(finalPageID)) continue;
        if (!ownedIDs.has(finalPageID) && !createdPageIDs.has(finalPageID)) {
          remixerLog.warn(
            { pageId: finalPageID, projectID },
            "Article kind reconciliation: skipping page not owned by this book",
          );
          continue;
        }

        const kind = articleKindForPlacement(
          finalPage["@id"],
          finalPage.parentID,
          coverId,
        );
        if (finalPage.article === localArticleField(kind)) continue;
        try {
          await applyArticleKindToPage(finalPage, kind, subdomain, coverId);
        } catch (error) {
          logger.error(
            { err: error, pageId: finalPage["@id"] },
            "Article kind reconciliation failed for page",
          );
        }
      }
      job.messages.push("Article kind reconciliation pass complete.");
      await job.save();
    }

    // Ensure Back Matter is the last chapter among its siblings.
    logger.info("[*] Ordering Back Matter as last chapter...");
    const orderedBackMatter = await withRetryOnTransient(() =>
      orderBackMatterLast(finalBook, subdomain),
    );
    if (orderedBackMatter) {
      job.messages.push("Back Matter ordered as last chapter.");
      await job.save();
    }

    // ── Final ordering pass: enforce sibling order for every group ────────────
    // BFS over finalBook; for each sibling group, call ORDER_PAGES in sequence
    // so MindTouch reflects the exact intended order even if individual
    // create/move calls placed pages in the wrong slot.
    logger.info("[*] Final sibling ordering pass...");
    {
      const finalById = new Map(finalBook.map((p) => [p["@id"], p]));
      const finalChildrenOf = new Map<string, string[]>();
      const finalRoots: string[] = [];
      for (const p of finalBook) {
        const pid = p.parentID ?? "-1";
        if (pid === "-1" || !finalById.has(pid)) {
          finalRoots.push(p["@id"]);
        } else {
          const siblings = finalChildrenOf.get(pid) ?? [];
          siblings.push(p["@id"]);
          finalChildrenOf.set(pid, siblings);
        }
      }

      // BFS: process each parent's children group in pathNumber order,
      // delegating the actual placement to `orderPageAfterPreviousSibling`
      // (same helper used during create/import) so every page ends up
      // exactly where its pathNumber says it should be, group by group.
      const bfsQueue: string[] = [...finalRoots];
      const bfsVisited = new Set<string>();
      while (bfsQueue.length > 0) {
        const parentId = bfsQueue.shift()!;
        if (bfsVisited.has(parentId)) continue;
        bfsVisited.add(parentId);

        const children = finalChildrenOf.get(parentId) ?? [];
        if (children.length > 0) {
          // Sort by pathNumber ascending so each page is ordered after an
          // already-placed predecessor within its sibling group.
          const sortedChildren = [...children]
            .map((id) => finalById.get(id)!)
            .filter(Boolean)
            .sort((a, b) =>
              (a.pathNumber ?? [])
                .join(".")
                .localeCompare((b.pathNumber ?? []).join("."), undefined, {
                  numeric: true,
                }),
            );

          for (const child of sortedChildren) {
            await orderPageAfterPreviousSibling(
              child["@id"],
              child,
              finalBook,
              subdomain,
            );
            bfsQueue.push(child["@id"]);
          }
        }
      }

      job.messages.push("Final sibling ordering pass complete.");
      await job.save();
    }

    // ── Trigger Mindtouch TOC update ─────────────────────────────────────────
    logger.info("[*] Triggering MindMap TOC update...");
    await fetch(`https://batch.libretexts.org/print/Libretext=${bookURL}`, {
      headers: { origin: "commons.libretexts.org" },
    })
      .then(() => logger.info("MindMap TOC update done"))
      .catch((e) => {
        remixerLog.warn({ err: e }, "MindMap trigger failed (non-fatal)");
      });

    // Archive the remixer state that was just published and persist a fresh
    // snapshot as the new active record. The snapshot captures the fully
    // processed currentbook (with updated page IDs / URIs and reset change
    // flags) plus the settings that drove this run (autoNumbering,
    // copyModeState, pathLevelFormats).
    remixerState.archived = true;
    // await remixerState.save();

    await PrejectRemixer.create({
      projectID: remixerState.projectID,
      archived: false,
      createdBy: remixerState.createdBy,
      updatedBy: remixerState.updatedBy,
      remixerID: base62(10),
      remixerCurrentBook: finalBook,
      autoNumbering: remixerState.autoNumbering,
      copyModeState: remixerState.copyModeState,
      pathLevelFormats: remixerState.pathLevelFormats,
    });

    job.status = "success";
    job.messages.push("Remixer job completed successfully.");
    await job.save();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown remixer publish error";
    job.status = "error";
    job.errorMessage = errorMessage;
    job.messages.push(`Remixer job failed: ${errorMessage}`);
    await job.save();
    throw error;
  }
};

/**
 * Reads the "the user has edited this page" flags off a stored remixer page.
 *
 * Two generations of flags coexist in saved state: the raw `renamedItem` /
 * `movedItem` set by the editor, and the derived `isRenamed` /
 * `isPlacementChanged` added later by `withDerivedStatusFlags` on the client.
 * Both are optional, and older documents carry only the raw pair, so a check
 * against just one form silently misses real user edits.
 *
 * These are treated as "edited if either form says so" on purpose. The caller
 * uses them to decide whether upstream values may overwrite stored ones, so the
 * conservative direction is to keep the local value: a stale title is a
 * cosmetic problem, a discarded rename is data loss.
 */
const getRemixerPageEditFlags = (
  page: RemixerSubPageState,
): { isRenamed: boolean; isPlacementChanged: boolean } => ({
  isRenamed: page.isRenamed === true || page.renamedItem === true,
  isPlacementChanged:
    page.isPlacementChanged === true || page.movedItem === true,
});

/**
 * Locally-imported pages have not been created in MindTouch yet, so they never
 * appear in the live TOC and must not be reconciled against it. The client
 * mints their ids as `${sourceID}-${timestamp}-${random}` (see
 * `computeLibraryImportInsertion` in `client/src/components/remixer/services.ts`),
 * so the `-` is what separates them from a real MindTouch page id.
 */
const isLocallyImportedPageID = (pageID: string): boolean =>
  pageID.includes("-");

/**
 * Path / format fields overlaid from saved remixer state onto a live TOC row.
 * The `original*` baselines travel with the values they are the baseline for:
 * the client's `hasFormattedPathChanged` compares the two, so carrying an
 * override forward without its baseline would flag every override page as
 * renamed the moment a fresh-from-library load preserved configs.
 */
const FORMATTED_PATH_CONFIG_KEYS = [
  "formattedPathOverride",
  "originalFormattedPathOverride",
  "formattedPath",
  "originalFormattedPath",
] as const;

/** URL-ending override fields, carried independently of the numbering override above. */
const URI_ENDING_CONFIG_KEYS = [
  "overrideUriUiEnding",
  "originalOverrideUriUiEnding",
] as const;

const pickSavedPageConfigs = (
  saved: RemixerSubPageState,
): Partial<RemixerSubPageState> => {
  const plain = remixerSubPageToResponse(
    saved,
  ) as unknown as RemixerSubPagePlain;
  const configs: Partial<RemixerSubPageState> = {};

  if (saved.formattedPathOverride === true) {
    for (const key of FORMATTED_PATH_CONFIG_KEYS) {
      const value = plain[key];
      if (value !== undefined) {
        (configs as RemixerSubPagePlain)[key] = value;
      }
    }
  }

  if (
    typeof saved.overrideUriUiEnding === "string" &&
    saved.overrideUriUiEnding.length > 0
  ) {
    for (const key of URI_ENDING_CONFIG_KEYS) {
      const value = plain[key];
      if (value !== undefined) {
        (configs as RemixerSubPagePlain)[key] = value;
      }
    }
  }

  return configs;
};

/**
 * Overlays saved autonumbering / path-format fields onto a live TOC tree.
 * Structure (parentID, href, title) always comes from `toc`; only per-page
 * config is copied from the saved remixer book when the page ids match.
 */
const mergeTocWithSavedConfigs = (
  toc: RemixerSubPage[],
  savedBook: RemixerSubPageState[],
): RemixerSubPage[] => {
  const savedByID = new Map<string, RemixerSubPageState>();
  for (const page of savedBook) {
    const pageID = String(page["@id"] ?? "");
    if (pageID && !isLocallyImportedPageID(pageID)) {
      savedByID.set(pageID, page);
    }
  }

  return toc.map((tocItem) => {
    const saved = savedByID.get(String(tocItem["@id"] ?? ""));
    if (!saved) return tocItem;
    return {
      ...tocItem,
      ...pickSavedPageConfigs(saved),
    };
  });
};

/**
 * Reconciles a saved remixer book against the book's live TOC.
 *
 * - Pages the user has moved or renamed keep their local values; everything
 *   else picks up the current upstream href/title.
 * - Pages that no longer exist upstream are pulled out of the book and returned
 *   as `untracked` so the caller can tell the user what disappeared.
 * - Locally-imported children left orphaned by that removal are reparented to
 *   the root rather than being dropped, and returned as `reparented`.
 *
 * `toc` may be null when the project has no book or the TOC lookup failed. In
 * that case the saved book is returned untouched — reconciling against an
 * absent TOC would report the entire book as untracked and delete it.
 */
const findDifference = (
  remixerCurrentBook: RemixerSubPageState[],
  toc: RemixerSubPage[] | null,
): {
  mutated: RemixerSubPageState[];
  untracked: RemixerSubPageState[];
  reparented: RemixerSubPageState[];
} => {
  const normalize = (page: RemixerSubPageState): RemixerSubPageState => {
    try {
      return remixerSubPageToResponse(page);
    } catch (err) {
      remixerLog.info(
        `findDifference: could not normalize page ${
          page?.["@id"] ?? "(unknown)"
        }: ${err instanceof Error ? err.message : String(err)}`,
      );
      return page;
    }
  };

  if (!toc) {
    return {
      mutated: remixerCurrentBook.map(normalize),
      untracked: [],
      reparented: [],
    };
  }

  const tocByID = new Map<string, RemixerSubPage>();
  for (const tocItem of toc) {
    tocByID.set(String(tocItem["@id"] ?? ""), tocItem);
  }

  const mutated: RemixerSubPageState[] = [];
  const untracked: RemixerSubPageState[] = [];

  for (const item of remixerCurrentBook) {
    const plain = normalize(item);
    const pageID = String(plain["@id"] ?? "");

    if (isLocallyImportedPageID(pageID)) {
      mutated.push(plain);
      continue;
    }

    const tocItem = tocByID.get(pageID);
    if (!tocItem) {
      untracked.push(plain);
      continue;
    }

    const { isRenamed, isPlacementChanged } = getRemixerPageEditFlags(plain);
    const tocHref = tocItem["@href"];
    const tocURIUi = tocItem["uri.ui"];
    const tocTitle = tocItem.title;

    // An upstream value is only adopted when the user has not moved/renamed the
    // page AND the TOC actually carries one. `BookService._toRemixerSubPage`
    // defaults every one of these fields to "" when absent, so assigning
    // unconditionally would blank the stored href/title.
    mutated.push({
      ...plain,
      "@href":
        !isPlacementChanged && tocHref ? tocHref : String(plain["@href"] ?? ""),
      "uri.ui": !isPlacementChanged && tocURIUi ? tocURIUi : plain["uri.ui"],
      ...(!isRenamed && tocTitle
        ? { title: tocTitle, "@title": tocTitle }
        : {}),
    });
  }

  // Removing a page can orphan the locally-imported children kept above: their
  // parentID now points at a page that is no longer in the book, which leaves
  // the client with an unrenderable tree. Reparent them to the root so they
  // stay visible and the user can re-place them, and mark them moved so a later
  // reconciliation treats their placement as user-owned.
  const reparented: RemixerSubPageState[] = [];
  if (untracked.length > 0) {
    const survivingIDs = new Set(mutated.map((p) => String(p["@id"] ?? "")));
    for (let i = 0; i < mutated.length; i++) {
      const parentID = mutated[i].parentID;
      if (!parentID || parentID === "-1" || survivingIDs.has(parentID)) {
        continue;
      }
      mutated[i] = {
        ...mutated[i],
        parentID: "-1",
        isPlacementChanged: true,
        movedItem: true,
      };
      reparented.push(mutated[i]);
    }
  }

  return { mutated, untracked, reparented };
};

export default {
  findDifference: findDifference,
  mergeTocWithSavedConfigs: mergeTocWithSavedConfigs,
  mapToRemixerSubPageResponse: mapToRemixerSubPagesResponse,
  mapToRemixerPageDetailsResponse: mapToRemixerPageDetailsResponse,
  runRemixerJob: runRemixerJob,
};
