import { parsePageNodeId, type ReuseEdgeType } from "./provenance-graph.js";

/**
 * Pure shaping for the project Content Sources view: titles, links and the
 * groupings the API returns. No I/O; the service does the queries.
 */

/** A page or book named in the view. */
export type ViewRef = {
  /** `${lib}-${pageID}` for a page, the bookID for a book. */
  id: string;
  lib: string | null;
  title: string;
  url: string | null;
};

/**
 * Names and links a page or book. A bookID has the same shape as its cover
 * page's nodeID, so both resolve through the same title map.
 */
export const toViewRef = (id: string, titles: Map<string, string>): ViewRef => {
  const parts = parsePageNodeId(id);
  return {
    id,
    lib: parts?.lib ?? null,
    title: titles.get(id) ?? id,
    // `@go/page` resolves by id, so the link survives renames and moves.
    url: parts ? `https://${parts.lib}.libretexts.org/@go/page/${parts.pageID}` : null,
  };
};

/** An edge into the book whose source belongs to no scanned book yet. */
export type UnscannedSourceEdge = {
  source: string;
  target: string;
  type: ReuseEdgeType;
};

/** Reuse from books the scanner hasn't reached, grouped by library. */
export type UnscannedSourceGroup = {
  lib: string;
  /** Distinct pages of this book reusing them. */
  pages: number;
  /** Distinct source pages. */
  sources: number;
  types: ReuseEdgeType[];
  /** A few of the source pages, for display. */
  examples: string[];
};

const UNSCANNED_EXAMPLES = 5;

/**
 * Groups edges whose source has no known book by the source's library, so the
 * view can say "reuses 8 pages from books not yet scanned" instead of nothing.
 * Most-used libraries first.
 */
export const groupUnscannedSources = (edges: UnscannedSourceEdge[]): UnscannedSourceGroup[] => {
  type Acc = { targets: Set<string>; sources: Set<string>; types: Set<ReuseEdgeType> };
  const byLib = new Map<string, Acc>();
  for (const edge of edges) {
    const lib = parsePageNodeId(edge.source)?.lib;
    if (!lib) continue;
    let acc = byLib.get(lib);
    if (!acc) {
      acc = { targets: new Set(), sources: new Set(), types: new Set() };
      byLib.set(lib, acc);
    }
    acc.targets.add(edge.target);
    acc.sources.add(edge.source);
    acc.types.add(edge.type);
  }
  return [...byLib.entries()]
    .map(([lib, acc]) => ({
      lib,
      pages: acc.targets.size,
      sources: acc.sources.size,
      types: [...acc.types].sort(),
      examples: [...acc.sources].sort().slice(0, UNSCANNED_EXAMPLES),
    }))
    .sort((a, b) => b.pages - a.pages || a.lib.localeCompare(b.lib));
};

/** Every id a response names, for one batched title lookup. */
export const collectIds = (...lists: (string | null | undefined)[][]): string[] => {
  const ids = new Set<string>();
  for (const list of lists) for (const id of list) if (id) ids.add(id);
  return [...ids];
};

/** A book's links as stored on its summary. */
export type SummaryLinks = {
  bookID: string;
  lib: string;
  pages: number;
  upstream: { bookID: string; pages: number; types: ReuseEdgeType[] }[];
  downstream: { bookID: string; pages: number; types: ReuseEdgeType[] }[];
};

/** One book-to-book reuse link: `target` reuses `pages` pages from `source`. */
export type BookGraphEdge = {
  source: string;
  target: string;
  pages: number;
  types: ReuseEdgeType[];
};

export type BookGraphNode = {
  id: string;
  lib: string | null;
  /** The book's page count, when its summary is known. */
  pages: number | null;
  /** Links to and from this book within the returned graph. */
  degree: number;
};

export type BookGraph = {
  nodes: BookGraphNode[];
  edges: BookGraphEdge[];
  /** Links left out by `minPages` or `limit`. */
  omittedEdges: number;
};

/**
 * The book connection graph from book summaries. Each summary lists both
 * directions, so a link between two summarized books is seen twice; it is
 * merged by (source, target) keeping the larger page count. Heaviest links
 * first, capped at `limit`, so a library-wide view stays drawable.
 */
export const buildBookGraph = (
  summaries: SummaryLinks[],
  { minPages = 1, limit = 300 }: { minPages?: number; limit?: number } = {},
): BookGraph => {
  const edges = new Map<string, BookGraphEdge>();
  const add = (source: string, target: string, pages: number, types: ReuseEdgeType[]) => {
    if (source === target) return;
    const key = `${source}>${target}`;
    const existing = edges.get(key);
    if (!existing) {
      edges.set(key, { source, target, pages, types: [...new Set(types)].sort() });
      return;
    }
    existing.pages = Math.max(existing.pages, pages);
    existing.types = [...new Set([...existing.types, ...types])].sort();
  };
  for (const summary of summaries) {
    for (const link of summary.upstream) add(link.bookID, summary.bookID, link.pages, link.types);
    for (const link of summary.downstream) add(summary.bookID, link.bookID, link.pages, link.types);
  }

  const all = [...edges.values()].sort(
    (a, b) => b.pages - a.pages || a.source.localeCompare(b.source) || a.target.localeCompare(b.target),
  );
  const kept = all.filter((e) => e.pages >= minPages).slice(0, limit);

  const pagesByBook = new Map(summaries.map((s) => [s.bookID, s.pages]));
  const degree = new Map<string, number>();
  for (const edge of kept) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const nodes = [...degree.entries()]
    .map(([id, d]) => ({
      id,
      lib: parsePageNodeId(id)?.lib ?? null,
      pages: pagesByBook.get(id) ?? null,
      degree: d,
    }))
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));

  return { nodes, edges: kept, omittedEdges: all.length - kept.length };
};

/** A page's place in its book: reading order and nesting depth (cover = 0). */
export type TreePlace = { order: number; depth: number };

type TreeNode = { nodeID: string; pageID: number; parentID?: number | null; path?: string | null; title?: string | null };

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/**
 * Orders a book's pages as its table of contents reads: depth-first from the
 * cover, siblings by path (numbering prefixes like `1.03:` sort naturally).
 * Pages whose parent isn't in the book (moved, or not scanned yet) follow at
 * depth 1, so every page gets a place.
 */
export const orderBookTree = (nodes: TreeNode[], coverPageID: number): Map<string, TreePlace> => {
  const byPageID = new Map(nodes.map((n) => [n.pageID, n]));
  const children = new Map<number, TreeNode[]>();
  for (const node of nodes) {
    if (node.pageID === coverPageID) continue;
    const parent = node.parentID ?? null;
    const key = parent !== null && byPageID.has(parent) ? parent : -1;
    const list = children.get(key) ?? [];
    list.push(node);
    children.set(key, list);
  }
  const sortKey = (n: TreeNode) => n.path ?? n.title ?? String(n.pageID);
  for (const list of children.values()) list.sort((a, b) => collator.compare(sortKey(a), sortKey(b)));

  const places = new Map<string, TreePlace>();
  const visit = (node: TreeNode, depth: number) => {
    if (places.has(node.nodeID)) return; // Guards a parent loop.
    places.set(node.nodeID, { order: places.size, depth });
    for (const child of children.get(node.pageID) ?? []) visit(child, depth + 1);
  };
  const cover = byPageID.get(coverPageID);
  if (cover) visit(cover, 0);
  for (const orphan of children.get(-1) ?? []) visit(orphan, 1);
  // Anything left sits in a parent loop with no way in from the cover.
  for (const node of nodes) if (!places.has(node.nodeID)) visit(node, 1);
  return places;
};
