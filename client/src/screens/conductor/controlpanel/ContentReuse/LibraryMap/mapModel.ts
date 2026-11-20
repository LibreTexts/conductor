import type { LibraryMap, ReuseEdgeType } from "../../../../../types/ContentSources";
import { libraryLabel } from "../../../../../components/projects/ContentSources/treeDraw";

/**
 * What the library map draws, derived from the map data and its communities:
 * colours, neighbours for hovering, the legend's names. Pure.
 */

/**
 * The eight community colours: the dataviz reference palette's categorical
 * slots in their validated order. Communities past the eighth, and books that
 * share nothing, are grey; colour is never the only cue (communities are
 * also named, in the legend and on hover).
 */
export const COMMUNITY_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948",
];
export const OTHER_COLOR = "#a8a7a2";
/** A book the scanner hasn't read: present on the map, but nothing known about it. */
export const UNSCANNED_COLOR = "#dcdbd6";

const LIVE_TYPES: ReuseEdgeType[] = ["transclude-same", "transclude-cross", "section"];

/** Bitmask of the live reuse types (Copy-Transclude and embedded sections). */
export const liveMask = (edgeTypes: ReuseEdgeType[]) =>
  edgeTypes.reduce((mask, type, bit) => (LIVE_TYPES.includes(type) ? mask | (1 << bit) : mask), 0);

/** The reuse types an edge's bitmask names. */
export const typesOf = (mask: number, edgeTypes: ReuseEdgeType[]) =>
  edgeTypes.filter((_, bit) => mask & (1 << bit));

export type CommunityInfo = {
  id: number;
  color: string;
  /** "Chemistry · General Chemistry": its most common library and most reused book. */
  name: string;
  books: number;
};

export type MapModel = {
  color: string[];
  /** Neighbours of each node (either direction), for highlighting. */
  neighbours: number[][];
  /** Incoming and outgoing edges of each node, by edge index. */
  incoming: number[][];
  outgoing: number[][];
  communities: CommunityInfo[];
  /** Nodes with at least one link. */
  linked: Uint8Array;
  live: number;
};

export const buildMapModel = (map: LibraryMap, community: Int32Array): MapModel => {
  const n = map.nodes.length;
  const neighbours: number[][] = Array.from({ length: n }, () => []);
  const incoming: number[][] = Array.from({ length: n }, () => []);
  const outgoing: number[][] = Array.from({ length: n }, () => []);
  const linked = new Uint8Array(n);
  map.edges.forEach(([s, t], i) => {
    neighbours[s].push(t);
    neighbours[t].push(s);
    outgoing[s].push(i);
    incoming[t].push(i);
    linked[s] = 1;
    linked[t] = 1;
  });

  // Name each coloured community by its most common library and most reused book.
  const members = new Map<number, number[]>();
  community.forEach((c, i) => {
    if (c < 0 || c >= COMMUNITY_COLORS.length) return;
    members.set(c, [...(members.get(c) ?? []), i]);
  });
  const communities: CommunityInfo[] = [...members.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, nodes]) => {
      const libCounts = new Map<string, number>();
      for (const i of nodes) libCounts.set(map.nodes[i].lib, (libCounts.get(map.nodes[i].lib) ?? 0) + 1);
      const topLib = [...libCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      const topBook = nodes.reduce((best, i) => (map.nodes[i].reusedBy > map.nodes[best].reusedBy ? i : best), nodes[0]);
      return {
        id,
        color: COMMUNITY_COLORS[id],
        name: `${libraryLabel(topLib)} · ${map.nodes[topBook].title}`,
        books: nodes.filter((i) => map.nodes[i].kind === "book").length,
      };
    });

  const color = map.nodes.map((node, i) => {
    const c = community[i];
    if (c >= 0 && c < COMMUNITY_COLORS.length) return COMMUNITY_COLORS[c];
    return node.scanned || node.kind === "library" ? OTHER_COLOR : UNSCANNED_COLOR;
  });

  return { color, neighbours, incoming, outgoing, communities, linked, live: liveMask(map.edgeTypes) };
};
