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
  extractLibretextsSubdomain,
  extractPagePath,
  slugifyNode,
} from "../../util/remixerutils";

export interface RemixerSubPage {
  "@id": string;
  "@title": string;
  "@href": string;
  "@subpages": boolean;
  article: string;
  namespace: string;
  title: string;
  "uri.ui": string;
  parentID?: string;
  formattedPath?: string;
}

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

  if(!currentbook){
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

/**
 * Thrown when a MindTouch request fails for reasons that are likely temporary
 * (timeouts, gateway errors, rate-limiting, transient network failures).
 * Callers can retry the same operation safely from the user's perspective.
 */
class TransientMindTouchError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "TransientMindTouchError";
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

const getDisplayTitle = (
  page: RemixerSubPageState,
  inMatterBranch: boolean,
  inDeletedBranch: boolean,
  autoNumbering: boolean,
): string => {
  const rawTitle = page["@title"] || page.title || "Untitled";
  const cleanTitle = stripLeadingNumbering(rawTitle);

  if (!autoNumbering || inDeletedBranch || inMatterBranch) return cleanTitle;

  // Empty pathNumber means this is the book root — no numbering
  const numberPath = page.pathNumber ?? [];
  if (numberPath.length === 0) return cleanTitle;

  // formattedPath is pre-computed by buildBookPaths (already handles formattedPathOverride)
  const formattedPath = page.formattedPath?.trim() ?? "";
  return formattedPath ? `${formattedPath}: ${cleanTitle}` : cleanTitle;
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
  await addPageProperty(subdomain, pageID, "GuideTabs", "");
  await addPageProperty(subdomain, pageID, "GuideDisplay", "single", "PUT");
  await addPageProperty(subdomain, pageID, "SubPageListing", "simple");
  await addPageProperty(
    subdomain,
    pageID,
    "GuideTabs",
    MindTouch.Templates.PROP_GuideTabs,
    "PUT",
  );
  await addPageProperty(subdomain, pageID, "WelcomeHidden", true);
  await addPageProperty(subdomain, pageID, "ArticleType", "Topic");
};

const handleNewPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
): Promise<{ pageID: string; pageURI: string }> => {
  const content =
    page["@subpages"] === true
      ? RemixerTemplates.POST_CreateBlankTopicGuide
      : RemixerTemplates.POST_CreateBlankPage("topic");

  const numberedPath = page.pathNumber?.join("_") ?? "";
  // TODO: POST new page to bookURL using title, numberedPath, content
  const slug = slugifyNode(`${numberedPath}: ${title}`);

  const parentUri = getRemixerPageUriUi(parent);
  const pagePath = encodeURIComponent(`${extractPagePath(parentUri)}/${slug}`);
  const url = `https://${subdomain}.libretexts.org/@api/deki/pages/=${encodeURIComponent(pagePath)}/${CXOnePageAPIEndpoints.POST_Contents_Title(title)}`;
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
  const createdPage = await getPage(pagePath, subdomain);
  const pageID = createdPage?.["@id"]?.toString();
  const pageURI = (
    createdPage?.["uri.ui"] ||
    createdPage?.["@href"] ||
    ""
  ).toString();
  if (!pageID) {
    throw new Error(`Error locating CXOne page ID for "${pagePath}"`);
  }

  await applyDefaultRemixerPageProperties(subdomain, pageID);

  return { pageID, pageURI };
};

/** Path segment for move `to` / rename `name` (LibreTexts-style padded slug). */
const remixerPagePaddedSlug = (
  page: RemixerSubPageState,
  displayTitle: string,
): string => {
  const numberedPath = page.pathNumber?.join("_") ?? "";
  return slugifyNode(`${numberedPath}: ${displayTitle}`);
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

  if (isMoved && !isRenamed) {
    const pageUri = getRemixerPageUriUi(page);
    const currentPath = extractPagePath(pageUri);
    const segments = currentPath.split("/").filter(Boolean);
    const leaf =
      segments.length > 0
        ? segments[segments.length - 1]!
        : remixerPagePaddedSlug(page, title);
    const parentPath = extractPagePath(getRemixerPageUriUi(parent!));
    const newPathPlain = `${parentPath}/${leaf}`;
    const toEnc = encodeURIComponent(encodeURIComponent(newPathPlain));
    moveUrl = `${base}/move?title=${titleEnc}&to=${toEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isRenamed && !isMoved) {
    const padded = remixerPagePaddedSlug(page, title);
    const nameEnc = encodeURIComponent(padded);
    moveUrl = `${base}/move?title=${titleEnc}&name=${nameEnc}&allow=deleteredirects&dream.out.format=json`;
  } else if (isMoved && isRenamed) {
    const parentPath = extractPagePath(getRemixerPageUriUi(parent!));
    const padded = remixerPagePaddedSlug(page, title);
    const newPathPlain = `${parentPath}/${padded}`;
    const toEnc = encodeURIComponent(encodeURIComponent(newPathPlain));
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
}): Promise<{ sourceSubdomain: string; sourceId: number; sourceUri: string }> => {
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

const handleImportedPage = async (
  page: RemixerSubPageState,
  parent: RemixerSubPageState,
  title: string,
  subdomain: string,
  copyModeState: RemixerCopyMode,
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
  if (copyModeState === "Transclude") {
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
    const htmlRes = await CXOneFetch({
      scope: "page",
      path: sourceId,
      api: MindTouch.API.Page.GET_Page_Contents("html"),
      subdomain: sourceSubdomain,
      options: {
        headers: {
          ...dekiHeaders,
        },
      },
    });
    if (!htmlRes.ok) {
      throwForMindTouchResponse(htmlRes, "Error reading source page contents");
    }
    const rawHtml = await htmlRes.text();
    contentsBody = RemixerTemplates.POST_ForkPage(rawHtml, sourceSubdomain, []);
    postComment = "Remixer fork";
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

  return { pageID, pageURI };
};

interface RunRemixerJobParams {
  jobID: string;
  projectID: string;
  bookURL: string;
  subdomain: string;
}

const runRemixerJob = async ({
  jobID,
  projectID,
  bookURL,
  subdomain,
}: RunRemixerJobParams) => {
  const job = await PrejectRemixerJob.findOne({ jobID }).sort({ _id: -1 });
  const remixerState = await PrejectRemixer.findOne({ projectID });

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

    for (const { page, inMatterBranch, inDeletedBranch } of ordered) {
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

      if (status === "new") {
        const parentId = page.parentID ?? "-1";
        const parent = parentId !== "-1" ? byId.get(parentId) : undefined;
        if (parent) {
          const oldPageId = page["@id"];
          const { pageID, pageURI } = await withRetryOnTransient(
            () => handleNewPage(page, parent, title, subdomain),
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
              handleImportedPage(page, parent, title, subdomain, copyModeState),
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
          () => handleModifiedPage(page, parent, title, subdomain),
          { onRetry: logRetry },
        );
        const pid = parseInt(page["@id"], 10);
        if (!Number.isNaN(pid)) {
          const info = await getPage(pid, subdomain);
          const uri = info?.["uri.ui"] ?? info?.["@href"];
          if (uri) {
            const uriStr = String(uri);
            setRemixerPageUriUi(page, uriStr);
            page["@href"] = uriStr;
          }
        }
      } else if (status === "deleted") {
        try {
          await withRetryOnTransient(
            () => handleDeletedPage(page, subdomain),
            { onRetry: logRetry },
          );
        } catch (error) {
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, shouldSkip ? 100 : 100),
      );
      job.messages.push(message);
      await job.save();
    }

    // Archive the remixer state that was just published and persist a fresh
    // snapshot as the new active record. The snapshot captures the fully
    // processed currentbook (with updated page IDs / URIs) plus the settings
    // that drove this run (autoNumbering, copyModeState, pathLevelFormats).
    remixerState.archived = true;
    await remixerState.save();

    // await PrejectRemixer.create({
    //   projectID: remixerState.projectID,
    //   createdBy: remixerState.createdBy,
    //   updatedBy: remixerState.updatedBy,
    //   remixerID: base62(10),
    //   remixerCurrentBook: pages,
    //   autoNumbering: remixerState.autoNumbering,
    //   copyModeState: remixerState.copyModeState,
    //   pathLevelFormats: remixerState.pathLevelFormats,
    //   archived: false,
    // });

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
