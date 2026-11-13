import { Types } from "mongoose";
import PageNode, { type PageNodeKind } from "../../models/pagenode.js";
import PageReuseEdge, {
  type ReuseEdgeOrigin,
  type ReuseEdgeStatus,
} from "../../models/pagereuseedge.js";
import BookReuseSummary, {
  type BookReuseSummaryInterface,
} from "../../models/bookreusesummary.js";
import SourceChangeEvent from "../../models/sourcechangeevent.js";
import Book from "../../models/book.js";
import { pageNodeId, type ReuseEdgeType } from "../../util/provenance-graph.js";
import {
  collectIds,
  groupUnscannedSources,
  orderBookTree,
  toViewRef,
  type UnscannedSourceGroup,
  type ViewRef,
} from "../../util/content-sources-view.js";
import { getLineage } from "./page-provenance-service.js";
import { CXOneFetch } from "../../util/librariesclient.js";
import {
  revisionsBetween,
  sanitizeRevisionDiff,
  type RawRevision,
  type RevisionView,
} from "../../util/revision-diff.js";
import { parsePageNodeId } from "../../util/provenance-graph.js";

/**
 * Read side of the provenance graph for one book, as the project Content
 * Sources view shows it. Read-only: nothing here writes to Conductor or the
 * library.
 */

/** Edges a reader should see: still in the content, or broken by a deletion. */
const VISIBLE_EDGE_STATUSES: ReuseEdgeStatus[] = ["active", "source-changed", "broken"];
/** Statuses that ask something of the book's team. */
const ATTENTION_STATUSES: ReuseEdgeStatus[] = ["source-changed", "broken"];

const RECENT_CHANGES_LIMIT = 20;
const UNSCANNED_EDGE_LIMIT = 5000;

/**
 * Titles for pages and books. A bookID has the same shape as its cover page's
 * nodeID, so page nodes name books too; the Commons `Book` record covers
 * books whose cover was never scanned.
 */
export const loadTitles = async (ids: string[]): Promise<Map<string, string>> => {
  const titles = new Map<string, string>();
  if (ids.length === 0) return titles;
  const nodes = await PageNode.find(
    { nodeID: { $in: ids } },
    { _id: 0, nodeID: 1, title: 1 },
  ).lean<{ nodeID: string; title?: string }[]>();
  for (const node of nodes) if (node.title) titles.set(node.nodeID, node.title);

  const missing = ids.filter((id) => !titles.has(id));
  if (missing.length > 0) {
    const books = await Book.find(
      { bookID: { $in: missing } },
      { _id: 0, bookID: 1, title: 1 },
    ).lean<{ bookID: string; title?: string }[]>();
    for (const book of books) if (book.title) titles.set(book.bookID, book.title);
  }
  return titles;
};

export type BookLinkView = ViewRef & { pages: number; types: ReuseEdgeType[] };

export type RecentChangeView = {
  /** The change event, for marking it reviewed. */
  eventID: string;
  source: ViewRef;
  fromRev?: number;
  toRev?: number;
  deleted: boolean;
  changedAt: Date;
  /** This book's pages it reached. */
  pages: number;
  /** Reached only copies (fork/full) in this book. */
  frozen: boolean;
  notified: boolean;
};

export type ContentSourcesOverview = {
  bookID: string;
  book: ViewRef;
  /** False until the scanner has summarized the book. */
  scanned: boolean;
  computedAt: Date | null;
  totals: BookReuseSummaryInterface["totals"] | null;
  upstream: BookLinkView[];
  downstream: BookLinkView[];
  /** Reuse whose source book hasn't been scanned, by source library. */
  unscannedSources: (UnscannedSourceGroup & { exampleRefs: ViewRef[] })[];
  /** Incoming reuse that needs a look. */
  attention: { sourceChanged: number; broken: number };
  recentChanges: RecentChangeView[];
};

export const getContentSourcesOverview = async (
  bookID: string,
): Promise<ContentSourcesOverview> => {
  const [summary, unscannedEdges, attentionCounts, events] = await Promise.all([
    BookReuseSummary.findOne({ bookID: { $eq: bookID } }, { _id: 0 })
      .lean<BookReuseSummaryInterface>(),
    PageReuseEdge.find(
      {
        targetBook: { $eq: bookID },
        sourceBook: null,
        status: { $in: VISIBLE_EDGE_STATUSES },
      },
      { _id: 0, source: 1, target: 1, type: 1 },
    )
      .limit(UNSCANNED_EDGE_LIMIT)
      .lean<{ source: string; target: string; type: ReuseEdgeType }[]>(),
    PageReuseEdge.aggregate<{ _id: ReuseEdgeStatus; n: number }>([
      { $match: { targetBook: { $eq: bookID }, status: { $in: ATTENTION_STATUSES } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    // Changes this book's project hasn't marked reviewed yet.
    SourceChangeEvent.find(
      { affected: { $elemMatch: { bookID: { $eq: bookID }, reviewedAt: null } } },
      { _id: 1, sourcePage: 1, fromRev: 1, toRev: 1, deleted: 1, changedAt: 1, affected: 1, notifiedAt: 1 },
    )
      .sort({ changedAt: -1 })
      .limit(RECENT_CHANGES_LIMIT)
      .lean(),
  ]);

  const unscanned = groupUnscannedSources(unscannedEdges);
  const titles = await loadTitles(
    collectIds(
      [bookID],
      (summary?.upstream ?? []).map((l) => l.bookID),
      (summary?.downstream ?? []).map((l) => l.bookID),
      unscanned.flatMap((g) => g.examples),
      events.map((e) => e.sourcePage),
    ),
  );
  const linkView = (link: { bookID: string; pages: number; types: ReuseEdgeType[] }): BookLinkView => ({
    ...toViewRef(link.bookID, titles),
    pages: link.pages,
    types: link.types,
  });

  return {
    bookID,
    book: toViewRef(bookID, titles),
    scanned: Boolean(summary),
    computedAt: summary?.computedAt ?? null,
    totals: summary?.totals ?? null,
    upstream: (summary?.upstream ?? []).map(linkView),
    downstream: (summary?.downstream ?? []).map(linkView),
    unscannedSources: unscanned.map((group) => ({
      ...group,
      exampleRefs: group.examples.map((id) => toViewRef(id, titles)),
    })),
    attention: {
      sourceChanged: attentionCounts.find((c) => c._id === "source-changed")?.n ?? 0,
      broken: attentionCounts.find((c) => c._id === "broken")?.n ?? 0,
    },
    recentChanges: events.map((event) => {
      const mine = event.affected?.find((a) => a.bookID === bookID);
      return {
        eventID: String(event._id),
        source: toViewRef(event.sourcePage, titles),
        fromRev: event.fromRev,
        toRev: event.toRev,
        deleted: event.deleted,
        changedAt: event.changedAt,
        pages: mine?.pages ?? 0,
        frozen: mine?.frozen ?? false,
        notified: Boolean(event.notifiedAt),
      };
    }),
  };
};

/**
 * Marks a source change reviewed for one book: that change and any older,
 * unreviewed change of the same source for the same book leave the book's
 * list and its leads' emails. The book's links onto the source go back to
 * `active` (at the reviewed revision) unless a newer change of the source is
 * still waiting for review. Other books reusing the source are unaffected.
 *
 * @returns null when the event doesn't exist or doesn't reach the book.
 */
export const markSourceChangeReviewed = async (
  bookID: string,
  eventID: string,
  reviewer: string,
): Promise<{ reviewed: number; edgesReset: number } | null> => {
  if (!Types.ObjectId.isValid(eventID)) return null;
  const event = await SourceChangeEvent.findOne(
    { _id: { $eq: new Types.ObjectId(eventID) }, "affected.bookID": { $eq: bookID } },
    { _id: 1, sourcePage: 1, changedAt: 1, toRev: 1, deleted: 1 },
  ).lean();
  if (!event) return null;

  const reviewedAt = new Date();
  const res = await SourceChangeEvent.updateMany(
    {
      sourcePage: { $eq: event.sourcePage },
      changedAt: { $lte: event.changedAt },
      affected: { $elemMatch: { bookID: { $eq: bookID }, reviewedAt: null } },
    },
    { $set: { "affected.$[book].reviewedAt": reviewedAt, "affected.$[book].reviewedBy": reviewer } },
    { arrayFilters: [{ "book.bookID": bookID, "book.reviewedAt": null }] },
  );

  // A deletion's links are broken and need fixing, not acknowledging.
  let edgesReset = 0;
  const newerWaiting = await SourceChangeEvent.exists({
    sourcePage: { $eq: event.sourcePage },
    changedAt: { $gt: event.changedAt },
    affected: { $elemMatch: { bookID: { $eq: bookID }, reviewedAt: null } },
  });
  if (!event.deleted && !newerWaiting) {
    const reset = await PageReuseEdge.updateMany(
      { source: { $eq: event.sourcePage }, targetBook: { $eq: bookID }, status: "source-changed" },
      {
        $set: {
          status: "active",
          ...(event.toRev !== undefined ? { seenRevision: event.toRev } : {}),
        },
      },
    );
    edgesReset = reset.modifiedCount;
  }
  return { reviewed: res.modifiedCount, edgesReset };
};

export type SourceChangeRevisions = {
  source: ViewRef;
  fromRev?: number;
  toRev?: number;
  deleted: boolean;
  /** Newest first. */
  revisions: RevisionView[];
  /** What changed from `fromRev` to `toRev`, sanitized; null when unavailable. */
  diffHtml: string | null;
};

/**
 * The library revisions a source change spans, and the diff between its two
 * ends, read live from the source's library (nothing is stored). Only for a
 * change that reaches the given book. Read-only.
 *
 * @returns null when the event doesn't exist or doesn't reach the book.
 */
export const getSourceChangeRevisions = async (
  bookID: string,
  eventID: string,
): Promise<SourceChangeRevisions | null> => {
  if (!Types.ObjectId.isValid(eventID)) return null;
  const event = await SourceChangeEvent.findOne(
    { _id: { $eq: new Types.ObjectId(eventID) }, "affected.bookID": { $eq: bookID } },
    { _id: 0, sourcePage: 1, fromRev: 1, toRev: 1, deleted: 1 },
  ).lean();
  if (!event) return null;

  const titles = await loadTitles([event.sourcePage]);
  const base = {
    source: toViewRef(event.sourcePage, titles),
    fromRev: event.fromRev,
    toRev: event.toRev,
    deleted: event.deleted,
  };
  const parts = parsePageNodeId(event.sourcePage);
  if (!parts || event.deleted || event.toRev === undefined) {
    return { ...base, revisions: [], diffHtml: null };
  }

  const read = (api: string) =>
    CXOneFetch({ scope: "page", path: parts.pageID, api, subdomain: parts.lib, silentFail: true });
  const [revRes, diffRes] = await Promise.all([
    read("revisions?dream.out.format=json"),
    event.fromRev !== undefined
      ? read(
          `diff?revision=${event.toRev}&previous=${event.fromRev}&format=html&dream.out.format=json`,
        )
      : Promise.resolve(null),
  ]);

  let revisions: RevisionView[] = [];
  if (revRes.ok) {
    const body = (await revRes.json().catch(() => null)) as { page?: RawRevision | RawRevision[] } | null;
    const raw = body?.page ? ([] as RawRevision[]).concat(body.page) : [];
    revisions = revisionsBetween(raw, event.fromRev, event.toRev);
  }

  let diffHtml: string | null = null;
  if (diffRes?.ok) {
    const body = (await diffRes.json().catch(() => null)) as { "#text"?: string } | string | null;
    const html = typeof body === "string" ? body : body?.["#text"];
    if (html) diffHtml = sanitizeRevisionDiff(html);
  }

  return { ...base, revisions, diffHtml };
};

export type PageSourceView = ViewRef & {
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  status: ReuseEdgeStatus;
  /** For a copied excerpt: how many of the page's blocks came from the source. */
  blocks?: number;
};

export type ContentPageView = ViewRef & {
  pageID: number;
  /** Nesting in the book: 0 = cover, 1 = top-level pages, ... */
  depth: number;
  kind: PageNodeKind;
  /** 0 = own content, 1 = direct reuse, 2+ = through a chain. */
  reuseDepth: number;
  /** Ultimate origin when it differs from the direct source. */
  rootSource: ViewRef | null;
  reuseCycle: boolean;
  sources: PageSourceView[];
};

export type ContentPagesQuery = {
  kind?: PageNodeKind;
  /** Only pages with a source that changed or broke. */
  attention?: boolean;
};

/** Pages returned in one response; far above any real book's size. */
export const MAX_CONTENT_PAGES = 5000;

type NodeRow = {
  nodeID: string;
  pageID: number;
  parentID?: number | null;
  path?: string | null;
  title?: string;
  kind: PageNodeKind;
  reuseDepth?: number;
  rootSource?: string | null;
  reuseCycle?: boolean;
};

/**
 * The book's pages with their direct sources, in table-of-contents order and
 * with each page's depth, so the view can indent the book's levels. The whole
 * book in one response (up to {@link MAX_CONTENT_PAGES}); filters keep the
 * matching pages in place.
 */
export const listContentPages = async (
  bookID: string,
  { kind, attention = false }: ContentPagesQuery = {},
): Promise<{ total: number; truncated: boolean; pages: ContentPageView[] }> => {
  const coverPageID = Number(bookID.slice(bookID.lastIndexOf("-") + 1));
  const all = await PageNode.find(
    { bookID: { $eq: bookID }, deletedAt: null },
    {
      _id: 0,
      nodeID: 1,
      pageID: 1,
      parentID: 1,
      path: 1,
      title: 1,
      kind: 1,
      reuseDepth: 1,
      rootSource: 1,
      reuseCycle: 1,
    },
  )
    .limit(MAX_CONTENT_PAGES + 1)
    .lean<NodeRow[]>();
  const truncated = all.length > MAX_CONTENT_PAGES;
  const book = truncated ? all.slice(0, MAX_CONTENT_PAGES) : all;
  const places = orderBookTree(book, coverPageID);

  let attentionTargets: Set<string> | null = null;
  if (attention) {
    const targets = await PageReuseEdge.distinct("target", {
      targetBook: { $eq: bookID },
      status: { $in: ATTENTION_STATUSES },
    });
    attentionTargets = new Set(targets as string[]);
  }
  const nodes = book
    .filter((n) => (!kind || n.kind === kind) && (!attentionTargets || attentionTargets.has(n.nodeID)))
    .sort((a, b) => (places.get(a.nodeID)?.order ?? 0) - (places.get(b.nodeID)?.order ?? 0));

  const edges: { target: string; source: string; type: ReuseEdgeType; origin: ReuseEdgeOrigin; status: ReuseEdgeStatus; blocks?: number }[] = [];
  for (let i = 0; i < nodes.length; i += 1000) {
    const batch = nodes.slice(i, i + 1000).map((n) => n.nodeID);
    edges.push(
      ...(await PageReuseEdge.find(
        { target: { $in: batch }, status: { $in: VISIBLE_EDGE_STATUSES } },
        { _id: 0, target: 1, source: 1, type: 1, origin: 1, status: 1, blocks: 1 },
      ).lean<typeof edges>()),
    );
  }

  const titles = await loadTitles(
    collectIds(edges.map((e) => e.source), nodes.map((n) => n.rootSource)),
  );
  for (const node of nodes) if (node.title) titles.set(node.nodeID, node.title);

  const byTarget = new Map<string, PageSourceView[]>();
  for (const edge of edges) {
    const list = byTarget.get(edge.target) ?? [];
    list.push({
      ...toViewRef(edge.source, titles),
      type: edge.type,
      origin: edge.origin,
      status: edge.status,
      ...(edge.blocks ? { blocks: edge.blocks } : {}),
    });
    byTarget.set(edge.target, list);
  }

  return {
    total: nodes.length,
    truncated,
    pages: nodes.map((node) => {
      const sources = byTarget.get(node.nodeID) ?? [];
      const direct = new Set(sources.map((s) => s.id));
      return {
        ...toViewRef(node.nodeID, titles),
        pageID: node.pageID,
        depth: places.get(node.nodeID)?.depth ?? 1,
        kind: node.kind,
        reuseDepth: node.reuseDepth ?? 0,
        rootSource:
          node.rootSource && !direct.has(node.rootSource)
            ? toViewRef(node.rootSource, titles)
            : null,
        reuseCycle: Boolean(node.reuseCycle),
        sources,
      };
    }),
  };
};

export type LineageStepView = {
  source: ViewRef;
  target: ViewRef;
  type: ReuseEdgeType;
  status: ReuseEdgeStatus;
  hops: number;
};

/**
 * One page's chain, upstream (where its content comes from) or downstream
 * (who reuses it). `null` when the page isn't part of the book, so a project
 * can't be used to read another book's lineage.
 */
export const getContentPageLineage = async (
  bookID: string,
  pageID: number,
  direction: "up" | "down",
): Promise<{ page: ViewRef; steps: LineageStepView[]; truncated: boolean } | null> => {
  const [lib] = bookID.split("-");
  const nodeID = pageNodeId(lib, pageID);
  const node = await PageNode.findOne(
    { nodeID: { $eq: nodeID }, bookID: { $eq: bookID } },
    { _id: 0, nodeID: 1 },
  ).lean();
  if (!node) return null;

  const lineage = await getLineage(nodeID, direction, { limit: 500 });
  const titles = await loadTitles(
    collectIds([nodeID], lineage.edges.map((e) => e.source), lineage.edges.map((e) => e.target)),
  );
  return {
    page: toViewRef(nodeID, titles),
    steps: lineage.edges.map((edge) => ({
      source: toViewRef(edge.source, titles),
      target: toViewRef(edge.target, titles),
      type: edge.type,
      status: edge.status,
      hops: edge.hops,
    })),
    truncated: lineage.truncated,
  };
};
