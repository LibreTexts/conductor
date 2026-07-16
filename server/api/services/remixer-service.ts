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
} from "../../util/remixerutils";
import * as cheerio from "cheerio";
import { log } from "debug";
import { RemixerSubPage } from "../../types/Remixer";
import BookService from "./book-service";

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
  const rawTitle = page["@title"] || page.title || "Untitled";
  const cleanTitle = stripDefaultTitlePrefixBeforeColon(
    stripLeadingNumbering(rawTitle),
  );

  if (!autoNumbering || inDeletedBranch || inMatterBranch)
    return appendSiblingTitleSuffix(cleanTitle, page);

  // Empty pathNumber means this is the book root — no numbering
  const numberPath = page.pathNumber ?? [];
  if (numberPath.length === 0) return appendSiblingTitleSuffix(cleanTitle, page);

  // formattedPath is pre-computed by buildBookPaths (already handles formattedPathOverride)
  const formattedPath = page.formattedPath?.trim() ?? "";
  const titleWithPath = formattedPath
    ? `${formattedPath}: ${cleanTitle}`
    : cleanTitle;
  return appendSiblingTitleSuffix(titleWithPath, page);
};

type PageStatus = "unchaned" | "modeified" | "new" | "imported" | "deleted";

const getPageStatus = (page: RemixerSubPageState): PageStatus => {
  if (page.isDeleted) return "deleted";
  if (page.addedItem && !page.isDeleted && page["@id"].startsWith("new-"))
    return "new";

  if (page.isImported || page.addedItem) return "imported";
  if (
    page.movedItem ||
    page.isPlacementChanged ||
    page.movedItem ||
    page.renamedItem
  )
    return "modeified";

  return "unchaned";
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

const handleNewPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
  coverId?: string ,
): Promise<{ pageID: string; pageURI: string }> => {
  const content =
    page["@subpages"] === true || parent["@id"] === coverId 
      ? RemixerTemplates.POST_CreateBlankTopicGuide
      : RemixerTemplates.POST_CreateBlankPage("topic");
  const rawTitle = page["@title"] || page.title || title;
  // segment must be un-encoded here — we double-encode the full path below,
  // matching CXOneFetch's encodeURIComponent(encodeURIComponent(path)) convention.
  const segment = buildRemixerPagePathSegment(page, rawTitle, page.siblingTitleIndex);

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
  const url = `https://${subdomain}.libretexts.org/@api/deki/pages/=${pathEnc}/${CXOnePageAPIEndpoints.POST_Contents_Title(title)}`;
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
    throwForMindTouchResponse(response, `Error creating page "${title}"`);
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
): string => {
  const rawTitle = page["@title"] || page.title || displayTitle;
  return buildRemixerPagePathSegment(page, rawTitle, page.siblingTitleIndex);
};

const handleDeletedPage = async (
  page: RemixerSubPageState,
  subdomain: string,
): Promise<void> => {
  const pageId = page["@id"];
  if (!pageId || pageId.startsWith("new-")) return;

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

  const pageId = page["@id"];
  if (!pageId || pageId.startsWith("new-")) return;

  const pid = parseInt(pageId, 10);
  if (Number.isNaN(pid)) return;

  const isMoved = page.movedItem === true || page.isPlacementChanged === true;
  const isRenamed = page.renamedItem === true;

  if (isMoved && (!parent || parent["@id"]?.startsWith("new-"))) {
    throw new Error(
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
        : remixerPagePaddedSlug(page, title);
    const parentPath = safeDecPath(
      extractPagePath(await resolveUiUri(parent!, subdomain)),
    );
    const newPathRaw = `${parentPath}/${leaf}`;
    const toEnc = encodeURIComponent(encodeURIComponent(newPathRaw));
    moveUrl = `${base}/move?title=${titleEnc}&to=${toEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isRenamed && !isMoved) {
    const padded = remixerPagePaddedSlug(page, title);
    const nameEnc = encodeURIComponent(padded);
    moveUrl = `${base}/move?title=${titleEnc}&name=${nameEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isMoved && isRenamed) {
    const parentPath = safeDecPath(
      extractPagePath(await resolveUiUri(parent!, subdomain)),
    );
    const padded = remixerPagePaddedSlug(page, title);
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

  // Match handleNewPage article types based on placement under the cover.
  if (isMoved && coverId && parent) {
    const bookService = new BookService({
      bookID: `${subdomain}-${coverId}`,
    });
    if (parent["@id"] === coverId) {
      await bookService.updatePageDetails(pageId, undefined, [
        "article:topic-guide",
      ]);
      page.article = "topic-guide";
    } else {
      await bookService.updatePageDetails(pageId, undefined, ["article:topic"]);
      page.article = "article";
    }
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

const CROSS_TRANSLUDE_SOURCE_RE =
  /template\(\s*['"]CrossTransclude\/Web['"]\s*,\s*\{[\s\S]*?['"]Library['"]\s*:\s*['"]([^'"]+)['"][\s\S]*?['"]PageID['"]\s*:\s*(\d+)/i;

const resolveTranscludeSource = async ({
  subdomain,
  pageId,
  fallbackUri,
}: {
  subdomain: string;
  pageId: number;
  fallbackUri: string;
}): Promise<{
  sourceSubdomain: string;
  sourceId: number;
  sourceUri: string;
}> => {
  const sourceHeaders = await generateAPIRequestHeaders(subdomain);
  const rawRes = await CXOneFetch({
    scope: "page",
    path: pageId,
    api: MindTouch.API.Page.GET_page_RawContents,
    subdomain,
    options: {
      headers: {
        ...sourceHeaders,
      },
    },
  });

  if (!rawRes.ok) {
    return {
      sourceSubdomain: subdomain,
      sourceId: pageId,
      sourceUri: fallbackUri,
    };
  }

  const rawContents = await rawRes.text();
  const match = rawContents.match(CROSS_TRANSLUDE_SOURCE_RE);
  if (!match) {
    return {
      sourceSubdomain: subdomain,
      sourceId: pageId,
      sourceUri: fallbackUri,
    };
  }

  const nestedSubdomain = match[1];
  const nestedId = parseInt(match[2] ?? "", 10);
  if (!nestedSubdomain || Number.isNaN(nestedId)) {
    return {
      sourceSubdomain: subdomain,
      sourceId: pageId,
      sourceUri: fallbackUri,
    };
  }

  const nestedHeaders = await generateAPIRequestHeaders(nestedSubdomain);
  const nestedPageRes = await CXOneFetch({
    scope: "page",
    path: nestedId,
    api: MindTouch.API.Page.GET_Page,
    subdomain: nestedSubdomain,
    options: {
      headers: {
        ...nestedHeaders,
      },
    },
  });

  let nestedUri = fallbackUri;
  if (nestedPageRes.ok) {
    const nestedPage = (await nestedPageRes.json()) as Record<string, unknown>;
    const resolvedUri = nestedPage["uri.ui"];
    if (typeof resolvedUri === "string" && resolvedUri.length > 0) {
      nestedUri = resolvedUri;
    }
  }

  return resolveTranscludeSource({
    subdomain: nestedSubdomain,
    pageId: nestedId,
    fallbackUri: nestedUri,
  });
};

const hasSubpages = (
  page: RemixerSubPageState,
  book: RemixerSubPageState[],
): boolean => {
  return book.some((p) => p.parentID === page["@id"] && p.deletedItem !== true);
};

const handleImportedPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
  copyModeState: RemixerCopyMode,
  hasChildren: boolean,
): Promise<{ pageID: string; pageURI: string }> => {
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
  );

  let contentsBody: string;
  let postComment: string;
  const dekiHeaders = await generateAPIRequestHeaders(subdomain);

  const sourceService = new BookService({
    bookID: `${sourceSubdomain}-${sourceId}`,
  });
  const sourceTags = await sourceService.getPageTags(sourceId.toString());
  const preservedTags = sourceTags.map((tag) => tag["@value"]);

  const shouldTransclude = copyModeState === "Transclude" && !hasChildren;
  if (shouldTransclude) {
    const resolvedSource = await resolveTranscludeSource({
      subdomain: sourceSubdomain,
      pageId: sourceId,
      fallbackUri: sourceUri,
    });
    contentsBody = RemixerTemplates.POST_TranscludeCrossLibrary(
      resolvedSource.sourceSubdomain,
      resolvedSource.sourceId,
      resolvedSource.sourceUri,
      [],
    );
    postComment = "Remixer transclude";
  } else {
    const targetLibarayDekiHeaders =
      await generateAPIRequestHeaders(sourceSubdomain);
    const htmlRes = await CXOneFetch({
      scope: "page",
      path: sourceId,
      api: MindTouch.API.Page.GET_Page_Contents("html"),
      subdomain: sourceSubdomain,
      options: {
        headers: {
          ...targetLibarayDekiHeaders,
        },
      },
    });
    if (!htmlRes.ok) {
      throwForMindTouchResponse(htmlRes, "Error reading source page contents");
    }
    const rawHtml = await htmlRes.text();
    const $ = cheerio.load(rawHtml);
    $(".mt-guide-content").remove();
    const cleanedRawHtml = $.html();
    contentsBody = RemixerTemplates.POST_ForkPage(
      cleanedRawHtml,
      sourceSubdomain,
      [],
    );
    postComment = "Remixer fork";
  }
  // hasChildren is true if the page has any children
  if (hasChildren) {
    contentsBody = RemixerTemplates.POST_CreateBlankTopicGuide + contentsBody;
  } else {
    contentsBody =
      RemixerTemplates.POST_CreateBlankPage("topic") + contentsBody;
  }
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
    if (shouldTransclude){
      // make sure transcluded:yes is in the tags
      if (!preservedTags.includes("transcluded:yes")){
        preservedTags.push("transcluded:yes");
      }

    }
    else{
      // make sure transcluded:no is in the tags
      if (!preservedTags.includes("transcluded:no")){
        preservedTags.push("transcluded:no");
      }
    }
    await targetService.updatePageDetails(pageID, undefined, preservedTags);
  } catch (error) {
    console.error(error);
  }

  await applyDefaultRemixerPageProperties(subdomain, pageID);
  return { pageID, pageURI };
};

interface RunRemixerJobParams {
  jobID: string;
  projectID: string;
  subdomain: string;
  coverId:string;
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
    isDeleted: false,
    isImported: false,
    isRenamed: false,
    isPlacementChanged: false,
    addedItem: false,
    movedItem: false,
    renamedItem: false,
    deletedItem: false,
  };
};

const runRemixerJob = async ({
  jobID,
  projectID,
  subdomain,
  coverId,
}: RunRemixerJobParams) => {
  const job = await PrejectRemixerJob.findOne({ jobID: { $eq: jobID } }).sort({ _id: -1 });
  const remixerState = await PrejectRemixer.findOne({ projectID: { $eq: projectID } }).sort({
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
    const copyModeState = normalizeRemixerCopyMode(remixerState.copyModeState);
    const byId = new Map(pages.map((p) => [p["@id"], p]));

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

      const pathLen = page.pathNumber?.length ?? 0;
      const isBookRoot = pathLen === 0;
      const status = getPageStatus(page);
      const shouldSkip = isBookRoot || inMatterBranch || status === "unchaned";
      const message = shouldSkip
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
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
          if (parent) {
            const oldPageId = page["@id"];
            const { pageID, pageURI } = await withRetryOnTransient(
              () => handleNewPage(page, parent, title, subdomain, coverId),
              { onRetry: logRetry },
            );
            page["@id"] = pageID;
            setRemixerPageUriUi(page, pageURI || getRemixerPageUriUi(page));
            page["@href"] = pageURI || page["@href"];

            // Keep references coherent for upcoming items in the same run.
            byId.delete(oldPageId);
            byId.set(pageID, page);
            pages.forEach((candidate) => {
              if (candidate.parentID === oldPageId) {
                candidate.parentID = pageID;
              }
            });
          }
        } else if (status === "imported") {
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
          if (parent) {
            const oldPageId = page["@id"];
            const { pageID, pageURI } = await withRetryOnTransient(
              () =>
                handleImportedPage(
                  page,
                  parent,
                  title,
                  subdomain,
                  copyModeState,
                  hasSubpages(page, pages),
                ),
              { onRetry: logRetry },
            );
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
          }
        } else if (status === "modeified") {
          const parentId = page.parentID ?? "-1";
          const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
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
            }
          }
        } else if (status === "deleted") {
          try {
            await withRetryOnTransient(
              () => handleDeletedPage(page, subdomain),
              { onRetry: logRetry },
            );
          } catch (error) {}
        }
      } catch (error) {
        if (error instanceof TitleConflictError) {
          job.messages.push(
            `${title} - title/URL already in use; deferring for reprocessing.`,
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
    let deferredStack: OrderedEntry[] = [];
    for (const entry of ordered) {
      const outcome = await processOrderedEntry(entry);
      if (outcome === "conflict") {
        deferredStack.push(entry);
      }
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
        const relocatable = stillStuck.find(
          (entry) => !Number.isNaN(parseInt(entry.page["@id"], 10)),
        );
        if (!relocatable) {
          const stuckTitles = stillStuck
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
            `Title/URL conflict for: ${stuckTitles} — the conflicting title/path belongs to a page outside this remix and must be resolved manually.`,
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
    // ── Trigger Mindtouch TOC update ─────────────────────────────────────────
    log("[*] Triggering MindMap TOC update...");
    await fetch(`https://batch.libretexts.org/print/Libretext=${bookURL}`, {
      headers: { origin: "commons.libretexts.org" },
    })
      .then(() => console.log("MindMap TOC update done"))
      .catch((e) => {
        console.warn(
          "[PressBookScraper] MindMap trigger failed (non-fatal):",
          (e as Error).message,
        );
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

export default {
  mapToRemixerSubPageResponse: mapToRemixerSubPagesResponse,
  mapToRemixerPageDetailsResponse: mapToRemixerPageDetailsResponse,
  runRemixerJob: runRemixerJob,
};
