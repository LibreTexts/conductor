import { describe, expect, it } from "vitest";
import type { AuthorshipEntry, TableOfContents } from "../../../types";
import {
  authorRefLabel,
  currentKey,
  flattenToc,
  isMissingAuthor,
  isUnchanged,
  safeHref,
} from "./util";

const entry = (
  pageCredits: AuthorshipEntry["pageCredits"],
  status: AuthorshipEntry["status"] = "completed",
): AuthorshipEntry => ({
  id: "1",
  title: "Page",
  url: "https://example.com/1",
  status,
  pageCredits,
  sourceCredits: [],
  contentCredits: [],
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

describe("currentKey / isUnchanged", () => {
  const e = entry([
    { role: "author", tag: "author@", value: "jane-doe" },
    { role: "editor", tag: "editor@", value: "ann-lee" },
  ]);

  it("reads one role's key without mixing roles", () => {
    expect(currentKey(e, "author")).toBe("jane-doe");
    expect(currentKey(e, "editor")).toBe("ann-lee");
    expect(currentKey(e, "remixer")).toBeNull();
  });

  it("compares per role", () => {
    expect(isUnchanged(e, "author", "jane-doe")).toBe(true);
    expect(isUnchanged(e, "editor", "jane-doe")).toBe(false);
    expect(isUnchanged(e, "remixer", null)).toBe(true);
    expect(isUnchanged(e, "author", null)).toBe(false);
  });

  it("treats several tags of a role as needing a write", () => {
    const several = entry([
      { role: "author", tag: "author@", value: "Jane Doe" },
      { role: "author", tag: "author@", value: "John Smith" },
    ]);
    expect(currentKey(several, "author")).toBeNull();
    expect(isUnchanged(several, "author", "jane-doe")).toBe(false);
  });

  it("ignores authorname: tags, which the tool never touches", () => {
    const legacy = entry([{ role: "author", tag: "authorname:", value: "jane-doe" }]);
    expect(currentKey(legacy, "author")).toBeNull();
    expect(isUnchanged(legacy, "author", null)).toBe(true);
  });
});

describe("isMissingAuthor", () => {
  it("flags a scanned page with no author of its own", () => {
    expect(isMissingAuthor(entry([{ role: "editor", tag: "editor@", value: "x" }]))).toBe(true);
  });

  it("counts an authorname: tag as an author", () => {
    expect(isMissingAuthor(entry([{ role: "author", tag: "authorname:", value: "x" }]))).toBe(false);
  });

  it("doesn't flag pages that aren't scanned yet", () => {
    expect(isMissingAuthor(undefined)).toBe(false);
    expect(isMissingAuthor(entry([], "pending"))).toBe(false);
  });
});

describe("authorRefLabel", () => {
  it("prefers the resolved name and falls back to the tag text", () => {
    expect(
      authorRefLabel({
        role: "author",
        tag: "author@",
        value: "jane-doe",
        author: { nameKey: "jane-doe", name: "Jane Doe", isGroup: false },
      }),
    ).toBe("Jane Doe");
    expect(authorRefLabel({ role: "author", tag: "author@", value: "Jane Doe (College)" })).toBe(
      "Jane Doe (College)",
    );
  });
});

describe("safeHref", () => {
  it("links only http(s) URLs", () => {
    expect(safeHref("https://example.com/jane")).toBe("https://example.com/jane");
    expect(safeHref("http://example.com")).toBe("http://example.com/");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,hi")).toBeUndefined();
    expect(safeHref("not a url")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
