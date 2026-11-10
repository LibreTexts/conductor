import type { ReuseRef } from "./transclusion.js";

/**
 * Pure graph rules for the page provenance graph. No database access: callers
 * pass fetchers, so the same rules run against Mongo in production and against
 * in-memory edges in tests.
 *
 * Edges point from a reusing page (target) to the page it reuses (source).
 * Only direct edges are stored. Chains such as A → B → C (C reuses B, which
 * reuses A) are derived by walking them.
 */

export const REUSE_EDGE_TYPES = [
  /** Whole-page transclusion stub, same library (`wiki.page` / reuse widget). */
  "transclude-same",
  /** Whole-page transclusion stub, other library (`CrossTransclude/Web`). */
  "transclude-cross",
  /** Reuse block embedded in a page that also has its own content. */
  "section",
  /** One-time copy of the source's HTML (Remixer Copy-Fork). */
  "fork",
  /** One-time copy including attachments (Remixer Copy-Full). */
  "full",
] as const;
export type ReuseEdgeType = (typeof REUSE_EDGE_TYPES)[number];

/** Live edges render the source's current content, so source changes propagate. */
export const LIVE_EDGE_TYPES: readonly ReuseEdgeType[] = [
  "transclude-same",
  "transclude-cross",
  "section",
];

/** Edges where the target's whole content comes from the source. */
export const WHOLE_PAGE_EDGE_TYPES: readonly ReuseEdgeType[] = [
  "transclude-same",
  "transclude-cross",
  "fork",
  "full",
];

export const isLiveEdgeType = (type: ReuseEdgeType): boolean =>
  LIVE_EDGE_TYPES.includes(type);

/** Same guard as Remixer's `resolveTranscludeSource`. */
export const MAX_CHAIN_DEPTH = 20;

/** `${lib}-${pageID}`, the `_id` of a PageNode. */
export const pageNodeId = (lib: string, pageID: number | string): string =>
  `${lib}-${pageID}`;

/** `${target}<${source}`, the `_id` of a PageReuseEdge. */
export const reuseEdgeId = (target: string, source: string): string =>
  `${target}<${source}`;

/**
 * The stored edge type for a reuse ref found in a target page. A ref in a pure
 * pointer page is a whole-page transclusion; a ref inside an authored page is
 * an embedded section, whatever form its markup takes.
 */
export const edgeTypeForRef = (
  ref: ReuseRef,
  { targetLib, targetIsStub }: { targetLib: string; targetIsStub: boolean },
): ReuseEdgeType => {
  if (!targetIsStub || (ref.kind === "same-library" && ref.section)) {
    return "section";
  }
  return ref.kind === "cross-library" && ref.subdomain !== targetLib
    ? "transclude-cross"
    : "transclude-same";
};

/** The fields of an edge the graph walks need. */
export type GraphEdge = {
  _id: string;
  source: string;
  target: string;
  type: ReuseEdgeType;
  targetBook?: string | null;
};

export type DownstreamHit = {
  target: string;
  targetBook: string | null;
  /** The edge that reached `target`. */
  edge: string;
  /** Edges between the changed source and `target` (1 = direct reuse). */
  hops: number;
  /** Intermediate pages, nearest the source first. Empty for direct reuse. */
  via: string[];
  /**
   * Reached through a fork/full copy. The copy is now out of date, but its
   * content did not change, so nothing beyond it is affected.
   */
  frozen: boolean;
};

export type DownstreamWalk = {
  hits: DownstreamHit[];
  /** The walk reached the source again, e.g. A → B → A. */
  cycle: boolean;
  /** Stopped at {@link MAX_CHAIN_DEPTH} with pages still left to visit. */
  truncated: boolean;
};

/**
 * Every page affected when `sourceId` changes.
 *
 * Breadth-first, one fetch per level (so at most {@link MAX_CHAIN_DEPTH}
 * round trips however wide the fan-out). Live edges are followed onward. A
 * frozen edge (fork/full) is reported as the last hop and not followed:
 * the copy drifts out of date, but pages reusing the copy see no change.
 *
 * @param fetchOutgoing - edges whose `source` is any of the given ids, active
 *   ones only.
 */
export const walkDownstream = async (
  sourceId: string,
  fetchOutgoing: (sourceIds: string[]) => Promise<GraphEdge[]>,
  maxDepth: number = MAX_CHAIN_DEPTH,
): Promise<DownstreamWalk> => {
  const hitsByTarget = new Map<string, DownstreamHit>();
  const visited = new Set<string>([sourceId]);
  let cycle = false;
  let frontier = [sourceId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    depth += 1;
    const edges = await fetchOutgoing(frontier);
    // Live edges first, so a page reachable both ways is expanded.
    edges.sort(
      (a, b) => Number(isLiveEdgeType(b.type)) - Number(isLiveEdgeType(a.type)),
    );

    const next: string[] = [];
    for (const edge of edges) {
      if (edge.target === sourceId) {
        cycle = true;
        continue;
      }
      const live = isLiveEdgeType(edge.type);
      const parentHit = hitsByTarget.get(edge.source);
      const via = parentHit ? [...parentHit.via, edge.source] : [];
      const existing = hitsByTarget.get(edge.target);

      if (existing) {
        // Reached a page already reported only through a copy: a live path
        // means its content does change, so upgrade it and keep walking.
        if (existing.frozen && live) {
          existing.frozen = false;
          next.push(edge.target);
        }
        continue;
      }
      if (visited.has(edge.target)) continue;

      visited.add(edge.target);
      hitsByTarget.set(edge.target, {
        target: edge.target,
        targetBook: edge.targetBook ?? null,
        edge: edge._id,
        hops: depth,
        via,
        frozen: !live,
      });
      if (live) next.push(edge.target);
    }
    frontier = next;
  }

  return {
    hits: [...hitsByTarget.values()],
    cycle,
    truncated: frontier.length > 0,
  };
};

export type ChainRoot = {
  /** Ultimate origin of the page's content, or null when it owns its content. */
  root: string | null;
  /** 0 = own content, 1 = direct reuse, 2 = A → B → C, ... */
  depth: number;
  /** The chain loops back on itself. `root` is then null. */
  cycle: boolean;
  /** A page on the chain has more than one whole-page source; the walk stopped there. */
  ambiguous: boolean;
  /** Stopped at {@link MAX_CHAIN_DEPTH}. */
  truncated: boolean;
};

/**
 * Follows a page's whole-page sources up to the page that owns the content.
 *
 * Every whole-page edge (transclusion or copy) is followed, because a copy's
 * content still originates upstream: a fork of A is credited to A. Embedded
 * sections are not followed, because a page with its own text is its own
 * origin. Unlike {@link walkDownstream}, this does not decide what a change
 * reaches; it decides who gets the credit.
 *
 * @param fetchIncoming - active edges whose `target` is the given id.
 */
export const resolveChainRoot = async (
  pageId: string,
  fetchIncoming: (targetId: string) => Promise<GraphEdge[]>,
  maxDepth: number = MAX_CHAIN_DEPTH,
): Promise<ChainRoot> => {
  const seen = new Set<string>([pageId]);
  let current = pageId;
  let depth = 0;
  let ambiguous = false;

  for (;;) {
    if (depth >= maxDepth) {
      return { root: current, depth, cycle: false, ambiguous, truncated: true };
    }
    const whole = (await fetchIncoming(current)).filter((e) =>
      WHOLE_PAGE_EDGE_TYPES.includes(e.type),
    );
    if (whole.length !== 1) {
      ambiguous = whole.length > 1;
      break;
    }
    const next = whole[0].source;
    if (seen.has(next)) {
      return { root: null, depth, cycle: true, ambiguous, truncated: false };
    }
    seen.add(next);
    current = next;
    depth += 1;
  }

  return {
    root: depth === 0 ? null : current,
    depth,
    cycle: false,
    ambiguous,
    truncated: false,
  };
};
