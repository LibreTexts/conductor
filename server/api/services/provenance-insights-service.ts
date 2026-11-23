import BookReuseSummary, {
  type BookReuseAttention,
  type BookReuseSummaryInterface,
  type UnscannedSourceLink,
} from "../../models/bookreusesummary.js";
import ProvenanceScanState from "../../models/provenancescanstate.js";
import PageReuseEdge from "../../models/pagereuseedge.js";
import {
  buildBookGraph,
  toViewRef,
  type BookGraphEdge,
  type ViewRef,
} from "../../util/content-sources-view.js";
import { loadTitles } from "./content-sources-service.js";
import Book from "../../models/book.js";
import Project from "../../models/project.js";
import { buildLibraryMap, type LibraryMap, type MapTotals } from "../../util/library-map.js";
import { childLogger } from "../../logger.js";

const insightsLog = childLogger("provenance-insights");

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
  /** The changes job's reading of this library's change feed. */
  feed: {
    polledAt: Date | null;
    /** The last read skipped events (hit its page limit); safety nets were queued. */
    gapAt: Date | null;
    /** Books waiting to be re-read. */
    pendingBooks: number;
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
      { _id: 0, library: 1, phase: 1, lastRunAt: 1, lastCompletedAt: 1, lockedUntil: 1, stats: 1, eventsPolledAt: 1, eventsGapAt: 1, pendingRescanBooks: 1 },
    ).lean(),
    // Broken links per target library; the target book's prefix is its library.
    PageReuseEdge.aggregate<{ _id: string; n: number }>([
      // `status: "broken"` lets this use the partial broken-links index.
      { $match: { status: "broken", targetBook: { $type: "string" } } },
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
        feed: state
          ? {
              polledAt: state.eventsPolledAt ?? null,
              gapAt: state.eventsGapAt ?? null,
              pendingBooks: state.pendingRescanBooks?.length ?? 0,
            }
          : null,
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
 * touching the books of `libraries`. Heaviest links first, capped for drawing.
 */
export const getBookGraph = async ({
  libraries,
  minPages = 1,
  limit = 300,
}: { libraries?: string[]; minPages?: number; limit?: number } = {}): Promise<BookGraphView> => {
  const summaries = await BookReuseSummary.find(
    {
      ...(libraries?.length ? { lib: { $in: libraries } } : {}),
      $or: [
        { "upstream.0": { $exists: true } },
        { "downstream.0": { $exists: true } },
        { "unscannedSources.0": { $exists: true } },
      ],
    },
    { _id: 0, bookID: 1, lib: 1, "totals.pages": 1, upstream: 1, downstream: 1, unscannedSources: 1 },
  ).lean<{
    bookID: string;
    lib: string;
    totals?: { pages?: number };
    upstream?: SummaryLink[];
    downstream?: SummaryLink[];
    unscannedSources?: UnscannedSourceLink[];
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
  // library, target book), counted in distinct reusing pages. Read off the
  // summaries, which keep these counts, so no page-level edges are grouped.
  const room = Math.max(0, limit - graph.edges.length);
  const unscanned = summaries
    .flatMap((s) =>
      (s.unscannedSources ?? [])
        .filter((u) => u.pages >= minPages)
        .map((u) => ({ lib: u.lib, book: s.bookID, pages: u.pages, types: u.types })),
    )
    .sort((a, b) => b.pages - a.pages || a.book.localeCompare(b.book) || a.lib.localeCompare(b.lib))
    .slice(0, room);

  const libraryNodeID = (lib: string) => `library:${lib}`;
  const edges: BookGraphEdge[] = [
    ...graph.edges,
    ...unscanned.map((u) => ({
      source: libraryNodeID(u.lib),
      target: u.book,
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

/** How long a built library map is reused before it is read again. */
const MAP_CACHE_MS = 10 * 60 * 1000;
let mapCache: { at: number; map: LibraryMap } | null = null;

/**
 * The library map: every Commons book and every reuse link between books,
 * from all the content-reuse data (summaries, unscanned sources, attention,
 * linked projects, scan state). Nothing is capped; the staff view lays it out
 * and draws it. Cached for {@link MAP_CACHE_MS}, since it reads every summary.
 */
export const getLibraryMap = async ({ fresh = false }: { fresh?: boolean } = {}): Promise<LibraryMap> => {
  if (!fresh && mapCache && Date.now() - mapCache.at < MAP_CACHE_MS) return mapCache.map;

  const [books, summaries, projects, scanStates] = await Promise.all([
    Book.find({}, { _id: 0, bookID: 1, library: 1, title: 1 }).lean<
      { bookID: string; library: string; title?: string }[]
    >(),
    // Unscanned sources and attention come with each summary, so the map
    // never groups the page-level edges (which grow with every reused page).
    BookReuseSummary.find(
      {},
      {
        _id: 0,
        bookID: 1,
        lib: 1,
        computedAt: 1,
        totals: 1,
        upstream: 1,
        downstream: 1,
        unscannedSources: 1,
        attention: 1,
      },
    ).lean<{
      bookID: string;
      lib: string;
      computedAt?: Date;
      totals?: Partial<MapTotals>;
      upstream?: SummaryLink[];
      downstream?: SummaryLink[];
      unscannedSources?: UnscannedSourceLink[];
      attention?: BookReuseAttention;
    }[]>(),
    Project.find(
      { libreLibrary: { $nin: [null, ""] }, libreCoverID: { $nin: [null, ""] } },
      { _id: 0, projectID: 1, libreLibrary: 1, libreCoverID: 1 },
    ).lean<{ projectID: string; libreLibrary: string; libreCoverID: string }[]>(),
    ProvenanceScanState.find({}, { _id: 0, library: 1, phase: 1, lastCompletedAt: 1 }).lean<
      { library: string; phase?: string; lastCompletedAt?: Date }[]
    >(),
  ]);

  // Names for books linked to but missing from Commons (e.g. dev books).
  const commonsIDs = new Set(books.map((b) => b.bookID));
  const linked = new Set<string>();
  for (const s of summaries) {
    linked.add(s.bookID);
    for (const l of [...(s.upstream ?? []), ...(s.downstream ?? [])]) linked.add(l.bookID);
  }
  const titles = await loadTitles([...linked].filter((id) => !commonsIDs.has(id)));

  const map = buildLibraryMap({
    books,
    summaries: summaries.map((s) => ({
      bookID: s.bookID,
      lib: s.lib,
      pages: s.totals?.pages ?? 0,
      computedAt: s.computedAt ?? null,
      totals: s.totals ?? null,
      upstream: s.upstream ?? [],
      downstream: s.downstream ?? [],
    })),
    unscanned: summaries.flatMap((s) =>
      (s.unscannedSources ?? []).map((u) => ({ lib: u.lib, book: s.bookID, pages: u.pages, types: u.types })),
    ),
    attention: summaries
      .filter((s) => s.attention && (s.attention.sourceChanged > 0 || s.attention.broken > 0))
      .map((s) => ({ bookID: s.bookID, ...s.attention! })),
    projects: projects.map((p) => ({ bookID: `${p.libreLibrary}-${p.libreCoverID}`, projectID: p.projectID })),
    scanStates,
    titles,
  });
  mapCache = { at: Date.now(), map };
  return map;
};

/**
 * Rebuilds the cached library map, so the next staff visit doesn't pay for
 * the build. Run after the scan and changes jobs. The cache is per server
 * instance, so this warms the instance that ran the job. Never throws.
 */
export const warmLibraryMap = async (): Promise<void> => {
  try {
    const started = Date.now();
    const map = await getLibraryMap({ fresh: true });
    insightsLog.info(
      { books: map.nodes.length, links: map.edges.length, ms: Date.now() - started },
      "Library map rebuilt",
    );
  } catch (err) {
    insightsLog.warn({ err }, "Failed to rebuild the library map");
  }
};
