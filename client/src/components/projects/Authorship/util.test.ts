





import { describe, expect, it } from "vitest";
import type { AuthorshipEntry, TableOfContents } from "../../../types";
import { authorRefLabel, currentAuthorKey, flattenToc, isUnchanged } from "./util";

const entry = (pageAuthors: AuthorshipEntry["pageAuthors"]): AuthorshipEntry => ({
  id: "1",
  title: "Page",
  url: "https://example.com/1",
  status: "completed",
  pageAuthors,
  contentAuthors: [],
});

describe("flattenToc", () => {
  it("flattens in TOC order with depths and attaches entries", () => {
    const toc = [
      {
        id: "1",
        title: "Chapter",
        url: "u1",
        children: [{ id: "2", title: "Section", url: "u2", children: [] }],
      },
    ] as unknown as TableOfContents[];
    const rows = flattenToc(toc, new Map([["2", entry([])]]));
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ["1", 0],
      ["2", 1],
    ]);
    expect(rows[0].entry).toBeUndefined();
    expect(rows[1].entry).toBeDefined();
  });
});

describe("currentAuthorKey / isUnchanged", () => {
  it("reads a single author@ key", () => {
    const e = entry([{ tag: "author@", value: "jane-doe" }]);
    expect(currentAuthorKey(e)).toBe("jane-doe");
    expect(isUnchanged(e, "jane-doe")).toBe(true);
    expect(isUnchanged(e, "john-smith")).toBe(false);
    expect(isUnchanged(e, null)).toBe(false);
  });

  it("treats several author@ tags as needing a write", () => {
    const e = entry([
      { tag: "author@", value: "Jane Doe" },
      { tag: "author@", value: "John Smith" },
    ]);
    expect(currentAuthorKey(e)).toBeNull();
    expect(isUnchanged(e, "jane-doe")).toBe(false);
  });

  it("ignores authorname: tags, which the tool never touches", () => {
    const e = entry([{ tag: "authorname:", value: "jane-doe" }]);
    expect(currentAuthorKey(e)).toBeNull();
    expect(isUnchanged(e, null)).toBe(true);
  });
});

describe("authorRefLabel", () => {
  it("prefers the resolved name and falls back to the tag text", () => {
    expect(
      authorRefLabel({
        tag: "author@",
        value: "jane-doe",
        author: { nameKey: "jane-doe", name: "Jane Doe", isGroup: false },
      }),
    ).toBe("Jane Doe");
    expect(authorRefLabel({ tag: "author@", value: "Jane Doe (College)" })).toBe(
      "Jane Doe (College)",
    );
  });
});
