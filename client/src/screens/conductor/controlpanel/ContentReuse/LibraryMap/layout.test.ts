import { describe, expect, it } from "vitest";
import { computeLayout, nodeRadius } from "./layout";

const dist = (out: { x: Float32Array; y: Float32Array }, a: number, b: number) =>
  Math.hypot(out.x[a] - out.x[b], out.y[a] - out.y[b]);

describe("computeLayout", () => {
  // Two libraries of unlinked books, plus one cross-library link (4 → 12).
  const libs = [...Array(10).fill("chem"), ...Array(10).fill("bio")];
  const radius = libs.map(() => 2.2);
  const input = { libs, radius, edges: [[4, 12, 5]] as [number, number, number][], ticks: 120 };

  it("is deterministic: the same data gives the same map", () => {
    const a = computeLayout(input);
    const b = computeLayout(input);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.y)).toEqual(Array.from(b.y));
  });

  it("groups books that share nothing into their library's island", () => {
    const out = computeLayout(input);
    // Two unlinked chemistry books are nearer each other than a chemistry and a biology book.
    expect(dist(out, 0, 1)).toBeLessThan(dist(out, 0, 15));
    expect(out.anchors.map((a) => a.lib).sort()).toEqual(["bio", "chem"]);
  });

  it("pulls books that share content toward each other", () => {
    const out = computeLayout(input);
    const unlinkedPair = dist(out, 3, 13);
    expect(dist(out, 4, 12)).toBeLessThan(unlinkedPair);
  });
});

describe("computeLayout with linked books", () => {
  // Unlinked books fill islands; three linked books (2 → 25, 2 → 40) bridge them.
  const libs = [...Array(20).fill("chem"), ...Array(20).fill("bio"), ...Array(5).fill("math")];
  const radius = libs.map((_, i) => (i === 2 ? 8 : 2.2));
  const out = computeLayout({ libs, radius, edges: [[2, 25, 6], [2, 40, 3]] });

  it("places each linked book itself, outside every island", () => {
    for (const i of [2, 25, 40]) {
      for (const a of out.anchors) {
        expect(Math.hypot(out.x[i] - a.x, out.y[i] - a.y)).toBeGreaterThanOrEqual(a.r + radius[i]);
      }
    }
  });

  it("leaves books that share nothing inside their own island", () => {
    const chem = out.anchors.find((a) => a.lib === "chem")!;
    for (const i of [0, 1, 3, 19]) {
      expect(Math.hypot(out.x[i] - chem.x, out.y[i] - chem.y)).toBeLessThanOrEqual(chem.r);
    }
  });
});

describe("nodeRadius", () => {
  it("grows with how much other books reuse a book", () => {
    expect(nodeRadius(0, "book")).toBeLessThan(nodeRadius(4, "book"));
    expect(nodeRadius(4, "book")).toBeLessThan(nodeRadius(100, "book"));
    expect(nodeRadius(10_000, "book")).toBe(22);
  });
});
