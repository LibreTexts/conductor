import { randomUUID } from "node:crypto";
import { one } from "@libretexts/cxone-expert-node";
import { childLogger } from "../../logger.js";
import Book from "../../models/book.js";
import Library from "../../models/library.js";
import PageNode, { type PageNodeKind } from "../../models/pagenode.js";
import ProvenanceScanState, {
  type ProvenanceScanStateInterface,
} from "../../models/provenancescanstate.js";
import ExpertWithSSM from "../../util/ExpertWithSSM.js";
import { CXOneFetch } from "../../util/librariesclient.js";
import MindTouch from "../../util/CXOne/index.js";
import { mapWithConcurrency } from "../../util/concurrency.js";
import { classifyPageContent } from "../../util/page-classifier.js";
import { edgeTypeForRef, pageNodeId } from "../../util/provenance-graph.js";
import {
  flattenPageTree,
  structuralTagsFor,
  type TreePageInfo,
} from "../../util/provenance-tree.js";
import type { ReuseRef } from "../../util/transclusion.js";
import { createThrottle } from "./library-sync-service.js";
import {
  fillEdgeSourceBooks,
  markPageDeleted,
  rebuildBookSummary,
  reconcileTargetEdgesBulk,
  refreshChainRoot,
  upsertPageNodes,
  upsertReuseEdges,
  type PageNodeUpsert,
  type ReuseEdgeUpsert,
} from "./page-provenance-service.js";

/**
 * The provenance backfill scanner: walks every synced library book by book
 * and records what each page is (original, transclusion, copy, …) and what it
 * reuses.
 *
 * Built for millions of pages:
 * - **Incremental.** One tree request per book returns every page's revision;
 *   a page whose revision matches the stored node costs no content request.
 * - **Resumable.** Progress (phase + cursor) lives in `ProvenanceScanState`,
 *   so each cron call works for a time budget and the next one continues.
 * - **Single-writer.** A per-library lease keeps two server instances from
 *   scanning the same library at once.
 * - **Polite.** Requests to a library are spaced by a per-library throttle.
 *
 * Phases per library: `scanning` (books, cursor = last bookID) → `resolving`
 * (source books on edges, then chain roots, then book summaries; the cursor
 * carries the sub-step) → `complete`. A completed library is re-scanned after
 * {@link RESCAN_AFTER_MS}; thanks to the revision check that pass only reads
 * what changed.
 */

const scanLog = childLogger("provenance-scan");

const envInt = (name: string, fallback: number): number => {
  const value = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Spacing between requests to one library. */
const REQUEST_INTERVAL_MS = envInt("PROVENANCE_SCAN_INTERVAL_MS", 250);
/** Content requests in flight per library. */
const CONTENT_CONCURRENCY = 4;
/** Lease length and renewal period. A dead holder frees the library after LEASE_MS. */
const LEASE_MS = 5 * 60 * 1000;
const LEASE_RENEW_MS = 60 * 1000;
export const DEFAULT_SCAN_BUDGET_MS = 10 * 60 * 1000;
export const MAX_SCAN_BUDGET_MS = 55 * 60 * 1000;
/** A completed library is scanned again after this long. */
const RESCAN_AFTER_MS = envInt("PROVENANCE_RESCAN_AFTER_MS", 24 * 60 * 60 * 1000);
/** Books per Mongo read while walking a library. */
const BOOK_PAGE_SIZE = 50;
/** Nodes per batch in the chain-root pass. */
const ROOT_BATCH_SIZE = 200;
/** Same-library path → page id lookups kept per run before the cache resets. */
const PATH_CACHE_LIMIT = 50_000;

const REUSE_KINDS: PageNodeKind[] = ["transclude", "fork", "full"];
const OWN_CONTENT_KINDS: PageNodeKind[] = ["original", "mixed", "structural"];

type Throttle = ReturnType<typeof createThrottle>;

export type ScanStats = {
  books: number;
  scanned: number;
  skipped: number;
  edgesWritten: number;
  edgesRemoved: number;
  deleted: number;
  errors: number;
};

const emptyStats = (): ScanStats => ({
  books: 0,
  scanned: 0,
  skipped: 0,
  edgesWritten: 0,
  edgesRemoved: 0,
  deleted: 0,
  errors: 0,
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** `${lib}-${pageID}` back into its parts. */
const splitNodeId = (id: string): { lib: string; pageID: number } | null => {
  const dash = id.lastIndexOf("-");
  if (dash <= 0) return null;
  const pageID = parseInt(id.slice(dash + 1), 10);
  return Number.isFinite(pageID) ? { lib: id.slice(0, dash), pageID } : null;
};

const isDuplicateKeyError = (err: unknown): boolean =>
  (err as { code?: number })?.code === 11000;

// ── Lease ────────────────────────────────────────────────────────────────────

/** Exclusive hold on one library's scan state, renewed while the scan runs. */
class ScanLease {
  lost = false;
  private timer: NodeJS.Timeout | null = null;

  private constructor(
    readonly lib: string,
    readonly leaseID: string,
  ) {}

  static async acquire(lib: string): Promise<ScanLease | null> {
    try {
      await ProvenanceScanState.updateOne(
        { library: lib },
        { $setOnInsert: { phase: "idle" } },
        { upsert: true },
      );
    } catch (err) {
      // Another instance created the document first; that's fine.
      if (!isDuplicateKeyError(err)) throw err;
    }

    const now = new Date();
    const leaseID = randomUUID();
    const res = await ProvenanceScanState.updateOne(
      {
        library: { $eq: lib },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      {
        $set: {
          leaseID,
          lockedUntil: new Date(now.getTime() + LEASE_MS),
          lastRunAt: now,
        },
      },
    );
    if (res.modifiedCount !== 1) return null;

    const lease = new ScanLease(lib, leaseID);
    lease.timer = setInterval(() => void lease.renew(), LEASE_RENEW_MS);
    lease.timer.unref();
    return lease;
  }

  private async renew(): Promise<void> {
    if (this.lost) return;
    try {
      const res = await ProvenanceScanState.updateOne(
        { library: { $eq: this.lib }, leaseID: { $eq: this.leaseID } },
        { $set: { lockedUntil: new Date(Date.now() + LEASE_MS) } },
      );
      if (res.matchedCount === 0) {
        this.lost = true;
        this.stopTimer();
        scanLog.error({ library: this.lib }, "Lost the provenance scan lease, stopping");
      }
    } catch (err) {
      scanLog.warn({ err, library: this.lib }, "Failed to renew the provenance scan lease");
    }
  }

  /** Writes scan state only while this lease still owns the library. */
  async save(
    set: Partial<ProvenanceScanStateInterface>,
    stats?: ScanStats,
  ): Promise<boolean> {
    const inc = stats
      ? {
          "stats.scanned": stats.scanned,
          "stats.skipped": stats.skipped,
          "stats.edgesAdded": stats.edgesWritten,
          "stats.edgesRemoved": stats.edgesRemoved,
          "stats.errors": stats.errors,
        }
      : undefined;
    const res = await ProvenanceScanState.updateOne(
      { library: { $eq: this.lib }, leaseID: { $eq: this.leaseID } },
      { $set: set, ...(inc ? { $inc: inc } : {}) },
    );
    if (res.matchedCount === 0) this.lost = true;
    return !this.lost;
  }

  async release(): Promise<void> {
    this.stopTimer();
    await ProvenanceScanState.updateOne(
      { library: { $eq: this.lib }, leaseID: { $eq: this.leaseID } },
      { $set: { leaseID: null, lockedUntil: null } },
    ).catch((err) =>
      scanLog.warn({ err, library: this.lib }, "Failed to release the provenance scan lease"),
    );
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

// ── One library ──────────────────────────────────────────────────────────────

type ScanContext = {
  lib: string;
  throttle: Throttle;
  deadline: number;
  lease: ScanLease;
  /** `${lib}:${path}` → page id, or null for a path that does not resolve. */
  pathCache: Map<string, number | null>;
  /**
   * Re-read every page even when its revision is unchanged. For when the
   * classification rules change and stored results need redoing.
   */
  rescanContent: boolean;
};

const outOfTime = (ctx: ScanContext): boolean =>
  ctx.lease.lost || Date.now() >= ctx.deadline;

/** Attempts per page request; MindTouch answers bursts with passing 5xx/429s. */
const PAGE_REQUEST_ATTEMPTS = 3;
const PAGE_REQUEST_RETRY_MS = 1000;

/**
 * A throttled page request that retries 5xx and 429 responses with a growing
 * delay. Never throws on an HTTP status; the caller reads `res.status`.
 */
const fetchPage = async (
  ctx: ScanContext,
  path: string | number,
  api: string,
): Promise<Response> => {
  let res: Response | undefined;
  for (let attempt = 1; attempt <= PAGE_REQUEST_ATTEMPTS; attempt += 1) {
    res = await ctx.throttle(() =>
      CXOneFetch({ scope: "page", path, api, subdomain: ctx.lib, silentFail: true }),
    );
    const retryable = res.status >= 500 || res.status === 429;
    if (!retryable || attempt === PAGE_REQUEST_ATTEMPTS) break;
    await new Promise((resolve) => setTimeout(resolve, PAGE_REQUEST_RETRY_MS * attempt));
  }
  return res!;
};

/** Page id for a same-library reuse path, via page info. Null if it doesn't exist. */
const resolvePath = async (
  ctx: ScanContext,
  lib: string,
  rawPath: string,
): Promise<number | null> => {
  const path = rawPath.trim().replace(/^\/+|\/+$/g, "");
  if (!path) return null;
  const key = `${lib}:${path}`;
  if (ctx.pathCache.has(key)) return ctx.pathCache.get(key) ?? null;
  if (ctx.pathCache.size >= PATH_CACHE_LIMIT) ctx.pathCache.clear();

  const res = await fetchPage(ctx, path, MindTouch.API.Page.GET_Page_Info);
  let id: number | null = null;
  if (res.ok) {
    const info = await res.json().catch(() => null);
    const parsed = parseInt(String(info?.["@id"] ?? ""), 10);
    id = Number.isFinite(parsed) ? parsed : null;
  } else if (res.status !== 404) {
    // Transient: don't cache, so a later page can try again.
    return null;
  }
  ctx.pathCache.set(key, id);
  return id;
};

/** PageNode id of a reuse ref's source, or null when it can't be resolved. */
const resolveRef = async (ctx: ScanContext, ref: ReuseRef): Promise<string | null> => {
  if (ref.kind === "cross-library") return pageNodeId(ref.subdomain, ref.pageID);
  const id = await resolvePath(ctx, ctx.lib, ref.path);
  return id ? pageNodeId(ctx.lib, id) : null;
};

type PageScanResult = {
  node: PageNodeUpsert;
  edges: ReuseEdgeUpsert[];
  reconcile: { target: string; scan: string[] };
} | null;

/** Reads one changed page and works out its node and edges. Null on a read failure. */
const scanPage = async (
  ctx: ScanContext,
  bookID: string,
  page: TreePageInfo,
  previousKind: PageNodeKind | undefined,
  base: PageNodeUpsert,
): Promise<PageScanResult> => {
  const targetId = pageNodeId(ctx.lib, page.pageID);
  const res = await fetchPage(ctx, page.pageID, MindTouch.API.Page.GET_page_RawContents);
  if (!res.ok) return null;
  const raw = await res.text();

  const classification = classifyPageContent(raw, structuralTagsFor(page), {
    generatedMatter: page.isGeneratedMatter,
  });
  const edges: ReuseEdgeUpsert[] = [];
  const scanSources: string[] = [];
  for (const ref of classification.refs) {
    const source = await resolveRef(ctx, ref);
    if (!source || source === targetId || scanSources.includes(source)) continue;
    scanSources.push(source);
    edges.push({
      target: targetId,
      source,
      targetBook: bookID,
      type: edgeTypeForRef(ref, {
        targetLib: ctx.lib,
        targetIsStub: classification.isStub,
      }),
      origin: "scan",
    });
  }

  // Markup can't show a copy. Keep "fork"/"full" when Conductor already
  // recorded the page as one (Remixer, or a fingerprint match).
  let kind: PageNodeKind = classification.kind;
  if (kind === "original" && (previousKind === "fork" || previousKind === "full")) {
    kind = previousKind;
  }

  const ownsContent = OWN_CONTENT_KINDS.includes(kind);
  const { fingerprint } = classification;
  return {
    node: {
      ...base,
      kind,
      reuseCount: Math.max(edges.length, kind === "fork" || kind === "full" ? 1 : 0),
      contentHash: fingerprint.contentHash,
      simBands: fingerprint.simBands,
      wordCount: fingerprint.wordCount,
      revision: page.revision,
      scannedAt: new Date(),
      // A page with its own content is its own origin; reuse pages get their
      // root in the resolving phase, once their sources are known.
      ...(ownsContent ? { rootSource: null, reuseDepth: 0, reuseCycle: false } : {}),
    },
    edges,
    reconcile: { target: targetId, scan: scanSources },
  };
};

/**
 * Pages the store lists under the book that the tree no longer shows. Only a
 * 404 (or a deleted flag) proves a page is gone; a page that still exists was
 * moved to another book, and that book's scan will claim it.
 */
const reconcileMissingPages = async (
  ctx: ScanContext,
  bookID: string,
  seenIds: string[],
  stats: ScanStats,
): Promise<void> => {
  const missing = await PageNode.find(
    { bookID: { $eq: bookID }, deletedAt: null, nodeID: { $nin: seenIds } },
    { _id: 0, nodeID: 1, pageID: 1 },
  ).lean<{ nodeID: string; pageID: number }[]>();

  for (const node of missing) {
    if (outOfTime(ctx)) return;
    const res = await fetchPage(ctx, node.pageID, MindTouch.API.Page.GET_Page_Info);
    let gone = res.status === 404;
    if (res.ok) {
      const info = await res.json().catch(() => null);
      gone = String(info?.["@deleted"]) === "true";
    } else if (!gone) {
      continue; // Transient; decide on a later pass.
    }

    if (gone) {
      await markPageDeleted(node.nodeID);
      stats.deleted += 1;
    } else {
      await PageNode.updateOne({ nodeID: { $eq: node.nodeID } }, { $set: { bookID: null } });
    }
  }
};

/** Scans one book: structure for every page, content for changed pages. */
const scanBook = async (
  ctx: ScanContext,
  bookID: string,
  stats: ScanStats,
): Promise<void> => {
  const coverID = parseInt(bookID.slice(ctx.lib.length + 1), 10);
  if (!Number.isFinite(coverID)) return;

  const expert = await ExpertWithSSM.getInstance().forLibrary(ctx.lib);
  const tree = await ctx.throttle(() =>
    expert.pages.getPageTree(coverID, { include: "properties,lastmodified" }),
  );
  const pages = flattenPageTree(one((tree as { page?: unknown })?.page as any));
  if (pages.length === 0) {
    stats.errors += 1;
    scanLog.warn({ bookID }, "Empty tree for book; skipping");
    return;
  }

  const ids = pages.map((p) => pageNodeId(ctx.lib, p.pageID));
  const stored = await PageNode.find(
    { nodeID: { $in: ids } },
    { _id: 0, nodeID: 1, revision: 1, kind: 1, scannedAt: 1 },
  ).lean<{ nodeID: string; revision?: number; kind?: PageNodeKind; scannedAt?: Date }[]>();
  const storedById = new Map(stored.map((n) => [n.nodeID, n]));

  const baseFor = (page: TreePageInfo): PageNodeUpsert => ({
    lib: ctx.lib,
    pageID: page.pageID,
    bookID,
    parentID: page.parentID,
    path: page.path,
    title: page.title,
    modifiedAt: page.modifiedAt,
    deletedAt: null,
  });

  const nodes: PageNodeUpsert[] = [];
  const changed: TreePageInfo[] = [];
  for (const page of pages) {
    const prev = storedById.get(pageNodeId(ctx.lib, page.pageID));
    const unchanged =
      !ctx.rescanContent &&
      prev?.scannedAt &&
      prev.kind !== "unknown" &&
      page.revision !== undefined &&
      prev.revision === page.revision;
    if (unchanged) {
      nodes.push(baseFor(page));
      stats.skipped += 1;
    } else {
      changed.push(page);
    }
  }

  const results = await mapWithConcurrency(changed, CONTENT_CONCURRENCY, async (page) => {
    if (outOfTime(ctx)) return { page, result: null as PageScanResult };
    try {
      const prev = storedById.get(pageNodeId(ctx.lib, page.pageID));
      return { page, result: await scanPage(ctx, bookID, page, prev?.kind, baseFor(page)) };
    } catch (err) {
      scanLog.warn({ err, bookID, pageID: page.pageID }, "Failed to scan page");
      return { page, result: null as PageScanResult };
    }
  });

  const edges: ReuseEdgeUpsert[] = [];
  const reconcile: Parameters<typeof reconcileTargetEdgesBulk>[0] = [];
  const sourceShells = new Map<string, PageNodeUpsert>();
  for (const { page, result } of results) {
    if (!result) {
      // Keep the page in the graph; its content is read on the next pass.
      nodes.push(baseFor(page));
      stats.errors += 1;
      continue;
    }
    stats.scanned += 1;
    nodes.push(result.node);
    edges.push(...result.edges);
    reconcile.push({
      target: result.reconcile.target,
      presentSources: result.reconcile.scan,
      origins: ["scan"],
    });
    for (const edge of result.edges) {
      const parts = splitNodeId(edge.source);
      if (parts && !sourceShells.has(edge.source)) sourceShells.set(edge.source, parts);
    }
  }

  // Sources outside this book get a bare node so graph walks can reach them.
  for (const id of ids) sourceShells.delete(id);
  await upsertPageNodes([...nodes, ...sourceShells.values()]);
  stats.edgesWritten += await upsertReuseEdges(edges);
  stats.edgesRemoved += await reconcileTargetEdgesBulk(reconcile);
  await reconcileMissingPages(ctx, bookID, ids, stats);
  stats.books += 1;
};

/** Pages to compute chain roots for. */
const ROOTS_PREFIX = "roots:";
const SUMMARIES_PREFIX = "summaries:";

export type LibraryScanStatus = "busy" | "up-to-date" | "budget" | "complete" | "error";

export type LibraryScanOutcome = {
  library: string;
  status: LibraryScanStatus;
  phase?: string;
  stats: ScanStats;
  error?: string;
};

const scanLibrary = async (
  lib: string,
  deadline: number,
  force: boolean,
): Promise<LibraryScanOutcome> => {
  const stats = emptyStats();
  const lease = await ScanLease.acquire(lib);
  if (!lease) return { library: lib, status: "busy", stats };

  const ctx: ScanContext = {
    lib,
    throttle: createThrottle(REQUEST_INTERVAL_MS),
    deadline,
    lease,
    pathCache: new Map(),
    rescanContent: force,
  };
  const bookPrefix = new RegExp(`^${escapeRegex(lib)}-`);

  try {
    const state = await ProvenanceScanState.findOne({ library: { $eq: lib } }).lean();
    let phase = state?.phase ?? "idle";
    let cursor = state?.cursor ?? "";

    if (phase === "complete" || phase === "idle") {
      const last = state?.lastCompletedAt?.getTime() ?? 0;
      if (phase === "complete" && !force && Date.now() - last < RESCAN_AFTER_MS) {
        return { library: lib, status: "up-to-date", phase, stats };
      }
      phase = "scanning";
      cursor = "";
      await lease.save({ phase, cursor });
      scanLog.info({ library: lib }, "Provenance scan pass started");
    }

    // ── scanning: book by book ───────────────────────────────────────────
    while (phase === "scanning") {
      if (outOfTime(ctx)) break;
      const books = await Book.find(
        { bookID: { $regex: bookPrefix, $gt: cursor }, syncMissingSince: { $exists: false } },
        { _id: 0, bookID: 1 },
      )
        .sort({ bookID: 1 })
        .limit(BOOK_PAGE_SIZE)
        .lean<{ bookID: string }[]>();

      if (books.length === 0) {
        phase = "resolving";
        cursor = "";
        await lease.save({ phase, cursor });
        break;
      }

      for (const { bookID } of books) {
        if (outOfTime(ctx)) break;
        const bookStats = emptyStats();
        try {
          await scanBook(ctx, bookID, bookStats);
        } catch (err) {
          bookStats.errors += 1;
          scanLog.warn({ err, bookID }, "Failed to scan book");
        }
        cursor = bookID;
        for (const key of Object.keys(stats) as (keyof ScanStats)[]) {
          stats[key] += bookStats[key];
        }
        if (!(await lease.save({ cursor }, bookStats))) break;
      }
    }

    // ── resolving: source books, chain roots, summaries ──────────────────
    if (phase === "resolving" && !outOfTime(ctx)) {
      if (cursor === "") {
        await fillEdgeSourceBooks(`${lib}-`, { shouldStop: () => outOfTime(ctx) });
        if (!outOfTime(ctx)) {
          cursor = ROOTS_PREFIX;
          await lease.save({ cursor });
        }
      }

      while (cursor.startsWith(ROOTS_PREFIX) && !outOfTime(ctx)) {
        const after = cursor.slice(ROOTS_PREFIX.length);
        const reusePages = await PageNode.find(
          { lib: { $eq: lib }, kind: { $in: REUSE_KINDS }, deletedAt: null, nodeID: { $gt: after } },
          { _id: 0, nodeID: 1 },
        )
          .sort({ nodeID: 1 })
          .limit(ROOT_BATCH_SIZE)
          .lean<{ nodeID: string }[]>();
        if (reusePages.length === 0) {
          cursor = SUMMARIES_PREFIX;
        } else {
          await mapWithConcurrency(reusePages, 8, (node) => refreshChainRoot(node.nodeID));
          cursor = `${ROOTS_PREFIX}${reusePages[reusePages.length - 1].nodeID}`;
        }
        await lease.save({ cursor });
      }

      while (cursor.startsWith(SUMMARIES_PREFIX) && !outOfTime(ctx)) {
        const after = cursor.slice(SUMMARIES_PREFIX.length);
        const books = await Book.find(
          { bookID: { $regex: bookPrefix, $gt: after }, syncMissingSince: { $exists: false } },
          { _id: 0, bookID: 1 },
        )
          .sort({ bookID: 1 })
          .limit(BOOK_PAGE_SIZE)
          .lean<{ bookID: string }[]>();
        if (books.length === 0) {
          phase = "complete";
          cursor = "";
          await lease.save({ phase, cursor: null, lastCompletedAt: new Date() });
          scanLog.info({ library: lib }, "Provenance scan pass complete");
          break;
        }
        for (const { bookID } of books) {
          await rebuildBookSummary(bookID);
        }
        cursor = `${SUMMARIES_PREFIX}${books[books.length - 1].bookID}`;
        await lease.save({ cursor });
      }
    }

    return {
      library: lib,
      status: phase === "complete" ? "complete" : "budget",
      phase,
      stats,
    };
  } catch (err) {
    scanLog.error({ err, library: lib }, "Provenance scan failed");
    return {
      library: lib,
      status: "error",
      stats,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await lease.release();
  }
};

// ── Entry point ──────────────────────────────────────────────────────────────

let scanRunning = false;

/** True while this server instance is running a scan. */
export const isProvenanceScanRunning = (): boolean => scanRunning;

/**
 * Scans the named books directly, outside the library walk: no Book record or
 * sync-enabled library is needed, and the library's resumable phase/cursor is
 * left alone. Each library's lease is still taken, so a targeted run can't
 * race a full scan of the same library. Afterwards the books' source books,
 * chain roots and summaries are brought up to date.
 */
const scanSpecificBooks = async (
  bookIDs: string[],
  deadline: number,
  force: boolean,
): Promise<LibraryScanOutcome[]> => {
  const byLib = new Map<string, string[]>();
  for (const bookID of bookIDs) {
    const parts = splitNodeId(bookID);
    if (!parts) continue;
    const list = byLib.get(parts.lib) ?? [];
    list.push(bookID);
    byLib.set(parts.lib, list);
  }

  const outcomes: LibraryScanOutcome[] = [];
  for (const [lib, books] of byLib) {
    const stats = emptyStats();
    const lease = await ScanLease.acquire(lib);
    if (!lease) {
      outcomes.push({ library: lib, status: "busy", stats });
      continue;
    }
    const ctx: ScanContext = {
      lib,
      throttle: createThrottle(REQUEST_INTERVAL_MS),
      deadline,
      lease,
      pathCache: new Map(),
      rescanContent: force,
    };
    try {
      const scannedBooks: string[] = [];
      for (const bookID of books) {
        if (outOfTime(ctx)) break;
        try {
          await scanBook(ctx, bookID, stats);
          scannedBooks.push(bookID);
        } catch (err) {
          stats.errors += 1;
          scanLog.warn({ err, bookID }, "Failed to scan book");
        }
      }

      await fillEdgeSourceBooks(`${lib}-`, { shouldStop: () => outOfTime(ctx) });
      const reusePages = await PageNode.find(
        { bookID: { $in: scannedBooks }, kind: { $in: REUSE_KINDS }, deletedAt: null },
        { _id: 0, nodeID: 1 },
      ).lean<{ nodeID: string }[]>();
      await mapWithConcurrency(reusePages, 8, (node) => refreshChainRoot(node.nodeID));
      for (const bookID of scannedBooks) await rebuildBookSummary(bookID);

      outcomes.push({
        library: lib,
        status: scannedBooks.length === books.length ? "complete" : "budget",
        phase: "targeted",
        stats,
      });
    } catch (err) {
      scanLog.error({ err, library: lib }, "Targeted provenance scan failed");
      outcomes.push({
        library: lib,
        status: "error",
        stats,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await lease.release();
    }
  }
  return outcomes;
};

export type ProvenanceScanOptions = {
  /** Library subdomains to scan; defaults to every synced library. */
  libraries?: string[];
  /**
   * Specific books (`${lib}-${coverID}`) to scan instead of walking
   * libraries. For testing and for re-scanning a book on demand.
   */
  books?: string[];
  /** How long this run may work before yielding. */
  budgetMs?: number;
  /**
   * Re-scan libraries that completed recently, and re-read every page even
   * when its revision is unchanged (use after classification rules change).
   */
  force?: boolean;
};

/**
 * Runs the scanner for one time budget, library by library, resuming each
 * where the last run stopped. Returns one outcome per library it touched.
 */
export const runProvenanceScan = async ({
  libraries,
  books,
  budgetMs = DEFAULT_SCAN_BUDGET_MS,
  force = false,
}: ProvenanceScanOptions = {}): Promise<LibraryScanOutcome[]> => {
  if (scanRunning) {
    scanLog.info("Provenance scan already running on this instance; skipping");
    return [];
  }
  scanRunning = true;
  const deadline = Date.now() + Math.min(Math.max(budgetMs, 60_000), MAX_SCAN_BUDGET_MS);

  try {
    if (books?.length) {
      const outcomes = await scanSpecificBooks(books, deadline, force);
      for (const outcome of outcomes) {
        scanLog.info(
          { library: outcome.library, status: outcome.status, bookIDs: books, ...outcome.stats },
          "Targeted provenance scan finished",
        );
      }
      return outcomes;
    }

    const synced = await Library.find(
      { hidden: false, syncSupported: true },
      { _id: 0, subdomain: 1 },
    ).lean<{ subdomain: string }[]>();
    let targets = synced.map((l) => l.subdomain);
    if (libraries?.length) {
      const wanted = new Set(libraries.map((l) => l.toLowerCase()));
      targets = targets.filter((s) => wanted.has(s.toLowerCase()));
    }

    const outcomes: LibraryScanOutcome[] = [];
    for (const lib of targets) {
      if (Date.now() >= deadline) break;
      const outcome = await scanLibrary(lib, deadline, force);
      outcomes.push(outcome);
      scanLog.info(
        { library: lib, status: outcome.status, phase: outcome.phase, ...outcome.stats },
        "Provenance scan slice finished for library",
      );
    }
    return outcomes;
  } finally {
    scanRunning = false;
  }
};
