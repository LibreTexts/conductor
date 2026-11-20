/**
 * Communities of books that share content: weighted, undirected Louvain
 * (Blondel et al. 2008), the method behind the "neighbourhoods" of maps like
 * the Wikipedia link map. Deterministic: nodes are visited in index order, so
 * the same graph always gives the same communities. Pure.
 */

/** `[a, b, weight]`; direction is ignored, repeated pairs add up. */
export type WeightedEdge = [number, number, number];

type Adjacency = Map<number, number>[];

const buildAdjacency = (n: number, edges: WeightedEdge[]): Adjacency => {
  const adj: Adjacency = Array.from({ length: n }, () => new Map());
  for (const [a, b, w] of edges) {
    if (a === b || w <= 0) continue;
    adj[a].set(b, (adj[a].get(b) ?? 0) + w);
    adj[b].set(a, (adj[b].get(a) ?? 0) + w);
  }
  return adj;
};

/**
 * One Louvain level: move each node to the neighbouring community that
 * raises modularity most, until nothing moves. Self-loops (`adj[i].get(i)`)
 * hold a merged community's internal weight, counted both ways.
 */
const oneLevel = (adj: Adjacency): { community: number[]; moved: boolean } => {
  const n = adj.length;
  const k = adj.map((row) => [...row.values()].reduce((sum, w) => sum + w, 0));
  const m2 = k.reduce((sum, d) => sum + d, 0);
  const community = Array.from({ length: n }, (_, i) => i);
  if (m2 === 0) return { community, moved: false };
  const tot = [...k];

  let moved = false;
  for (let pass = 0, improved = true; improved && pass < 100; pass += 1) {
    improved = false;
    for (let i = 0; i < n; i += 1) {
      if (k[i] === 0) continue;
      const own = community[i];
      const toCommunity = new Map<number, number>();
      for (const [j, w] of adj[i]) {
        if (j === i) continue;
        toCommunity.set(community[j], (toCommunity.get(community[j]) ?? 0) + w);
      }
      tot[own] -= k[i];
      let best = own;
      let bestGain = (toCommunity.get(own) ?? 0) - (tot[own] * k[i]) / m2;
      for (const [c, w] of toCommunity) {
        const gain = w - (tot[c] * k[i]) / m2;
        if (gain > bestGain + 1e-12) {
          best = c;
          bestGain = gain;
        }
      }
      tot[best] += k[i];
      if (best !== own) {
        community[i] = best;
        improved = true;
        moved = true;
      }
    }
  }
  return { community, moved };
};

/** Renumbers labels 0..c-1 in first-seen order. */
const compact = (labels: number[]): { labels: number[]; count: number } => {
  const map = new Map<number, number>();
  const out = labels.map((l) => {
    if (!map.has(l)) map.set(l, map.size);
    return map.get(l)!;
  });
  return { labels: out, count: map.size };
};

/** The graph of communities: one node each, edges summed (internal ones as self-loops). */
const aggregate = (adj: Adjacency, labels: number[], count: number): Adjacency => {
  const next: Adjacency = Array.from({ length: count }, () => new Map());
  adj.forEach((row, i) => {
    for (const [j, w] of row) {
      const a = labels[i];
      const b = labels[j];
      next[a].set(b, (next[a].get(b) ?? 0) + w);
    }
  });
  return next;
};

/**
 * The community of each of `n` nodes: 0 is the largest, then by size; -1 for
 * a node with no links (it shares nothing, so it belongs to no neighbourhood).
 */
export const detectCommunities = (n: number, edges: WeightedEdge[]): Int32Array => {
  let adj = buildAdjacency(n, edges);
  const linked = adj.map((row) => row.size > 0);
  let membership = Array.from({ length: n }, (_, i) => i);

  for (let level = 0; level < 20; level += 1) {
    const { community, moved } = oneLevel(adj);
    const { labels, count } = compact(community);
    membership = membership.map((c) => labels[c]);
    if (!moved || count === adj.length) break;
    adj = aggregate(adj, labels, count);
  }

  // Largest community first; ties by the earliest node, so labels are stable.
  const size = new Map<number, { count: number; first: number }>();
  membership.forEach((c, i) => {
    if (!linked[i]) return;
    const s = size.get(c) ?? { count: 0, first: i };
    s.count += 1;
    size.set(c, s);
  });
  const order = [...size.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  const rank = new Map(order.map(([c], r) => [c, r]));
  const out = new Int32Array(n);
  membership.forEach((c, i) => {
    out[i] = linked[i] ? rank.get(c)! : -1;
  });
  return out;
};
