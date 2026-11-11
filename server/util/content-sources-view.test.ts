import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectIds, groupUnscannedSources, toViewRef } from "./content-sources-view.js";

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
