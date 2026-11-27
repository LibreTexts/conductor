import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLibraryMap, type LibraryMapInput } from "./library-map.js";

const base = (extra: Partial<LibraryMapInput> = {}): LibraryMapInput => ({
  books: [
    { bookID: "chem-1", library: "chem", title: "General Chemistry" },
    { bookID: "bio-2", library: "bio", title: "Biology" },
    { bookID: "math-3", library: "math", title: "Calculus" },
  ],
  summaries: [
    {
      bookID: "chem-1", lib: "chem", pages: 100,
      computedAt: new Date("2026-11-01T00:00:00Z"),
      totals: { pages: 100, original: 90, transclude: 5, mixed: 5 },
      upstream: [],
      downstream: [{ bookID: "bio-2", pages: 7, types: ["transclude-cross"] }],
    },
    {
      bookID: "bio-2", lib: "bio", pages: 50,
      totals: { pages: 50, original: 40, transclude: 7, fork: 3 },
      // The same link, seen from the reusing book, plus a fork.
      upstream: [{ bookID: "chem-1", pages: 7, types: ["transclude-cross", "fork"] }],
      downstream: [],
    },
  ],
  unscanned: [{ lib: "eng", book: "bio-2", pages: 2, types: ["section"] }],
  attention: [{ bookID: "bio-2", sourceChanged: 1, broken: 0 }],
  projects: [{ bookID: "bio-2", projectID: "P1" }],
  scanStates: [{ library: "chem", phase: "idle", lastCompletedAt: new Date("2026-11-02T00:00:00Z") }],
  titles: new Map(),
  now: new Date("2026-11-03T00:00:00Z"),
  ...extra,
});

describe("buildLibraryMap", () => {
  it("has every Commons book, scanned or not, and a node per unscanned library", () => {
    const map = buildLibraryMap(base());
    assert.deepEqual(
      map.nodes.map((n) => [n.id, n.kind, n.scanned]),
      [["bio-2", "book", true], ["chem-1", "book", true], ["math-3", "book", false], ["library:eng", "library", false]],
    );
    const math = map.nodes.find((n) => n.id === "math-3")!;
    assert.equal(math.totals, null);
    assert.equal(math.title, "Calculus");
  });

  it("keeps each link once, merging what both books' summaries say", () => {
    const map = buildLibraryMap(base());
    const name = (i: number) => map.nodes[i].id;
    const links = map.edges.map(([s, t, pages, mask]) => [
      name(s), name(t), pages, map.edgeTypes.filter((_, bit) => mask & (1 << bit)),
    ]);
    assert.deepEqual(links, [
      ["chem-1", "bio-2", 7, ["transclude-cross", "fork"]],
      ["library:eng", "bio-2", 2, ["section"]],
    ]);
  });

  it("counts pages reused in and out, attention and the linked project", () => {
    const map = buildLibraryMap(base());
    const chem = map.nodes.find((n) => n.id === "chem-1")!;
    const bio = map.nodes.find((n) => n.id === "bio-2")!;
    assert.equal(chem.reusedBy, 7);
    assert.equal(bio.reuses, 9);
    assert.deepEqual(bio.attention, { sourceChanged: 1, broken: 0 });
    assert.equal(bio.projectID, "P1");
    assert.deepEqual(chem.totals, {
      pages: 100, original: 90, transclude: 5, fork: 0, full: 0, mixed: 5, structural: 0, unknown: 0, viaChain: 0,
    });
  });

  it("adds books known only from a link, named from page titles", () => {
    const map = buildLibraryMap(base({
      books: [],
      summaries: [{ bookID: "dev-9", lib: "dev", pages: 3, upstream: [{ bookID: "chem-5", pages: 1, types: ["excerpt"] }], downstream: [] }],
      unscanned: [],
      titles: new Map([["chem-5", "Atoms"]]),
    }));
    assert.deepEqual(map.nodes.map((n) => [n.id, n.title, n.lib]), [["dev-9", "dev-9", "dev"], ["chem-5", "Atoms", "chem"]]);
    assert.equal(map.edges.length, 1);
  });

  it("summarizes each library's books and scan state", () => {
    const map = buildLibraryMap(base());
    assert.deepEqual(map.libraries.find((l) => l.lib === "chem"), {
      lib: "chem", books: 1, scanned: 1, phase: "idle", lastCompletedAt: "2026-11-02T00:00:00.000Z",
    });
    assert.deepEqual(map.libraries.find((l) => l.lib === "math"), {
      lib: "math", books: 1, scanned: 0, phase: null, lastCompletedAt: null,
    });
  });
});
