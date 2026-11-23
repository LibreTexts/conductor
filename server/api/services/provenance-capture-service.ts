import { childLogger } from "../../logger.js";
import { mapWithConcurrency } from "../../util/concurrency.js";
import { createThrottle } from "./library-sync-service.js";
import { getPage } from "../../util/librariesclient.js";
import { extractPagePath } from "../../util/remixerutils.js";
import {
  pageNodeId,
  type ReuseEdgeType,
} from "../../util/provenance-graph.js";
import type { ReuseEdgeOrigin } from "../../models/pagereuseedge.js";
import PageNode, { type PageNodeKind } from "../../models/pagenode.js";
import {
  deletePageWithNotice,
  rebuildBookSummary,
  rebuildSummaryIfScanned,
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
  excerpt: "mixed",
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

/** Spacing between reads of source pages while recording a batch. */
const SOURCE_READ_INTERVAL_MS = 250;
/** Source pages read at once while recording a batch. */
const SOURCE_READ_CONCURRENCY = 4;

/**
 * Records the reuse a Remixer job created, all at once: both page nodes of
 * every link, the links, each target's chain root, and the affected books'
 * summaries. Everything goes to Conductor's own collections; the library is
 * only read (each source's current revision, title and path, throttled).
 *
 * Meant to run after the job has finished, in the background, so it never
 * slows an import. If the process stops first, the next library scan finds
 * the same links from the pages' markup (and forks of former transclusions
 * from their content), so nothing is lost for good.
 *
 * Never throws.
 */
export const recordReuseBatch = async (records: RecordReuseParams[]): Promise<void> => {
  type Prepared = {
    record: RecordReuseParams;
    targetPageID: number;
    sourcePageID: number;
    targetId: string;
    sourceId: string;
  };
  let prepared: Prepared[] = [];
  for (const record of records) {
    const targetPageID = toPageID(record.target.pageID);
    const sourcePageID = toPageID(record.source.pageID);
    if (!targetPageID || !sourcePageID) {
      captureLog.warn(
        { target: record.target.pageID, source: record.source.pageID },
        "Skipping provenance record without numeric page ids",
      );
      continue;
    }
    prepared.push({
      record,
      targetPageID,
      sourcePageID,
      targetId: pageNodeId(record.target.lib, targetPageID),
      sourceId: pageNodeId(record.source.lib, sourcePageID),
    });
  }
  if (prepared.length === 0) return;

  try {
    // This runs after the job, so a later job may already have deleted some
    // of these pages. The structure sync owns a page's lifecycle: skip pages
    // marked deleted rather than revive them (and their links).
    const deleted = new Set(
      (
        await PageNode.find(
          { nodeID: { $in: [...new Set(prepared.map((p) => p.targetId))] }, deletedAt: { $ne: null } },
          { _id: 0, nodeID: 1 },
        ).lean<{ nodeID: string }[]>()
      ).map((n) => n.nodeID),
    );
    if (deleted.size > 0) {
      captureLog.info({ skipped: deleted.size }, "Skipping reuse of pages deleted since the job");
      prepared = prepared.filter((p) => !deleted.has(p.targetId));
      if (prepared.length === 0) return;
    }

    // One read per distinct source page, however many pages reuse it.
    const throttle = createThrottle(SOURCE_READ_INTERVAL_MS);
    const sources = new Map<string, Prepared>();
    for (const p of prepared) if (!sources.has(p.sourceId)) sources.set(p.sourceId, p);
    const sourceInfo = new Map<string, { revision?: number; info: any }>();
    await mapWithConcurrency([...sources.values()], SOURCE_READ_CONCURRENCY, async (p) => {
      try {
        const info = await throttle(() => getPage(p.sourcePageID, p.record.source.lib));
        sourceInfo.set(p.sourceId, { revision: readRevision(info), info });
      } catch (err) {
        // The link is still worth recording; the source check reads it later.
        captureLog.warn({ err, sourceId: p.sourceId }, "Couldn't read reused page");
      }
    });

    const nodes: PageNodeUpsert[] = [];
    const edges: Parameters<typeof upsertReuseEdges>[0] = [];
    for (const p of prepared) {
      const { record } = p;
      const source = sourceInfo.get(p.sourceId);
      const viaIds = (record.via ?? [])
        .map((page) => {
          const id = toPageID(page.pageID);
          return id ? pageNodeId(page.lib, id) : null;
        })
        .filter((id): id is string => id !== null && id !== p.sourceId && id !== p.targetId);

      nodes.push(
        {
          lib: record.target.lib,
          pageID: p.targetPageID,
          bookID: record.target.bookID,
          // No parentID: the job's structure sync owns the tree, and the
          // parent id captured mid-import can be a temporary one.
          path: toPagePath(record.target.uri),
          title: record.target.title,
          kind: NODE_KIND_FOR_EDGE[record.type],
          reuseCount: 1,
          // No deletedAt: a new page starts undeleted (schema default), and
          // an existing one keeps whatever the structure sync decided.
        },
        {
          lib: record.source.lib,
          pageID: p.sourcePageID,
          path: toPagePath(record.source.uri ?? source?.info?.["uri.ui"]),
          title: record.source.title ?? source?.info?.title,
          revision: source?.revision,
        },
      );
      edges.push({
        target: p.targetId,
        source: p.sourceId,
        targetBook: record.target.bookID,
        type: record.type,
        origin: record.origin,
        via: viaIds,
        linkedRevision: source?.revision,
      });
    }

    await upsertPageNodes(nodes);
    await upsertReuseEdges(edges);
    // Lineage lives only in Conductor's own collections: nothing about it is
    // ever written to the library (no tags, no page properties).
    const targets = [...new Set(prepared.map((p) => p.targetId))];
    await mapWithConcurrency(targets, 8, (id) => refreshChainRoot(id));
    // The books' summaries were built before these links existed.
    const books = [...new Set(prepared.map((p) => p.record.target.bookID).filter((b): b is string => !!b))];
    for (const bookID of books) await rebuildBookSummary(bookID);

    captureLog.info(
      { links: edges.length, sources: sources.size, books: books.length },
      "Recorded Remixer reuse",
    );
  } catch (err) {
    captureLog.warn({ err, links: prepared.length }, "Failed to record Remixer reuse");
  }
};

/** {@link recordReuseBatch} for a single link. Never throws. */
export const recordReuse = (record: RecordReuseParams): Promise<void> =>
  recordReuseBatch([record]);

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
    // Books other than this one that lost a page (it had moved there).
    const otherBooks = new Set<string>();
    for (const raw of deletedPageIDs) {
      const pageID = toPageID(raw);
      if (!pageID) continue;
      // Queues a change event for every book that reuses the page first, so
      // their leads hear that it is gone, then breaks the edges onto it.
      // The book's summary is rebuilt once below, not once per deleted page.
      const result = await deletePageWithNotice(pageNodeId(lib, pageID), new Date(), {
        rebuildOwnBook: false,
      });
      broken += result.broken;
      if (result.bookID && result.bookID !== bookID) otherBooks.add(result.bookID);
    }
    if (broken > 0) {
      captureLog.info(
        { bookID, broken },
        "Deleted pages broke reuse in other pages",
      );
    }

    await rebuildBookSummary(bookID);
    for (const other of otherBooks) await rebuildSummaryIfScanned(other);
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
