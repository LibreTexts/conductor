import { describe, expect, it } from "vitest";
import { TableOfContents } from "../../../types/Book";
import {
  collectSubtreeIds,
  generateDefaultGroups,
  getTopLevelAncestorId,
  resolveDrop,
} from "./glossaryConfigDefaults";

const node = (
  id: string,
  children: TableOfContents[] = [],
): TableOfContents => ({
  id,
  title: id,
  url: "",
  children,
});

/**
 * book-root
 * ├── chapter-1
 * │   ├── section-a
 * │   │   ├── page-a1
 * │   │   └── page-a2
 * │   ├── section-b
 * │   │   ├── page-b1
 * │   │   └── page-b2
 * │   └── section-c
 * └── chapter-2
 *     └── page-c1
 */
const toc: TableOfContents = node("book-root", [
  node("chapter-1", [
    node("section-a", [node("page-a1"), node("page-a2")]),
    node("section-b", [node("page-b1"), node("page-b2")]),
    node("section-c"),
  ]),
  node("chapter-2", [node("page-c1")]),
]);

describe("collectSubtreeIds", () => {
  it("returns a leaf's own id only", () => {
    expect(collectSubtreeIds(node("page-a1"))).toEqual(["page-a1"]);
  });

  it("returns a node's id plus every descendant, depth-first", () => {
    const chapter1 = toc.children[0];
    expect(collectSubtreeIds(chapter1)).toEqual([
      "chapter-1",
      "section-a",
      "page-a1",
      "page-a2",
      "section-b",
      "page-b1",
      "page-b2",
      "section-c",
    ]);
  });
});

describe("getTopLevelAncestorId", () => {
  it("finds the top-level chapter for a deeply nested page", () => {
    expect(getTopLevelAncestorId(toc, "page-a1")).toBe("chapter-1");
    expect(getTopLevelAncestorId(toc, "page-c1")).toBe("chapter-2");
  });

  it("returns a top-level node's own id when it is already top-level", () => {
    expect(getTopLevelAncestorId(toc, "chapter-1")).toBe("chapter-1");
  });

  it("falls back to the root id when the page IS the root", () => {
    expect(getTopLevelAncestorId(toc, "book-root")).toBe("book-root");
  });

  it("falls back to the root id when the page isn't found", () => {
    expect(getTopLevelAncestorId(toc, "does-not-exist")).toBe("book-root");
  });
});

describe("generateDefaultGroups", () => {
  it("PAGE mode: one singleton group per TOC node, excluding the book root", () => {
    const groups = generateDefaultGroups("PAGE", toc);
    expect(groups.map((g) => g.pageIds)).toEqual([
      ["chapter-1"],
      ["section-a"],
      ["page-a1"],
      ["page-a2"],
      ["section-b"],
      ["page-b1"],
      ["page-b2"],
      ["section-c"],
      ["chapter-2"],
      ["page-c1"],
    ]);
    // group IDs must be unique
    expect(new Set(groups.map((g) => g.groupID)).size).toBe(groups.length);
    // each group targets its own single page
    expect(groups.every((g) => g.targetPageId === g.pageIds[0])).toBe(true);
  });

  it("CHAPTER mode: one group per top-level chapter, each holding its whole subtree and targeting the chapter page", () => {
    const groups = generateDefaultGroups("CHAPTER", toc);
    expect(groups).toHaveLength(2);
    expect(groups[0].pageIds).toEqual([
      "chapter-1",
      "section-a",
      "page-a1",
      "page-a2",
      "section-b",
      "page-b1",
      "page-b2",
      "section-c",
    ]);
    expect(groups[0].targetPageId).toBe("chapter-1");
    expect(groups[1].pageIds).toEqual(["chapter-2", "page-c1"]);
    expect(groups[1].targetPageId).toBe("chapter-2");
    // the book root itself is not part of any chapter group
    expect(groups.flatMap((g) => g.pageIds)).not.toContain("book-root");
  });

  it("CHAPTER mode produces no groups when the book has no top-level chapters", () => {
    const leafOnly = node("solo-page");
    expect(generateDefaultGroups("CHAPTER", leafOnly)).toEqual([]);
  });

  it("BACKEND mode: a single group containing every page in the book except the root, targeting the glossary page", () => {
    const groups = generateDefaultGroups("BACKEND", toc, "existing-glossary-page");
    expect(groups).toHaveLength(1);
    expect(groups[0].pageIds).toEqual([
      "chapter-1",
      "section-a",
      "page-a1",
      "page-a2",
      "section-b",
      "page-b1",
      "page-b2",
      "section-c",
      "chapter-2",
      "page-c1",
    ]);
    expect(groups[0].targetPageId).toBe("existing-glossary-page");
  });

  it("BACKEND mode falls back to the book's first chapter as the target when there is no glossary page yet", () => {
    const groups = generateDefaultGroups("BACKEND", toc);
    expect(groups[0].targetPageId).toBe("chapter-1");
  });

  it("BACKEND mode falls back to the root as the target when the book has no chapters either", () => {
    const leafOnly = node("solo-page");
    const groups = generateDefaultGroups("BACKEND", leafOnly);
    expect(groups[0].targetPageId).toBe("solo-page");
  });
});

describe("resolveDrop", () => {
  const groups = [
    { groupID: "g1", pageIds: ["page-a1", "page-a2"], targetPageId: "page-a1" },
    { groupID: "g2", pageIds: ["page-b1"], targetPageId: "page-b1" },
  ];

  it("moves a page from one group to another", () => {
    const result = resolveDrop(groups, ["page-a1"], { type: "group", groupIndex: 1 });
    expect(result[0].pageIds).toEqual(["page-a2"]);
    expect(result[1].pageIds).toEqual(["page-b1", "page-a1"]);
  });

  it("adds an unassigned page to a group without duplicating", () => {
    const result = resolveDrop(groups, ["page-c1"], { type: "group", groupIndex: 0 });
    expect(result[0].pageIds).toEqual(["page-a1", "page-a2", "page-c1"]);
  });

  it("is a no-op duplicate-guard when the page is already in the target group", () => {
    const result = resolveDrop(groups, ["page-a1"], { type: "group", groupIndex: 0 });
    expect(result[0].pageIds).toEqual(["page-a1", "page-a2"]);
  });

  it("removes a page from its group when dropped on the unassigned bucket", () => {
    const result = resolveDrop(groups, ["page-a1"], { type: "unassigned" });
    expect(result[0].pageIds).toEqual(["page-a2"]);
    expect(result[1].pageIds).toEqual(["page-b1"]);
  });

  it("never mutates the input array", () => {
    const before = JSON.stringify(groups);
    resolveDrop(groups, ["page-a1"], { type: "group", groupIndex: 1 });
    expect(JSON.stringify(groups)).toBe(before);
  });

  it("moves a whole subtree of pages (e.g. a dragged chapter) into one group together", () => {
    const result = resolveDrop(
      groups,
      ["page-b1", "page-c1", "page-c2"],
      { type: "group", groupIndex: 0 },
    );
    expect(result[0].pageIds).toEqual([
      "page-a1",
      "page-a2",
      "page-b1",
      "page-c1",
      "page-c2",
    ]);
    expect(result[1].pageIds).toEqual([]);
  });

  it("is a no-op when every page in the subtree is already in the target group", () => {
    const result = resolveDrop(groups, ["page-a1", "page-a2"], {
      type: "group",
      groupIndex: 0,
    });
    expect(result).toBe(groups);
  });

  it("unassigns a whole subtree at once", () => {
    const result = resolveDrop(groups, ["page-a1", "page-a2"], {
      type: "unassigned",
    });
    expect(result[0].pageIds).toEqual([]);
    expect(result[1].pageIds).toEqual(["page-b1"]);
  });
});
