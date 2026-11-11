import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBookGraph, collectIds, groupUnscannedSources, toViewRef } from "./content-sources-view.js";

describe("toViewRef", () => {
  it("names a page from the title map and links it by id", () => {
    assert.deepEqual(toViewRef("chem-12", new Map([["chem-12", "Atoms"]])), {
      id: "chem-12",
      lib: "chem",
      title: "Atoms",
      url: "https://chem.libretexts.org/@go/page/12",
    });
  });

  it("falls back to the id when the title is unknown", () => {
    assert.equal(toViewRef("eng-9", new Map()).title, "eng-9");
  });

  it("does not invent a link for a malformed id", () => {
    assert.equal(toViewRef("nonsense", new Map()).url, null);
  });
});

describe("groupUnscannedSources", () => {
  it("groups by source library and counts distinct pages and sources", () => {
    const groups = groupUnscannedSources([
      { source: "eng-1", target: "dev-10", type: "transclude-cross" },
      { source: "eng-2", target: "dev-10", type: "section" },
      { source: "eng-1", target: "dev-11", type: "transclude-cross" },
      { source: "math-7", target: "dev-12", type: "transclude-cross" },
    ]);
    assert.deepEqual(groups, [
      { lib: "eng", pages: 2, sources: 2, types: ["section", "transclude-cross"], examples: ["eng-1", "eng-2"] },
      { lib: "math", pages: 1, sources: 1, types: ["transclude-cross"], examples: ["math-7"] },
    ]);
  });

  it("skips malformed source ids", () => {
    assert.deepEqual(groupUnscannedSources([{ source: "bad", target: "dev-1", type: "fork" }]), []);
  });
});

describe("collectIds", () => {
  it("dedupes and drops empty values", () => {
    assert.deepEqual(collectIds(["a", "b"], [null, "a", undefined, "c"]), ["a", "b", "c"]);
  });
});

describe("buildBookGraph", () => {
  const summary = (bookID: string, extra: Partial<import("./content-sources-view.js").SummaryLinks> = {}) => ({
    bookID,
    lib: bookID.split("-")[0],
    pages: 10,
    upstream: [],
    downstream: [],
    ...extra,
  });

  it("merges a link seen from both books and keeps the larger count", () => {
    const graph = buildBookGraph([
      summary("chem-1", { downstream: [{ bookID: "bio-2", pages: 3, types: ["fork"] }] }),
      summary("bio-2", { upstream: [{ bookID: "chem-1", pages: 4, types: ["section"] }] }),
    ]);
    assert.deepEqual(graph.edges, [
      { source: "chem-1", target: "bio-2", pages: 4, types: ["fork", "section"] },
    ]);
    assert.deepEqual(graph.nodes.map((n) => [n.id, n.degree, n.pages]), [
      ["bio-2", 1, 10],
      ["chem-1", 1, 10],
    ]);
  });

  it("includes books without a summary as nodes of unknown size", () => {
    const graph = buildBookGraph([
      summary("chem-1", { upstream: [{ bookID: "phys-9", pages: 2, types: ["transclude-cross"] }] }),
    ]);
    assert.equal(graph.nodes.find((n) => n.id === "phys-9")?.pages, null);
  });

  it("keeps the heaviest links within the limit and reports the rest", () => {
    const graph = buildBookGraph(
      [summary("chem-1", {
        downstream: [
          { bookID: "a-1", pages: 1, types: ["fork"] },
          { bookID: "b-1", pages: 5, types: ["fork"] },
          { bookID: "c-1", pages: 3, types: ["fork"] },
        ],
      })],
      { minPages: 2, limit: 1 },
    );
    assert.deepEqual(graph.edges.map((e) => e.target), ["b-1"]);
    assert.equal(graph.omittedEdges, 2);
  });
});
