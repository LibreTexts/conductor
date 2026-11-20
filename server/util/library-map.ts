import { buildBookGraph, type SummaryLinks } from "./content-sources-view.js";
import { REUSE_EDGE_TYPES, type ReuseEdgeType } from "./provenance-graph.js";

/**
 * The library map: every book LibreTexts knows of and every reuse link
 * between them, from all the content-reuse data, in compact arrays for the
 * staff map view to lay out and draw. Pure; the insights service does the
 * reads.
 */

export type MapTotals = {
  pages: number;
  original: number;
  transclude: number;
  fork: number;
  full: number;
  mixed: number;
  structural: number;
  unknown: number;
  viaChain: number;
};

export type LibraryMapNode = {
  /** A bookID, or `library:{lib}` for a library's books not scanned yet. */
  id: string;
  kind: "book" | "library";
  lib: string;
  title: string;
  /** Has a reuse summary (the scanner has read it). */
  scanned: boolean;
  computedAt: string | null;
  totals: MapTotals | null;
  /** Pages of other books that reuse this one. */
  reusedBy: number;
  /** This book's pages that reuse another book, summed over its sources. */
  reuses: number;
  /** Its pages whose source changed (unreviewed) or broke. */
  attention: { sourceChanged: number; broken: number };
  /** The Conductor project linked to the book, if any. */
  projectID: string | null;
};

/**
 * `[source, target, pages, types]`: `target` reuses `pages` pages from
 * `source`; indexes into `nodes`; `types` is a bitmask over `edgeTypes`.
 */
export type LibraryMapEdge = [number, number, number, number];

export type LibraryMapLibrary = {
  lib: string;
  /** Commons books in the library, and of those, how many are scanned. */
  books: number;
  scanned: number;
  phase: string | null;
  lastCompletedAt: string | null;
};

export type LibraryMap = {
  nodes: LibraryMapNode[];
  edges: LibraryMapEdge[];
  /** Bit `i` of an edge's `types` is `edgeTypes[i]`. */
  edgeTypes: readonly ReuseEdgeType[];
  libraries: LibraryMapLibrary[];
  generatedAt: string;
};

export type LibraryMapInput = {
  /** Every Commons book. */
  books: { bookID: string; library: string; title?: string | null }[];
  summaries: (SummaryLinks & { computedAt?: Date | null; totals?: Partial<MapTotals> | null })[];
  /** Reuse from books not scanned yet, per (source library, target book). */
  unscanned: { lib: string; book: string; pages: number; types: ReuseEdgeType[] }[];
  attention: { bookID: string; sourceChanged: number; broken: number }[];
  projects: { bookID: string; projectID: string }[];
  scanStates: { library: string; phase?: string | null; lastCompletedAt?: Date | null }[];
  /** Titles for books with no Commons record (from page nodes). */
  titles: Map<string, string>;
  now?: Date;
};

const TOTAL_KEYS: (keyof MapTotals)[] = [
  "pages", "original", "transclude", "fork", "full", "mixed", "structural", "unknown", "viaChain",
];

const typesMask = (types: ReuseEdgeType[]) =>
  types.reduce((mask, type) => {
    const bit = REUSE_EDGE_TYPES.indexOf(type);
    return bit >= 0 ? mask | (1 << bit) : mask;
  }, 0);

const libOf = (bookID: string) => bookID.slice(0, Math.max(0, bookID.lastIndexOf("-")));

export const libraryNodeId = (lib: string) => `library:${lib}`;

/** Assembles the map. Every link is kept: nothing is capped or sampled. */
export const buildLibraryMap = (input: LibraryMapInput): LibraryMap => {
  const nodes: LibraryMapNode[] = [];
  const index = new Map<string, number>();
  const commons = new Map(input.books.map((b) => [b.bookID, b]));
  const summaries = new Map(input.summaries.map((s) => [s.bookID, s]));
  const attention = new Map(input.attention.map((a) => [a.bookID, a]));
  const projects = new Map(input.projects.map((p) => [p.bookID, p.projectID]));

  const nodeFor = (id: string): number => {
    const existing = index.get(id);
    if (existing !== undefined) return existing;
    const isLibrary = id.startsWith("library:");
    const lib = isLibrary ? id.slice("library:".length) : commons.get(id)?.library ?? libOf(id);
    const summary = isLibrary ? undefined : summaries.get(id);
    const totals = summary?.totals
      ? (Object.fromEntries(TOTAL_KEYS.map((k) => [k, summary.totals?.[k] ?? 0])) as MapTotals)
      : null;
    nodes.push({
      id,
      kind: isLibrary ? "library" : "book",
      lib,
      title: isLibrary
        ? `${lib} library (books not scanned yet)`
        : commons.get(id)?.title || input.titles.get(id) || id,
      scanned: Boolean(summary),
      computedAt: summary?.computedAt ? summary.computedAt.toISOString() : null,
      totals,
      reusedBy: 0,
      reuses: 0,
      attention: {
        sourceChanged: attention.get(id)?.sourceChanged ?? 0,
        broken: attention.get(id)?.broken ?? 0,
      },
      projectID: isLibrary ? null : projects.get(id) ?? null,
    });
    index.set(id, nodes.length - 1);
    return nodes.length - 1;
  };

  // Every book first, in a stable order, so indexes don't shuffle between loads.
  const bookIDs = [...new Set([...input.books.map((b) => b.bookID), ...input.summaries.map((s) => s.bookID)])].sort();
  for (const id of bookIDs) nodeFor(id);

  const edges: LibraryMapEdge[] = [];
  const addEdge = (source: string, target: string, pages: number, types: ReuseEdgeType[]) => {
    const s = nodeFor(source);
    const t = nodeFor(target);
    edges.push([s, t, pages, typesMask(types)]);
    nodes[s].reusedBy += pages;
    nodes[t].reuses += pages;
  };

  // Book to book: each link appears on both books' summaries; merged once.
  const graph = buildBookGraph(input.summaries, { minPages: 1, limit: Number.MAX_SAFE_INTEGER });
  for (const edge of graph.edges) addEdge(edge.source, edge.target, edge.pages, edge.types);
  for (const u of input.unscanned) addEdge(libraryNodeId(u.lib), u.book, u.pages, u.types);

  const states = new Map(input.scanStates.map((s) => [s.library, s]));
  const byLib = new Map<string, { books: number; scanned: number }>();
  for (const node of nodes) {
    if (node.kind !== "book") continue;
    const acc = byLib.get(node.lib) ?? { books: 0, scanned: 0 };
    acc.books += 1;
    if (node.scanned) acc.scanned += 1;
    byLib.set(node.lib, acc);
  }
  const libraries = [...byLib.entries()]
    .map(([lib, acc]) => ({
      lib,
      ...acc,
      phase: states.get(lib)?.phase ?? null,
      lastCompletedAt: states.get(lib)?.lastCompletedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.books - a.books || a.lib.localeCompare(b.lib));

  return {
    nodes,
    edges,
    edgeTypes: REUSE_EDGE_TYPES,
    libraries,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
};
