import { describe, expect, it } from "vitest";
import { computeLayout, layoutKey, nodeRadius, runLayout, ticksFor } from "./layout";

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

describe("ticksFor", () => {
  it("gives small graphs every step and large ones fewer, never below the floor", () => {
    expect(ticksFor(500)).toBe(260);
    expect(ticksFor(2000)).toBe(260);
    expect(ticksFor(4000)).toBe(130);
    expect(ticksFor(7000)).toBe(120);
  });
});

describe("layout progress and cache", () => {
  const libs = ["chem", "chem", "bio", "bio"];
  const radius = [3, 3, 3, 3];
  const edges: [number, number, number][] = [[0, 2, 4]];

  it("reports progress up to the end", () => {
    const seen: number[] = [];
    computeLayout({ libs, radius, edges, ticks: 40 }, (done) => seen.push(done));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((d, i) => d >= 0 && d < 1 && (i === 0 || d > seen[i - 1]))).toBe(true);
  });

  it("keys the same data the same way and different data differently", () => {
    expect(layoutKey({ libs, radius, edges })).toBe(layoutKey({ libs, radius, edges: [[0, 2, 4]] }));
    expect(layoutKey({ libs, radius, edges })).not.toBe(layoutKey({ libs, radius, edges: [[0, 2, 5]] }));
  });

  it("reuses a stored layout instead of computing again", async () => {
    window.localStorage.clear();
    const first = await runLayout({ libs, radius, edges }, () => undefined);
    let progressed = false;
    const second = await runLayout({ libs, radius, edges }, () => {
      progressed = true;
    });
    expect(progressed).toBe(false);
    // Stored to a tenth of a unit; float32 adds its own rounding on top.
    second.x.forEach((v, i) => expect(v).toBeCloseTo(first.x[i], 1));
  });
});
