import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  edgeTypeForRef,
  pageNodeId,
  parsePageNodeId,
  resolveChainRoot,
  summarizeAffectedBooks,
  walkDownstream,
  type GraphEdge,
  type ReuseEdgeType,
} from "./provenance-graph.js";

/** Builds edges from `[target, source, type]` triples; book = first letter. */
const graph = (triples: [string, string, ReuseEdgeType][]): GraphEdge[] =>
  triples.map(([target, source, type]) => ({
    target,
    source,
    type,
    targetBook: `book-${target[0]}`,
  }));

const outgoing = (edges: GraphEdge[]) => async (ids: string[]) =>
  edges.filter((e) => ids.includes(e.source));

const incoming = (edges: GraphEdge[]) => async (id: string) =>
  edges.filter((e) => e.target === id);

describe("walkDownstream", () => {
  it("reaches every page of a live chain A → B → C", async () => {
    const edges = graph([
      ["B", "A", "transclude-same"],
      ["C", "B", "transclude-cross"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges));
    assert.equal(walk.cycle, false);
    assert.equal(walk.truncated, false);
    assert.deepEqual(
      walk.hits.map(({ target, hops, via, frozen }) => ({ target, hops, via, frozen })),
      [
        { target: "B", hops: 1, via: [], frozen: false },
        { target: "C", hops: 2, via: ["B"], frozen: false },
      ],
    );
  });

  it("reports a fork as out of date but does not walk past it", async () => {
    const edges = graph([
      ["D", "A", "fork"],
      ["E", "D", "transclude-same"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges));
    assert.deepEqual(
      walk.hits.map(({ target, frozen }) => ({ target, frozen })),
      [{ target: "D", frozen: true }],
    );
  });

  it("follows embedded sections, which render live", async () => {
    const edges = graph([
      ["M", "A", "section"],
      ["N", "M", "transclude-same"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges));
    assert.deepEqual(walk.hits.map((h) => h.target), ["M", "N"]);
  });

  it("upgrades a page reached by a copy and by a live path", async () => {
    const edges = graph([
      ["B", "A", "transclude-same"],
      ["X", "A", "fork"],
      ["X", "B", "section"],
      ["Y", "X", "transclude-same"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges));
    const x = walk.hits.find((h) => h.target === "X");
    assert.equal(x?.frozen, false);
    assert.ok(walk.hits.some((h) => h.target === "Y"));
  });

  it("detects a cycle back to the source and terminates", async () => {
    const edges = graph([
      ["F", "E", "transclude-same"],
      ["E", "F", "transclude-same"],
    ]);
    const walk = await walkDownstream("E", outgoing(edges));
    assert.equal(walk.cycle, true);
    assert.deepEqual(walk.hits.map((h) => h.target), ["F"]);
  });

  it("stops at the depth limit and says so", async () => {
    const edges = graph([
      ["B", "A", "transclude-same"],
      ["C", "B", "transclude-same"],
      ["D", "C", "transclude-same"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges), 2);
    assert.equal(walk.truncated, true);
    assert.deepEqual(walk.hits.map((h) => h.target), ["B", "C"]);
  });

  it("queries once per level, not once per page", async () => {
    const edges = graph([
      ["B1", "A", "transclude-same"],
      ["B2", "A", "transclude-same"],
      ["C1", "B1", "transclude-same"],
      ["C2", "B2", "transclude-same"],
    ]);
    let calls = 0;
    await walkDownstream("A", async (ids) => {
      calls += 1;
      return outgoing(edges)(ids);
    });
    // Level 1, level 2, then one empty level 3.
    assert.equal(calls, 3);
  });
});

describe("resolveChainRoot", () => {
  it("credits C to A through B", async () => {
    const edges = graph([
      ["B", "A", "transclude-same"],
      ["C", "B", "transclude-cross"],
    ]);
    assert.deepEqual(await resolveChainRoot("C", incoming(edges)), {
      root: "A",
      depth: 2,
      cycle: false,
      ambiguous: false,
      truncated: false,
    });
  });

  it("credits a fork to its source", async () => {
    const edges = graph([["D", "A", "fork"]]);
    const root = await resolveChainRoot("D", incoming(edges));
    assert.equal(root.root, "A");
    assert.equal(root.depth, 1);
  });

  it("treats a page with its own text as its own origin", async () => {
    const edges = graph([["M", "A", "section"]]);
    const root = await resolveChainRoot("M", incoming(edges));
    assert.equal(root.root, null);
    assert.equal(root.depth, 0);
  });

  it("flags a cycle instead of looping", async () => {
    const edges = graph([
      ["E", "F", "transclude-same"],
      ["F", "E", "transclude-same"],
    ]);
    const root = await resolveChainRoot("E", incoming(edges));
    assert.equal(root.cycle, true);
    assert.equal(root.root, null);
  });

  it("stops at a page with more than one whole-page source", async () => {
    const edges = graph([
      ["C", "B", "transclude-same"],
      ["B", "A1", "transclude-same"],
      ["B", "A2", "fork"],
    ]);
    const root = await resolveChainRoot("C", incoming(edges));
    assert.equal(root.root, "B");
    assert.equal(root.ambiguous, true);
  });
});

describe("edgeTypeForRef", () => {
  it("types a stub's ref by library and an authored page's refs as sections", () => {
    const cross = { kind: "cross-library", subdomain: "bio", pageID: 1 } as const;
    const same = { kind: "same-library", path: "X" } as const;
    assert.equal(edgeTypeForRef(cross, { targetLib: "chem", targetIsStub: true }), "transclude-cross");
    assert.equal(edgeTypeForRef(cross, { targetLib: "bio", targetIsStub: true }), "transclude-same");
    assert.equal(edgeTypeForRef(same, { targetLib: "chem", targetIsStub: true }), "transclude-same");
    assert.equal(edgeTypeForRef(same, { targetLib: "chem", targetIsStub: false }), "section");
    assert.equal(
      edgeTypeForRef({ ...same, section: "Intro" }, { targetLib: "chem", targetIsStub: true }),
      "section",
    );
  });
});

describe("summarizeAffectedBooks", () => {
  it("gives one line per book with the shortest chain, from a real walk", async () => {
    // A → B (book b) → C (book c), and A → D (book d, a fork), A → B2 (book b).
    const edges = graph([
      ["B", "A", "transclude-same"],
      ["B2", "A", "section"],
      ["C", "B", "transclude-cross"],
      ["D", "A", "fork"],
    ]);
    const walk = await walkDownstream("A", outgoing(edges));
    assert.deepEqual(summarizeAffectedBooks(walk.hits), [
      { bookID: "book-B", pages: 2, minHops: 1, via: [], frozen: false },
      { bookID: "book-D", pages: 1, minHops: 1, via: [], frozen: true },
      { bookID: "book-C", pages: 1, minHops: 2, via: ["B"], frozen: false },
    ]);
  });

  it("leaves out pages that belong to no known book", () => {
    assert.deepEqual(
      summarizeAffectedBooks([
        { target: "X", targetBook: null, source: "A", hops: 1, via: [], frozen: false },
      ]),
      [],
    );
  });

  it("marks a book frozen only when every affected page in it is a copy", () => {
    const [book] = summarizeAffectedBooks([
      { target: "X", targetBook: "b", source: "A", hops: 1, via: [], frozen: true },
      { target: "Y", targetBook: "b", source: "A", hops: 1, via: [], frozen: false },
    ]);
    assert.equal(book.frozen, false);
    assert.equal(book.pages, 2);
  });
});

describe("pageNodeId / parsePageNodeId", () => {
  it("round-trips and rejects malformed ids", () => {
    assert.deepEqual(parsePageNodeId(pageNodeId("chem", 12345)), { lib: "chem", pageID: 12345 });
    assert.equal(parsePageNodeId("chem"), null);
    assert.equal(parsePageNodeId("-12"), null);
    assert.equal(parsePageNodeId("chem-abc"), null);
  });
});
