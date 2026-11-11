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
