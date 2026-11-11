import BookReuseSummary, {
  type BookReuseSummaryInterface,
} from "../../models/bookreusesummary.js";
import ProvenanceScanState from "../../models/provenancescanstate.js";
import PageReuseEdge, { CURRENT_EDGE_STATUSES } from "../../models/pagereuseedge.js";
import {
  buildBookGraph,
  toViewRef,
  type BookGraphEdge,
  type ViewRef,
} from "../../util/content-sources-view.js";
import { loadTitles } from "./content-sources-service.js";

/**
 * Library-wide views of the provenance graph for LibreTexts staff: reuse
 * totals per library and the book connection graph. Both read the small
 * per-book summaries rather than the page-level collections, so they stay
 * cheap however many pages the libraries hold. Read-only.
 */

type Totals = BookReuseSummaryInterface["totals"];

export type LibraryReuseStats = {
  library: string;
  /** Books with a summary, i.e. scanned at least once. */
  books: number;
  totals: Totals;
  /** Books in this library that reuse another book / are reused by one. */
  booksReusing: number;
  booksReused: number;
  scan: {
    phase: string;
    lastRunAt: Date | null;
    lastCompletedAt: Date | null;
    running: boolean;
    stats: { scanned: number; skipped: number; edgesAdded: number; edgesRemoved: number; errors: number } | null;
  } | null;
  /** Reuse links whose source page is now deleted. */
  brokenLinks: number;
};

const TOTAL_KEYS: (keyof Totals)[] = [
  "pages", "original", "transclude", "fork", "full", "mixed", "structural", "unknown", "viaChain",
];

export const getLibraryReuseStats = async (): Promise<LibraryReuseStats[]> => {
  const sum = Object.fromEntries(TOTAL_KEYS.map((k) => [k, { $sum: `$totals.${k}` }]));
  const [byLib, states, broken] = await Promise.all([
    BookReuseSummary.aggregate<{
      _id: string;
      books: number;
      booksReusing: number;
      booksReused: number;
    } & Totals>([
      {
        $group: {
          _id: "$lib",
          books: { $sum: 1 },
          booksReusing: { $sum: { $cond: [{ $gt: [{ $size: "$upstream" }, 0] }, 1, 0] } },
          booksReused: { $sum: { $cond: [{ $gt: [{ $size: "$downstream" }, 0] }, 1, 0] } },
          ...sum,
        },
      },
    ]),
    ProvenanceScanState.find(
      {},
      { _id: 0, library: 1, phase: 1, lastRunAt: 1, lastCompletedAt: 1, lockedUntil: 1, stats: 1 },
    ).lean(),
    // Broken links per target library; the target book's prefix is its library.
    PageReuseEdge.aggregate<{ _id: string; n: number }>([
      { $match: { status: "broken", targetBook: { $ne: null } } },
      { $group: { _id: { $arrayElemAt: [{ $split: ["$targetBook", "-"] }, 0] }, n: { $sum: 1 } } },
    ]),
  ]);

  const libs = new Set<string>([...byLib.map((r) => r._id), ...states.map((s) => s.library)]);
  const now = Date.now();
  return [...libs]
    .map((library) => {
      const row = byLib.find((r) => r._id === library);
      const state = states.find((s) => s.library === library);
      const totals = Object.fromEntries(
        TOTAL_KEYS.map((k) => [k, row?.[k] ?? 0]),
      ) as Totals;
      return {
        library,
        books: row?.books ?? 0,
        totals,
        booksReusing: row?.booksReusing ?? 0,
        booksReused: row?.booksReused ?? 0,
        scan: state
          ? {
              phase: state.phase,
              lastRunAt: state.lastRunAt ?? null,
              lastCompletedAt: state.lastCompletedAt ?? null,
              running: Boolean(state.lockedUntil && state.lockedUntil.getTime() > now),
              stats: state.stats ?? null,
            }
          : null,
        brokenLinks: broken.find((b) => b._id === library)?.n ?? 0,
      };
    })
    .sort((a, b) => b.totals.pages - a.totals.pages || a.library.localeCompare(b.library));
};

type SummaryLink = { bookID: string; pages: number; types: BookGraphEdge["types"] };

export type BookGraphView = {
  /**
   * `book` nodes are books; `library` nodes stand for every not-yet-scanned
   * book of one library, so reuse from them still shows.
   */
  nodes: (ViewRef & { kind: "book" | "library"; pages: number | null; degree: number })[];
  edges: BookGraphEdge[];
  omittedEdges: number;
};

/**
 * The book connection graph: every book-to-book reuse link, or only links
 * touching `library`'s books. Heaviest links first, capped for drawing.
 */
export const getBookGraph = async ({
  library,
  minPages = 1,
  limit = 300,
}: { library?: string; minPages?: number; limit?: number } = {}): Promise<BookGraphView> => {
  const summaries = await BookReuseSummary.find(
    {
      ...(library ? { lib: { $eq: library } } : {}),
      $or: [{ "upstream.0": { $exists: true } }, { "downstream.0": { $exists: true } }],
    },
    { _id: 0, bookID: 1, lib: 1, "totals.pages": 1, upstream: 1, downstream: 1 },
  ).lean<{
    bookID: string;
    lib: string;
    totals?: { pages?: number };
    upstream?: SummaryLink[];
    downstream?: SummaryLink[];
  }[]>();

  const graph = buildBookGraph(
    summaries.map((s) => ({
      bookID: s.bookID,
      lib: s.lib,
      pages: s.totals?.pages ?? 0,
      upstream: s.upstream ?? [],
      downstream: s.downstream ?? [],
    })),
    { minPages, limit },
  );

  // Reuse whose source book hasn't been scanned: one link per (source
  // library, target book), counted in distinct reusing pages.
  const room = Math.max(0, limit - graph.edges.length);
  const unscanned = room
    ? await PageReuseEdge.aggregate<{ _id: { lib: string; book: string }; pages: number; types: BookGraphEdge["types"] }>([
        {
          $match: {
            sourceBook: null,
            status: { $in: CURRENT_EDGE_STATUSES },
            targetBook: library
              ? { $regex: `^${library}-` }
              : { $ne: null },
          },
        },
        {
          $group: {
            _id: { lib: { $arrayElemAt: [{ $split: ["$source", "-"] }, 0] }, book: "$targetBook" },
            targets: { $addToSet: "$target" },
            types: { $addToSet: "$type" },
          },
        },
        { $project: { pages: { $size: "$targets" }, types: 1 } },
        { $match: { pages: { $gte: minPages } } },
        { $sort: { pages: -1 } },
        { $limit: room },
      ])
    : [];

  const libraryNodeID = (lib: string) => `library:${lib}`;
  const edges: BookGraphEdge[] = [
    ...graph.edges,
    ...unscanned.map((u) => ({
      source: libraryNodeID(u._id.lib),
      target: u._id.book,
      pages: u.pages,
      types: [...u.types].sort(),
    })),
  ];
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const bookPages = new Map(graph.nodes.map((n) => [n.id, n.pages]));
  // Sizes for books outside the queried library come from their own summaries.
  const extraBooks = [...degree.keys()].filter(
    (id) => !id.startsWith("library:") && (bookPages.get(id) ?? null) === null,
  );
  if (extraBooks.length > 0) {
    const sizes = await BookReuseSummary.find(
      { bookID: { $in: extraBooks } },
      { _id: 0, bookID: 1, "totals.pages": 1 },
    ).lean<{ bookID: string; totals?: { pages?: number } }[]>();
    for (const size of sizes) bookPages.set(size.bookID, size.totals?.pages ?? null);
  }

  const titles = await loadTitles([...degree.keys()].filter((id) => !id.startsWith("library:")));
  const nodes: BookGraphView["nodes"] = [...degree.entries()]
    .map(([id, d]) => {
      if (id.startsWith("library:")) {
        const lib = id.slice("library:".length);
        return {
          id,
          lib,
          title: `${lib} library (books not scanned yet)`,
          url: `https://${lib}.libretexts.org`,
          kind: "library" as const,
          pages: null,
          degree: d,
        };
      }
      return { ...toViewRef(id, titles), kind: "book" as const, pages: bookPages.get(id) ?? null, degree: d };
    })
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));

  return { nodes, edges, omittedEdges: graph.omittedEdges };
};
