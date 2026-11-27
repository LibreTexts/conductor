import { describe, expect, it } from "vitest";
import { detectCommunities, type WeightedEdge } from "./communities";

/** Every pair within `nodes` linked with `weight`. */
const clique = (nodes: number[], weight = 1): WeightedEdge[] =>
  nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => [a, b, weight] as WeightedEdge));

describe("detectCommunities", () => {
  it("splits two dense groups joined by one weak link", () => {
    const edges = [...clique([0, 1, 2, 3], 5), ...clique([4, 5, 6, 7], 5), [3, 4, 1] as WeightedEdge];
    const c = Array.from(detectCommunities(8, edges));
    expect(new Set(c.slice(0, 4)).size).toBe(1);
    expect(new Set(c.slice(4, 8)).size).toBe(1);
    expect(c[0]).not.toBe(c[4]);
  });

  it("numbers communities by size, largest first", () => {
    const edges = [...clique([0, 1, 2]), ...clique([3, 4, 5, 6, 7])];
    const c = Array.from(detectCommunities(8, edges));
    expect(c.slice(3)).toEqual([0, 0, 0, 0, 0]);
    expect(c.slice(0, 3)).toEqual([1, 1, 1]);
  });

  it("gives books that share nothing no community", () => {
    const c = Array.from(detectCommunities(4, [[0, 1, 2]]));
    expect(c).toEqual([0, 0, -1, -1]);
  });

  it("adds up repeated links and ignores direction", () => {
    const edges: WeightedEdge[] = [[0, 1, 1], [1, 0, 1], [2, 3, 1]];
    const c = Array.from(detectCommunities(4, edges));
    expect(c[0]).toBe(c[1]);
    expect(c[2]).toBe(c[3]);
    expect(c[0]).not.toBe(c[2]);
  });

  it("always gives the same answer for the same graph", () => {
    const edges = [...clique([0, 1, 2, 3], 2), ...clique([3, 4, 5]), [5, 6, 1] as WeightedEdge, ...clique([6, 7, 8, 9])];
    expect(Array.from(detectCommunities(10, edges))).toEqual(Array.from(detectCommunities(10, edges)));
  });
});
