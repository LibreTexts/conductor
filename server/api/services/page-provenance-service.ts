import type { Types } from "mongoose";
import { childLogger } from "../../logger.js";
import PageNode, {
  type PageNodeInterface,
  type PageNodeKind,
} from "../../models/pagenode.js";
import PageReuseEdge, {
  CURRENT_EDGE_STATUSES,
  type ReuseEdgeOrigin,
  type ReuseEdgeStatus,
} from "../../models/pagereuseedge.js";
import BookReuseSummary, {
  type BookReuseLink,
  type BookReuseSummaryInterface,
} from "../../models/bookreusesummary.js";
import SourceChangeEvent from "../../models/sourcechangeevent.js";
import { getLibraryAndPageFromBookID } from "../../util/bookutils.js";
import {
  LIVE_EDGE_TYPES,
  MAX_CHAIN_DEPTH,
  pageNodeId,
  parsePageNodeId,
  resolveChainRoot,
  summarizeAffectedBooks,
  walkDownstream,
  type ChainRoot,
  type DownstreamWalk,
  type GraphEdge,
  type ReuseEdgeType,
} from "../../util/provenance-graph.js";

/**
 * Persistence for the page provenance graph: page nodes, direct reuse edges
 * and per-book rollups. Graph rules (what a chain is, what a change reaches)
 * live in `util/provenance-graph.ts`; this module only reads and writes them.
 *
 * Documents use ObjectId `_id`s like the rest of the application, plus a
 * business key with a unique index: `nodeID` on pages, `(target, source)` on
 * edges, `bookID` on summaries. Every write is an idempotent upsert on that
 * key, batched and unordered, so scanners can re-run or resume without
 * creating duplicates.
 */

const provenanceLog = childLogger("page-provenance");

/** Operations per `bulkWrite`. */
const BULK_BATCH_SIZE = 1000;
/** Ids per `$in` when walking a wide fan-out. */
const IN_QUERY_CHUNK = 1000;
/** Upstream/downstream book links kept per summary. */
const MAX_SUMMARY_LINKS = 500;
/** Edges returned by one lineage query before it reports truncation. */
const DEFAULT_LINEAGE_LIMIT = 5000;

type PageNodeBulkOps = Parameters<typeof PageNode.bulkWrite>[0];
type PageReuseEdgeBulkOps = Parameters<typeof PageReuseEdge.bulkWrite>[0];

const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// ── Nodes ────────────────────────────────────────────────────────────────────

/** Fields to write for one page; anything left undefined is not touched. */
export type PageNodeUpsert = Pick<PageNodeInterface, "lib" | "pageID"> &
  Partial<Omit<PageNodeInterface, "nodeID" | "lib" | "pageID">>;

/**
 * Creates or updates page nodes. Fields left undefined keep their stored
 * value, so a cheap structural refresh (path, parent) never wipes a
 * classification written by a content scan.
 *
 * @returns Documents inserted or changed.
 */
export const upsertPageNodes = async (
  nodes: PageNodeUpsert[],
): Promise<number> => {
  let written = 0;
  for (const batch of chunk(nodes, BULK_BATCH_SIZE)) {
    const ops: PageNodeBulkOps = batch.map((node) => {
      const set = definedOnly(node);
      const setOnInsert: Partial<PageNodeInterface> = {};
      if (set.kind === undefined) setOnInsert.kind = "unknown";
      if (set.reuseCount === undefined) setOnInsert.reuseCount = 0;
      return {
        updateOne: {
          filter: { nodeID: pageNodeId(node.lib, node.pageID) },
          update: {
            $set: set,
            ...(Object.keys(setOnInsert).length > 0
              ? { $setOnInsert: setOnInsert }
              : {}),
          },
          upsert: true,
        },
      };
    });
    const res = await PageNode.bulkWrite(ops, { ordered: false });
    written += res.upsertedCount + res.modifiedCount;
  }
  return written;
};

/** Marks a page deleted. Its own reuse edges are removed and edges onto it break. */
export const markPageDeleted = async (
  nodeId: string,
  deletedAt: Date = new Date(),
): Promise<{ removed: number; broken: number }> => {
  await PageNode.updateOne(
    { nodeID: { $eq: nodeId } },
    { $set: { deletedAt } },
  );
  const removed = await reconcileTargetEdges(nodeId, [], null);
  const broken = await markSourceBroken(nodeId);
  return { removed, broken };
};

// ── Edges ────────────────────────────────────────────────────────────────────

export type ReuseEdgeUpsert = {
  target: string;
  source: string;
  targetBook?: string | null;
  sourceBook?: string | null;
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  /** Defaults to 1. A re-seen edge keeps the highest confidence recorded. */
  confidence?: number;
  via?: string[];
  linkedRevision?: number;
  /** For an `excerpt`: blocks of the target copied from the source. */
  blocks?: number;
};

/**
 * Creates or refreshes reuse edges.
 *
 * Written as an update pipeline so one round trip can apply rules that
 * depend on the stored document:
 * - `origin`, `createdAt` and `linkedRevision` keep their first value: the
 *   first witness of a reuse (usually Remixer) is the most informative.
 * - `confidence` only ever rises.
 * - A `removed` edge seen again becomes `active`. `source-changed` is left
 *   alone so a rescan can't swallow a pending notification, and `broken` is
 *   left alone because seeing the marker on the target says nothing about
 *   whether the source came back.
 *
 * @returns Documents inserted or changed.
 */
export const upsertReuseEdges = async (
  edges: ReuseEdgeUpsert[],
): Promise<number> => {
  const now = new Date();
  let written = 0;

  for (const batch of chunk(edges, BULK_BATCH_SIZE)) {
    const ops: PageReuseEdgeBulkOps = batch.map((edge) => {
      const bookField = (value: string | null | undefined, field: string) =>
        value === undefined
          ? { $ifNull: [`$${field}`, null] }
          : { $literal: value };

      return {
        updateOne: {
          filter: { target: edge.target, source: edge.source },
          update: [
            {
              $set: {
                target: { $literal: edge.target },
                source: { $literal: edge.source },
                type: { $literal: edge.type },
                targetBook: bookField(edge.targetBook, "targetBook"),
                sourceBook: bookField(edge.sourceBook, "sourceBook"),
                origin: { $ifNull: ["$origin", { $literal: edge.origin }] },
                confidence: {
                  $max: [
                    { $ifNull: ["$confidence", 0] },
                    { $literal: edge.confidence ?? 1 },
                  ],
                },
                via:
                  edge.via && edge.via.length > 0
                    ? { $literal: edge.via }
                    : "$via",
                linkedRevision:
                  edge.linkedRevision === undefined
                    ? "$linkedRevision"
                    : { $ifNull: ["$linkedRevision", edge.linkedRevision] },
                blocks:
                  edge.blocks === undefined ? "$blocks" : { $literal: edge.blocks },
                createdAt: { $ifNull: ["$createdAt", now] },
                verifiedAt: now,
                // Every expression in one $set reads the *stored* document,
                // so these two see the status from before this write.
                status: {
                  $cond: [
                    { $in: [{ $ifNull: ["$status", "removed"] }, ["removed"]] },
                    "active",
                    "$status",
                  ],
                },
                removedAt: {
                  $cond: [{ $eq: ["$status", "removed"] }, "$$REMOVE", "$removedAt"],
                },
              },
            },
          ],
          upsert: true,
        },
      };
    });
    const res = await PageReuseEdge.bulkWrite(ops, { ordered: false });
    written += res.upsertedCount + res.modifiedCount;
  }
  await markSources(edges.map((edge) => edge.source));
  return written;
};

/**
 * Flags pages as reused so the source check watches them for changes, and
 * gives sources outside any scanned book a node to hang that state on.
 */
const markSources = async (sourceIDs: string[]): Promise<void> => {
  const unique = [...new Set(sourceIDs)];
  for (const batch of chunk(unique, BULK_BATCH_SIZE)) {
    const ops: PageNodeBulkOps = [];
    for (const nodeID of batch) {
      const parts = parsePageNodeId(nodeID);
      if (!parts) continue;
      ops.push({
        updateOne: {
          filter: { nodeID },
          update: {
            $set: { isSource: true },
            $setOnInsert: { lib: parts.lib, pageID: parts.pageID, kind: "unknown", reuseCount: 0 },
          },
          upsert: true,
        },
      });
    }
    if (ops.length > 0) await PageNode.bulkWrite(ops, { ordered: false });
  }
};

// ── Change events ────────────────────────────────────────────────────────────

export type SourceChangeParams = {
  sourceId: string;
  /** Revision the graph last knew. */
  fromRev?: number;
  /** Revision now in the library; absent for a deletion. */
  toRev?: number;
  deleted?: boolean;
  changedAt?: Date;
};

/**
 * Records that a reused page changed (or was deleted): walks every page its
 * change reaches (live chains; copies as the last hop), groups them by book,
 * and queues one `SourceChangeEvent` for the notification job. Direct edges
 * onto the source are marked `source-changed` until their leads are told.
 *
 * Call it *before* marking a deleted source's edges broken, or the walk will
 * not find them.
 *
 * @returns Whether an event was queued, and how many pages it reaches.
 */
export const recordSourceChange = async ({
  sourceId,
  fromRev,
  toRev,
  deleted = false,
  changedAt = new Date(),
}: SourceChangeParams): Promise<{ recorded: boolean; affectedPages: number }> => {
  const walk = await findAffectedByChange(sourceId);
  if (walk.hits.length === 0) return { recorded: false, affectedPages: 0 };

  const affected = summarizeAffectedBooks(walk.hits);
  const source = await PageNode.findOne(
    { nodeID: { $eq: sourceId } },
    { _id: 0, bookID: 1 },
  ).lean<{ bookID?: string | null }>();

  if (!deleted) {
    await PageReuseEdge.updateMany(
      { source: { $eq: sourceId }, status: "active" },
      { $set: { status: "source-changed" } },
    );
  }

  try {
    await SourceChangeEvent.create({
      sourcePage: sourceId,
      sourceBook: source?.bookID ?? null,
      fromRev,
      toRev,
      deleted,
      changedAt,
      affected,
      affectedPageCount: walk.hits.length,
      truncated: walk.truncated,
    });
  } catch (err) {
    // Same source revision already queued (a re-poll); nothing new to say.
    if ((err as { code?: number })?.code === 11000) {
      return { recorded: false, affectedPages: walk.hits.length };
    }
    throw err;
  }

  provenanceLog.info(
    {
      sourceId,
      fromRev,
      toRev,
      deleted,
      books: affected.length,
      pages: walk.hits.length,
    },
    deleted ? "Reused page deleted" : "Reused page changed",
  );
  return { recorded: true, affectedPages: walk.hits.length };
};

/**
 * A page is gone from the library: queue a change event for everything that
 * reuses it, then mark it deleted (its own edges removed, edges onto it broken).
 */
export const deletePageWithNotice = async (
  nodeId: string,
  deletedAt: Date = new Date(),
): Promise<{ removed: number; broken: number }> => {
  await recordSourceChange({ sourceId: nodeId, deleted: true, changedAt: deletedAt });
  return markPageDeleted(nodeId, deletedAt);
};

/**
 * Removes a target's edges that its content no longer shows.
 *
 * Scoped by origin because only some origins can be re-verified from markup:
 * a scan can confirm a transclusion is gone, but a fork carries no marker, so
 * a scan must never remove a Remixer- or fingerprint-recorded copy.
 *
 * @param presentSources - sources the target still reuses.
 * @param origins - origins this check is authoritative for; null for all
 *   (the target itself is gone).
 * @returns Edges marked removed.
 */
export const reconcileTargetEdges = async (
  target: string,
  presentSources: string[],
  origins: ReuseEdgeOrigin[] | null = ["scan"],
): Promise<number> => {
  const res = await PageReuseEdge.updateMany(
    {
      target: { $eq: target },
      source: { $nin: presentSources },
      status: { $ne: "removed" },
      ...(origins ? { origin: { $in: origins } } : {}),
    },
    { $set: { status: "removed", removedAt: new Date() } },
  );
  return res.modifiedCount;
};

/**
 * {@link reconcileTargetEdges} for many targets in one round trip per
 * {@link BULK_BATCH_SIZE}. Used by the scanner, which reconciles every page it
 * reads.
 *
 * @returns Edges marked removed.
 */
export const reconcileTargetEdgesBulk = async (
  items: {
    target: string;
    presentSources: string[];
    origins: ReuseEdgeOrigin[];
  }[],
): Promise<number> => {
  const removedAt = new Date();
  let removed = 0;
  for (const batch of chunk(items, BULK_BATCH_SIZE)) {
    const ops: PageReuseEdgeBulkOps = batch.map((item) => ({
      updateMany: {
        filter: {
          target: { $eq: item.target },
          source: { $nin: item.presentSources },
          status: { $ne: "removed" },
          origin: { $in: item.origins },
        },
        update: { $set: { status: "removed", removedAt } },
      },
    }));
    const res = await PageReuseEdge.bulkWrite(ops, { ordered: false });
    removed += res.modifiedCount;
  }
  return removed;
};

/**
 * Fills `sourceBook` on edges whose source page now has a known book. Remixer
 * records edges before the source's book is known, and a scan writes a page's
 * edges before its sources' books are scanned, so this runs after a library's
 * pages are in place.
 *
 * @param sourcePrefix - only edges whose source id starts with this
 *   (`${lib}-`), so one library's pass touches its own sources.
 * @returns Edges updated.
 */
export const fillEdgeSourceBooks = async (
  sourcePrefix: string,
  { shouldStop }: { shouldStop?: () => boolean } = {},
): Promise<number> => {
  const prefixRe = new RegExp(`^${sourcePrefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`);
  let updated = 0;
  let lastId: Types.ObjectId | null = null;

  for (;;) {
    if (shouldStop?.()) break;
    const edges: { _id: Types.ObjectId; source: string }[] =
      await PageReuseEdge.find(
        {
          source: { $regex: prefixRe },
          sourceBook: null,
          ...(lastId ? { _id: { $gt: lastId } } : {}),
        },
        { _id: 1, source: 1 },
      )
        .sort({ _id: 1 })
        .limit(BULK_BATCH_SIZE)
        .lean<{ _id: Types.ObjectId; source: string }[]>();
    if (edges.length === 0) break;
    lastId = edges[edges.length - 1]._id;

    const sources = [...new Set(edges.map((e) => e.source))];
    const nodes = await PageNode.find(
      { nodeID: { $in: sources }, bookID: { $ne: null } },
      { _id: 0, nodeID: 1, bookID: 1 },
    ).lean<{ nodeID: string; bookID: string }[]>();
    if (nodes.length === 0) continue;

    const ops: PageReuseEdgeBulkOps = nodes.map((node) => ({
      updateMany: {
        filter: { source: { $eq: node.nodeID }, sourceBook: null },
        update: { $set: { sourceBook: node.bookID } },
      },
    }));
    const res = await PageReuseEdge.bulkWrite(ops, { ordered: false });
    updated += res.modifiedCount;
  }
  return updated;
};

/**
 * Books that share a reuse link with the given books (or with any book of a
 * library), in either direction, and already have a summary. Their
 * upstream/downstream lists go stale when the given books are scanned, so
 * the scanner rebuilds them. Books never summarized are left alone, so a
 * rebuild doesn't make an unscanned book look scanned.
 */
export const findNeighborBooks = async ({
  bookIDs,
  libPrefix,
}: {
  bookIDs?: string[];
  /** e.g. `chem-`: every book of that library. */
  libPrefix?: string;
}): Promise<string[]> => {
  const own = libPrefix
    ? { $regex: new RegExp(`^${libPrefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`) }
    : { $in: bookIDs ?? [] };
  const [sources, targets] = await Promise.all([
    PageReuseEdge.distinct("sourceBook", { targetBook: own, sourceBook: { $ne: null } }),
    PageReuseEdge.distinct("targetBook", { sourceBook: own, targetBook: { $ne: null } }),
  ]);
  const isOwn = (id: string) =>
    libPrefix ? id.startsWith(libPrefix) : (bookIDs ?? []).includes(id);
  const candidates = [...new Set([...sources, ...targets] as string[])].filter((id) => id && !isOwn(id));
  if (candidates.length === 0) return [];
  const summarized: string[] = [];
  for (const batch of chunk(candidates, IN_QUERY_CHUNK)) {
    const rows = await BookReuseSummary.find(
      { bookID: { $in: batch } },
      { _id: 0, bookID: 1 },
    ).lean<{ bookID: string }[]>();
    summarized.push(...rows.map((r) => r.bookID));
  }
  return summarized.sort();
};

/**
 * Breaks the live edges onto a source that no longer exists: a transclusion
 * or embedded section of it now renders nothing. Copies (fork, full,
 * excerpt) keep their content, so their edges stay as they are; the deletion
 * event still tells their leads.
 */
export const markSourceBroken = async (source: string): Promise<number> => {
  const res = await PageReuseEdge.updateMany(
    {
      source: { $eq: source },
      status: { $in: CURRENT_EDGE_STATUSES },
      type: { $in: LIVE_EDGE_TYPES },
    },
    { $set: { status: "broken" } },
  );
  return res.modifiedCount;
};

// ── Graph walks ──────────────────────────────────────────────────────────────

const GRAPH_EDGE_PROJECTION = {
  _id: 0,
  source: 1,
  target: 1,
  type: 1,
  targetBook: 1,
} as const;

/**
 * Every page affected when `sourceId` changes, through live chains, with
 * fork/full copies reported as out of date. See `walkDownstream`.
 */
export const findAffectedByChange = async (
  sourceId: string,
): Promise<DownstreamWalk> => {
  const walk = await walkDownstream(sourceId, async (sourceIds) => {
    const results = await Promise.all(
      chunk(sourceIds, IN_QUERY_CHUNK).map((ids) =>
        PageReuseEdge.find(
          { source: { $in: ids }, status: { $in: CURRENT_EDGE_STATUSES } },
          GRAPH_EDGE_PROJECTION,
        ).lean<GraphEdge[]>(),
      ),
    );
    return results.flat();
  });
  if (walk.cycle || walk.truncated) {
    provenanceLog.warn(
      { sourceId, cycle: walk.cycle, truncated: walk.truncated },
      "Downstream walk hit a reuse cycle or the depth limit",
    );
  }
  return walk;
};

/** The ultimate origin of a page's content. See `resolveChainRoot`. */
export const findChainRoot = async (nodeId: string): Promise<ChainRoot> =>
  resolveChainRoot(nodeId, (targetId) =>
    PageReuseEdge.find(
      { target: { $eq: targetId }, status: { $in: CURRENT_EDGE_STATUSES } },
      GRAPH_EDGE_PROJECTION,
    ).lean<GraphEdge[]>(),
  );

/** Recomputes and stores a page's `rootSource` / `reuseDepth` / `reuseCycle`. */
export const refreshChainRoot = async (nodeId: string): Promise<ChainRoot> => {
  const root = await findChainRoot(nodeId);
  await PageNode.updateOne(
    { nodeID: { $eq: nodeId } },
    {
      $set: {
        rootSource: root.root,
        reuseDepth: root.depth,
        reuseCycle: root.cycle,
      },
    },
  );
  return root;
};

export type LineageEdge = {
  source: string;
  target: string;
  sourceBook: string | null;
  targetBook: string | null;
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  status: ReuseEdgeStatus;
  /** 1 = a direct edge of the page asked about. */
  hops: number;
};

export type Lineage = { edges: LineageEdge[]; truncated: boolean };

/**
 * A page's reuse chain in one direction, for display:
 * `up` = where the page's content comes from, `down` = who reuses it.
 *
 * A single `$graphLookup`, which visits each edge once, so cycles are safe.
 * For a very popular source prefer the book summary for `down`: the lookup
 * runs in memory and is capped by MongoDB at 100 MB.
 */
export const getLineage = async (
  nodeId: string,
  direction: "up" | "down",
  {
    maxDepth = MAX_CHAIN_DEPTH,
    liveOnly = false,
    limit = DEFAULT_LINEAGE_LIMIT,
  }: { maxDepth?: number; liveOnly?: boolean; limit?: number } = {},
): Promise<Lineage> => {
  const depth = Math.min(Math.max(Math.trunc(maxDepth), 1), MAX_CHAIN_DEPTH);
  const restrict: Record<string, unknown> = {
    status: { $in: CURRENT_EDGE_STATUSES },
  };
  if (liveOnly) restrict.type = { $in: LIVE_EDGE_TYPES };

  const [result] = await PageNode.aggregate<{ edges: LineageEdge[] }>([
    { $match: { nodeID: { $eq: nodeId } } },
    {
      $graphLookup: {
        from: PageReuseEdge.collection.name,
        startWith: "$nodeID",
        connectFromField: direction === "up" ? "source" : "target",
        connectToField: direction === "up" ? "target" : "source",
        as: "edges",
        // maxDepth 0 means direct edges only.
        maxDepth: depth - 1,
        depthField: "hops",
        restrictSearchWithMatch: restrict,
      },
    },
    { $project: { _id: 0, edges: 1 } },
  ]);

  const edges = (result?.edges ?? [])
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceBook: edge.sourceBook ?? null,
      targetBook: edge.targetBook ?? null,
      type: edge.type,
      origin: edge.origin,
      status: edge.status,
      hops: Number(edge.hops) + 1,
    }))
    .sort(
      (a, b) =>
        a.hops - b.hops ||
        a.target.localeCompare(b.target) ||
        a.source.localeCompare(b.source),
    );

  return {
    edges: edges.slice(0, limit),
    truncated: edges.length > limit,
  };
};

// ── Book rollups ─────────────────────────────────────────────────────────────

const emptyTotals = (): BookReuseSummaryInterface["totals"] => ({
  pages: 0,
  original: 0,
  transclude: 0,
  fork: 0,
  full: 0,
  mixed: 0,
  structural: 0,
  unknown: 0,
  viaChain: 0,
});

/** Book-to-book links in one direction, excluding reuse within the book. */
const aggregateBookLinks = (
  bookID: string,
  direction: "upstream" | "downstream",
) => {
  const own = direction === "upstream" ? "targetBook" : "sourceBook";
  const other = direction === "upstream" ? "sourceBook" : "targetBook";
  return PageReuseEdge.aggregate<BookReuseLink>([
    {
      $match: {
        [own]: { $eq: bookID },
        [other]: { $nin: [null, bookID] },
        status: { $in: CURRENT_EDGE_STATUSES },
      },
    },
    {
      $group: {
        _id: `$${other}`,
        pages: { $addToSet: "$target" },
        types: { $addToSet: "$type" },
      },
    },
    { $project: { _id: 0, bookID: "$_id", pages: { $size: "$pages" }, types: 1 } },
    { $sort: { pages: -1, bookID: 1 } },
    { $limit: MAX_SUMMARY_LINKS },
  ]);
};

/**
 * Recomputes one book's rollup from its page nodes and edges and stores it.
 * Cheap enough to run after every scan of the book: three indexed
 * aggregations scoped to the book.
 */
export const rebuildBookSummary = async (
  bookID: string,
): Promise<BookReuseSummaryInterface> => {
  const [lib] = getLibraryAndPageFromBookID(bookID) as [string, string];
  const livePages = { bookID: { $eq: bookID }, deletedAt: null };

  const [kindCounts, viaChain, upstream, downstream] = await Promise.all([
    PageNode.aggregate<{ _id: PageNodeKind; n: number }>([
      { $match: livePages },
      { $group: { _id: "$kind", n: { $sum: 1 } } },
    ]),
    PageNode.countDocuments({ ...livePages, reuseDepth: { $gte: 2 } }),
    aggregateBookLinks(bookID, "upstream"),
    aggregateBookLinks(bookID, "downstream"),
  ]);

  const totals = emptyTotals();
  for (const { _id: kind, n } of kindCounts) {
    if (kind in totals) totals[kind] = n;
    totals.pages += n;
  }
  totals.viaChain = viaChain;

  const summary: BookReuseSummaryInterface = {
    bookID,
    lib,
    totals,
    upstream,
    downstream,
    computedAt: new Date(),
  };
  await BookReuseSummary.replaceOne({ bookID: { $eq: bookID } }, summary, {
    upsert: true,
  });
  return summary;
};
