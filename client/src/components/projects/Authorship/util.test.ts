import { describe, expect, it } from "vitest";
import type { AuthorshipEntry, TableOfContents } from "../../../types";
import {
  authorRefLabel,
  bookCreditsFor,
  bookRows,
  currentKey,
  flattenToc,
  isMissingAuthor,
  isUnchanged,
  planQuickFix,
  safeHref,
  type AuthorshipRow,
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

describe("bookRows", () => {
  it("puts the main page first, with the book's pages beneath it", () => {
    const toc = {
      id: "0",
      title: "Book",
      url: "u0",
      children: [{ id: "1", title: "Chapter", url: "u1", children: [] }],
    } as unknown as TableOfContents;
    const rows = bookRows(toc, new Map([["0", entry([])]]));
    expect(rows.map((r) => [r.id, r.depth, !!r.isMainPage])).toEqual([
      ["0", 0, true],
      ["1", 1, false],
    ]);
    expect(rows[0].entry).toBeDefined();
    expect(bookRows(undefined, new Map())).toEqual([]);
  });
});

describe("bookCreditsFor", () => {
  it("reads book credits only, several per role", () => {
    const main = {
      ...entry([{ role: "author", tag: "author@", value: "own" }]),
      bookCredits: [
        { role: "author", tag: "bookauthor@", value: "a" },
        { role: "author", tag: "bookauthor@", value: "b" },
        { role: "editor", tag: "bookeditor@", value: "c" },
      ],
    } as AuthorshipEntry;
    expect(bookCreditsFor(main, "author").map((r) => r.value)).toEqual(["a", "b"]);
    expect(bookCreditsFor(entry([]), "author")).toEqual([]);
  });
});

describe("planQuickFix", () => {
  const person = (key: string) => ({ nameKey: key, name: key.toUpperCase(), isGroup: false });
  const linked = (key: string) => ({ role: "author" as const, tag: "author@", value: key, author: person(key) });
  const row = (id: string, depth: number, credits: AuthorshipEntry["pageCredits"]): AuthorshipRow => ({
    id,
    title: id,
    url: id,
    depth,
    entry: { ...entry(credits), id },
  });

  // main (ann) > ch1 (missing) > s1 (missing); ch2 (plain text) > s2 (missing); ch3 (bo) > s3 (missing)
  const rows = [
    row("main", 0, [linked("ann")]),
    row("ch1", 1, []),
    row("s1", 2, []),
    row("ch2", 1, [{ role: "author", tag: "author@", value: "Jane Doe (College)" }]),
    row("s2", 2, []),
    row("ch3", 1, [linked("bo")]),
    row("s3", 2, []),
  ];

  it("fills from the nearest parent, passing new values down", () => {
    const plan = planQuickFix(rows, ["author"], "parent", {});
    expect(plan.items.map((i) => `${i.pageID}:${i.person.key}`)).toEqual([
      "ch1:ann",
      "s1:ann",
      "s3:bo",
    ]);
    // s2's parent is plain text, which can't be written, so it isn't guessed past.
    expect(plan.missing.author).toBe(4);
    expect(plan.unresolved.author).toBe(1);
  });

  it("falls back to the book, but not past a plain-text parent", () => {
    const noMain = rows.map((r) => (r.id === "main" ? row("main", 0, []) : r));
    const plan = planQuickFix(noMain, ["author"], "parent-then-book", { author: { key: "bk", name: "BK" } });
    expect(plan.items.map((i) => `${i.pageID}:${i.person.key}:${i.from}`)).toEqual([
      "main:bk:book",
      "ch1:bk:parent",
      "s1:bk:parent",
      "s3:bo:parent",
    ]);
    expect(plan.unresolved.author).toBe(1);
  });

  it("uses only the book when asked, and respects the page scope", () => {
    const plan = planQuickFix(rows, ["author"], "book", { author: { key: "bk", name: "BK" } }, new Set(["s1", "s3"]));
    expect(plan.items.map((i) => `${i.pageID}:${i.person.key}`)).toEqual(["s1:bk", "s3:bk"]);
    expect(plan.missing.author).toBe(2);
  });

  it("ignores plain-text parents when filling from the book only", () => {
    const plan = planQuickFix(rows, ["author"], "book", { author: { key: "bk", name: "BK" } });
    expect(plan.items.map((i) => i.pageID)).toEqual(["ch1", "s1", "s2", "s3"]);
    expect(plan.unresolved.author).toBe(0);
  });

  it("leaves roles without a source unresolved", () => {
    const plan = planQuickFix(rows, ["editor"], "parent-then-book", {});
    expect(plan.items).toEqual([]);
    expect(plan.missing.editor).toBe(rows.length);
    expect(plan.unresolved.editor).toBe(rows.length);
  });
});
