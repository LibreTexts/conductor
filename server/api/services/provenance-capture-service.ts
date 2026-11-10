import { childLogger } from "../../logger.js";
import { addPageProperty, getPage } from "../../util/librariesclient.js";
import { extractPagePath } from "../../util/remixerutils.js";
import {
  pageNodeId,
  type ReuseEdgeType,
} from "../../util/provenance-graph.js";
import type { ReuseEdgeOrigin } from "../../models/pagereuseedge.js";
import type { PageNodeKind } from "../../models/pagenode.js";
import {
  markPageDeleted,
  rebuildBookSummary,
  refreshChainRoot,
  upsertPageNodes,
  upsertReuseEdges,
  type PageNodeUpsert,
} from "./page-provenance-service.js";

/**
 * Write-time capture for the provenance graph: the places in Conductor that
 * create or reorganize library pages report what they did here.
 *
 * Everything in this module is best-effort. Provenance is bookkeeping and
 * must never fail the operation that triggered it (a Remixer publish, a
 * Restacker view), so every exported function catches and logs instead of
 * throwing. A missed write is repaired by the next library scan.
 */

const captureLog = childLogger("provenance-capture");

/** A Restacker view re-syncs a book's structure at most this often. */
const STRUCTURE_SYNC_INTERVAL_MS = 10 * 60 * 1000;
/** Book ids whose structure was synced recently, with the time of the sync. */
const recentStructureSyncs = new Map<string, number>();

const toPageID = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** A page path relative to the library root, from a full or relative URL. */
const toPagePath = (uri: string | undefined): string | undefined => {
  if (!uri || uri.includes("@api/deki/")) return undefined;
  const path = extractPagePath(uri).replace(/^\/+|\/+$/g, "");
  return path || undefined;
};

const NODE_KIND_FOR_EDGE: Record<ReuseEdgeType, PageNodeKind> = {
  "transclude-same": "transclude",
  "transclude-cross": "transclude",
  section: "mixed",
  fork: "fork",
  full: "full",
};

/** A source revision number from a page-info response, if it has one. */
const readRevision = (pageInfo: unknown): number | undefined => {
  const raw = (pageInfo as Record<string, unknown> | null)?.["@revision"];
  const revision = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(revision) ? revision : undefined;
};

export type CapturedPageRef = {
  lib: string;
  pageID: string | number;
  /** Full or library-relative URL. */
  uri?: string;
  title?: string;
};

export type RecordReuseParams = {
  /** The page that now reuses content. */
  target: CapturedPageRef & {
    /** `${lib}-${coverID}` of the book the target belongs to. */
    bookID: string | null;
    parentID?: string | number | null;
  };
  /** The page whose content is reused. For a transclusion, the resolved origin. */
  source: CapturedPageRef;
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  /**
   * Pages the reuse was chosen through but that the content skips, nearest
   * the source first (Remixer resolves a stub B of A and points at A).
   */
  via?: CapturedPageRef[];
};

/**
 * Records one reuse as it is created: both page nodes, the edge, and the
 * target's chain root. For a copy, also writes the source onto the copied
 * page as a page property, so the lineage survives even outside Conductor.
 *
 * Never throws.
 */
export const recordReuse = async ({
  target,
  source,
  type,
  origin,
  via = [],
}: RecordReuseParams): Promise<void> => {
  const targetPageID = toPageID(target.pageID);
  const sourcePageID = toPageID(source.pageID);
  if (!targetPageID || !sourcePageID) {
    captureLog.warn(
      { target: target.pageID, source: source.pageID },
      "Skipping provenance record without numeric page ids",
    );
    return;
  }

  const targetId = pageNodeId(target.lib, targetPageID);
  const sourceId = pageNodeId(source.lib, sourcePageID);

  try {
    const sourceInfo = await getPage(sourcePageID, source.lib);
    const linkedRevision = readRevision(sourceInfo);

    const viaIds = via
      .map((page) => {
        const id = toPageID(page.pageID);
        return id ? pageNodeId(page.lib, id) : null;
      })
      .filter(
        (id): id is string => id !== null && id !== sourceId && id !== targetId,
      );

    await upsertPageNodes([
      {
        lib: target.lib,
        pageID: targetPageID,
        bookID: target.bookID,
        parentID: toPageID(target.parentID),
        path: toPagePath(target.uri),
        title: target.title,
        kind: NODE_KIND_FOR_EDGE[type],
        reuseCount: 1,
        deletedAt: null,
      },
      {
        lib: source.lib,
        pageID: sourcePageID,
        path: toPagePath(source.uri ?? sourceInfo?.["uri.ui"]),
        title: source.title ?? sourceInfo?.title,
        revision: linkedRevision,
      },
    ]);

    await upsertReuseEdges([
      {
        target: targetId,
        source: sourceId,
        targetBook: target.bookID,
        type,
        origin,
        via: viaIds,
        linkedRevision,
      },
    ]);

    await refreshChainRoot(targetId);

    if (type === "fork" || type === "full") {
      const recorded = await addPageProperty(
        target.lib,
        targetPageID,
        "ConductorSource",
        JSON.stringify({
          source: sourceId,
          revision: linkedRevision ?? null,
          type,
          at: new Date().toISOString(),
        }),
      );
      if (!recorded) {
        captureLog.warn(
          { targetId, sourceId },
          "Could not write the source property on a copied page",
        );
      }
    }
  } catch (err) {
    captureLog.warn(
      { err, targetId, sourceId, type },
      "Failed to record page reuse",
    );
  }
};

/** One page of a published book, as the capture hooks know it. */
export type CapturedBookPage = {
  pageID: string | number;
  parentID?: string | number | null;
  uri?: string;
  title?: string;
};

/**
 * Brings a book's page nodes in line with its current structure: which pages
 * belong to the book, their parents, paths and titles. Classification is left
 * alone (only scans and reuse records set `kind`), so this is cheap and safe
 * to run after any reorganization. Deleted pages are marked so, and links
 * onto them are marked broken. The book's summary is rebuilt afterwards.
 *
 * Never throws.
 */
export const syncBookStructure = async ({
  lib,
  coverID,
  pages,
  deletedPageIDs = [],
}: {
  lib: string;
  coverID: string | number;
  pages: CapturedBookPage[];
  deletedPageIDs?: (string | number)[];
}): Promise<void> => {
  const bookID = `${lib}-${coverID}`;
  try {
    const nodes: PageNodeUpsert[] = [];
    for (const page of pages) {
      const pageID = toPageID(page.pageID);
      if (!pageID) continue;
      nodes.push({
        lib,
        pageID,
        bookID,
        parentID: toPageID(page.parentID),
        path: toPagePath(page.uri),
        title: page.title,
        deletedAt: null,
      });
    }
    await upsertPageNodes(nodes);

    let broken = 0;
    for (const raw of deletedPageIDs) {
      const pageID = toPageID(raw);
      if (!pageID) continue;
      const result = await markPageDeleted(pageNodeId(lib, pageID));
      broken += result.broken;
    }
    if (broken > 0) {
      captureLog.info(
        { bookID, broken },
        "Deleted pages broke reuse in other pages",
      );
    }

    await rebuildBookSummary(bookID);
    recentStructureSyncs.set(bookID, Date.now());
  } catch (err) {
    captureLog.warn({ err, bookID }, "Failed to sync book structure");
  }
};

/** The table-of-contents shape BookService returns, reduced to what is used. */
export type CapturedTocNode = {
  id: string;
  title?: string;
  url?: string;
  children?: CapturedTocNode[];
};

/**
 * {@link syncBookStructure} from a book TOC, at most once per
 * {@link STRUCTURE_SYNC_INTERVAL_MS} per book. Meant for read paths that
 * already hold the TOC (the Restacker) and may be hit repeatedly.
 *
 * Never throws.
 */
export const syncBookStructureFromToc = async (
  lib: string,
  coverID: string | number,
  toc: CapturedTocNode | null | undefined,
): Promise<void> => {
  if (!toc?.id) return;
  const bookID = `${lib}-${coverID}`;
  const last = recentStructureSyncs.get(bookID);
  if (last && Date.now() - last < STRUCTURE_SYNC_INTERVAL_MS) return;
  // Claimed before the write so concurrent views don't all sync.
  recentStructureSyncs.set(bookID, Date.now());

  const pages: CapturedBookPage[] = [];
  const walk = (node: CapturedTocNode, parentID: string | null) => {
    pages.push({ pageID: node.id, parentID, uri: node.url, title: node.title });
    for (const child of node.children ?? []) walk(child, node.id);
  };
  walk(toc, null);

  await syncBookStructure({ lib, coverID, pages });
};
