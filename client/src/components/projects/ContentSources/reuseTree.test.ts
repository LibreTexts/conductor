import { describe, expect, it } from "vitest";
import type { ContentSourcesPage, ContentSourcesPageSource, ReuseEdgeType } from "../../../types/ContentSources";
import { buildReuseTree, type ReuseTreeDatum } from "./reuseTree";

const src = (id: string, title: string, type: ReuseEdgeType = "transclude-cross"): ContentSourcesPageSource => ({
  id,
  lib: id.split("-")[0],
  title,
  url: null,
  type,
  origin: "scan",
  status: "active",
});

const page = (pageID: number, title: string, depth: number, sources: ContentSourcesPageSource[] = []): ContentSourcesPage => ({
  id: `dev-${pageID}`,
  lib: "dev",
  title,
  url: null,
  pageID,
  depth,
  kind: sources.length ? "mixed" : "original",
  reuseDepth: sources.length ? 1 : 0,
  rootSource: null,
  reuseCycle: false,
  sources,
});

/** The book in table-of-contents order, as the pages endpoint returns it. */
const book = [
  page(100, "Cover", 0),
  page(1, "1: Intro", 1),
  page(2, "1.1: Unused", 2),
  page(3, "1.2: Uses chemistry", 2, [src("chem-1", "Atoms")]),
  page(4, "2: Unused chapter", 1),
  page(5, "2.1: Unused page", 2),
  page(6, "3: Labs", 1, [src("eng-5", "Lab safety")]),
  page(7, "3.1: Sub", 2),
  page(8, "3.1.1: Deep", 3, [src("math-1", "Limits"), src("math-2", "Derivatives", "excerpt")]),
];

/** A compact outline of a tree: `label` or `label(children…)`. */
const outline = (d: ReuseTreeDatum): string =>
  d.children?.length ? `${d.label}(${d.children.map(outline).join(", ")})` : d.label;

describe("buildReuseTree", () => {
  it("follows the table of contents down to each reusing page and its sources, leaving out unused siblings", () => {
    const result = buildReuseTree(book, "My Book");
    expect(outline(result.root)).toBe(
      "My Book(1: Intro(1.2: Uses chemistry(Atoms)), 3: Labs(Lab safety, 3.1: Sub(3.1.1: Deep(Limits, Derivatives))))",
    );
    expect(result).toMatchObject({ reusedPages: 3, shownPages: 3, hiddenPages: 0, sources: 4, chapters: 2, totalPages: 9 });
  });

  it("marks which pages reuse content themselves, and how each source is reused", () => {
    const labs = buildReuseTree(book, "My Book").root.children![1];
    expect(labs.reuses).toBe(true);
    const sub = labs.children![1];
    expect([sub.label, sub.reuses]).toEqual(["3.1: Sub", false]);
    const deep = sub.children![0];
    expect(deep.children!.map((s) => [s.kind, s.type, s.lib])).toEqual([
      ["source", "transclude-cross", "math"],
      ["source", "excerpt", "math"],
    ]);
  });

  it("draws only the first reusing pages past the cap, and counts the rest", () => {
    const result = buildReuseTree(book, "My Book", { maxPages: 2 });
    expect(outline(result.root)).toBe("My Book(1: Intro(1.2: Uses chemistry(Atoms)), 3: Labs(Lab safety))");
    expect(result).toMatchObject({ reusedPages: 3, shownPages: 2, hiddenPages: 1, sources: 2 });
  });

  it("is empty for a book that reuses nothing", () => {
    const result = buildReuseTree([page(100, "Cover", 0), page(1, "1: Intro", 1)], "My Book");
    expect(result.root.children).toEqual([]);
    expect(result.reusedPages).toBe(0);
  });
});
