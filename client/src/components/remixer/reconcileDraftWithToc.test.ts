import { describe, expect, it } from "vitest";
import { RemixerSubPage } from "./model";
import {
  applyCreatedPageIds,
  buildBookPaths,
  reconcileDraftWithToc,
  withDerivedStatusFlags,
} from "./services";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const page = (
  id: string,
  title: string,
  parentID: string,
  extra: Partial<RemixerSubPage> = {},
): RemixerSubPage =>
  ({
    "@id": id,
    "@title": title,
    title,
    "@href": `https://lib/@api/deki/pages/${id}`,
    "uri.ui": `https://lib/Book/${id}`,
    "@subpages": false,
    parentID,
    ...extra,
  }) as RemixerSubPage;

/**
 * The live book:
 *
 *   1 Book
 *   ├─ 10  1: Intro       ─ 11 1.1: Basics, 12 1.2: Setup
 *   ├─ 20  2: Methods     ─ 21 2.1: Alpha, 22 2.2: Beta, 23 2.3: Gamma
 *   └─ 30  3: Results
 */
const liveBook = (): RemixerSubPage[] => [
  page("1", "Book", "-1", { "@subpages": true }),
  page("10", "1: Intro", "1", { "@subpages": true }),
  page("20", "2: Methods", "1", { "@subpages": true }),
  page("30", "3: Results", "1"),
  page("11", "1.1: Basics", "10"),
  page("12", "1.2: Setup", "10"),
  page("21", "2.1: Alpha", "20"),
  page("22", "2.2: Beta", "20"),
  page("23", "2.3: Gamma", "20"),
];

/**
 * A draft saved right after loading `toc`: same pages, with
 * `originalPathNumber` seeded from the numbering at that moment — the way
 * `normalizeBookState({ initializeOriginalPathNumber: true })` seeds it.
 */
const draftOf = (toc: RemixerSubPage[]): RemixerSubPage[] =>
  buildBookPaths(toc).map((node) => ({
    ...node,
    originalPathNumber: [...(node.pathNumber ?? [])],
  }));

/** What the Remixer shows after load: paths rebuilt, moved flags derived. */
const finalize = (book: RemixerSubPage[]) => {
  const pages = withDerivedStatusFlags(buildBookPaths(book));
  return new Map(pages.map((node) => [node["@id"], node]));
};

const childIds = (book: RemixerSubPage[], parentId: string): string[] =>
  book.filter((n) => (n.parentID ?? "-1") === parentId).map((n) => n["@id"]);

const ids = (pages: RemixerSubPage[]): string[] => pages.map((n) => n["@id"]);

const find = (book: RemixerSubPage[], id: string) =>
  book.find((n) => n["@id"] === id);

const update = (
  book: RemixerSubPage[],
  id: string,
  patch: Partial<RemixerSubPage>,
): RemixerSubPage[] =>
  book.map((n) => (n["@id"] === id ? { ...n, ...patch } : n));

const without = (book: RemixerSubPage[], ...removed: string[]) =>
  book.filter((n) => !removed.includes(n["@id"]));

/** Moves `id` to sit right after `afterId` in the array (same parent assumed). */
const moveAfter = (book: RemixerSubPage[], id: string, afterId: string) => {
  const node = book.find((n) => n["@id"] === id)!;
  const rest = book.filter((n) => n["@id"] !== id);
  const at = rest.findIndex((n) => n["@id"] === afterId);
  return [...rest.slice(0, at + 1), node, ...rest.slice(at + 1)];
};

const emptyReport = {
  adopted: [],
  insertedFromToc: [],
  relocated: [],
  untracked: [],
};

// ---------------------------------------------------------------------------
// reconcileDraftWithToc
// ---------------------------------------------------------------------------

describe("reconcileDraftWithToc", () => {
  describe("guards", () => {
    it("returns the draft untouched when the live TOC is empty", () => {
      const draft = draftOf(liveBook());
      const { book, report } = reconcileDraftWithToc(draft, []);
      expect(book).toBe(draft);
      expect(report).toEqual(emptyReport);
    });

    it("returns an empty draft untouched", () => {
      const { book, report } = reconcileDraftWithToc([], liveBook());
      expect(book).toEqual([]);
      expect(report).toEqual(emptyReport);
    });
  });

  describe("draft in sync with the live book", () => {
    it("changes nothing and reports nothing", () => {
      const toc = liveBook();
      const { book, report } = reconcileDraftWithToc(draftOf(toc), toc);

      expect(report).toEqual(emptyReport);
      expect(ids(book)).toEqual(ids(toc));
      for (const node of finalize(book).values()) {
        expect(node.movedItem, node["@id"]).toBe(false);
        expect(node.renamedItem, node["@id"]).toBe(false);
        expect(node.addedItem ?? false, node["@id"]).toBe(false);
      }
    });

    it("seeds originalPathNumber from the live numbering", () => {
      const toc = liveBook();
      // A bogus baseline marks every page as moved by the draft, so each keeps
      // its placement; only the baseline itself gets re-based.
      const draft = draftOf(toc).map((n) => ({
        ...n,
        originalPathNumber: ["99"],
      }));
      const { book } = reconcileDraftWithToc(draft, toc);
      expect(find(book, "22")!.originalPathNumber).toEqual(["2", "2"]);
      expect(find(book, "30")!.originalPathNumber).toEqual(["3"]);
    });

    it("takes URLs from the live book", () => {
      const toc = update(liveBook(), "21", {
        "uri.ui": "https://lib/Book/02%3A_Methods/02.01%3A_Alpha",
        "@href": "https://lib/@api/deki/pages/21?v=2",
      });
      const draft = update(draftOf(liveBook()), "21", {
        "uri.ui": "https://lib/stale",
      });
      const alpha = find(reconcileDraftWithToc(draft, toc).book, "21")!;
      expect(alpha["uri.ui"]).toBe(
        "https://lib/Book/02%3A_Methods/02.01%3A_Alpha",
      );
      expect(alpha["@href"]).toBe("https://lib/@api/deki/pages/21?v=2");
    });
  });

  describe("draft ahead of the live book (unpublished edits win)", () => {
    it("keeps a rename and flags it", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "22", {
        title: "Beta v2",
        "@title": "Beta v2",
        renamedItem: true,
      });
      const { book, report } = reconcileDraftWithToc(draft, toc);
      const beta = finalize(book).get("22")!;

      expect(beta.renamedItem).toBe(true);
      expect(beta.title).toBe("Beta v2");
      expect(report).toEqual(emptyReport);
    });

    it("stores a renamed title without its numbering prefix", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "22", {
        title: "2.2: Beta v2",
        "@title": "2.2: Beta v2",
      });
      const beta = find(reconcileDraftWithToc(draft, toc).book, "22")!;
      expect(beta.renamedItem).toBe(true);
      expect(beta.title).toBe("Beta v2");
    });

    it("treats a changed numbering prefix alone as no rename", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "22", {
        title: "9.9: Beta",
        "@title": "9.9: Beta",
      });
      const beta = find(reconcileDraftWithToc(draft, toc).book, "22")!;
      expect(beta.renamedItem).toBe(false);
      expect(beta.title).toBe("2.2: Beta");
    });

    it("compares the book root title as-is", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "1", {
        title: "Book: Second Edition",
        "@title": "Book: Second Edition",
      });
      const root = find(reconcileDraftWithToc(draft, toc).book, "1")!;
      expect(root.renamedItem).toBe(true);
      expect(root.title).toBe("Book: Second Edition");
    });

    it("keeps a page the draft moved to another parent", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "12", {
        parentID: "30",
        movedItem: true,
      });
      const { book, report } = reconcileDraftWithToc(draft, toc);
      const setup = finalize(book).get("12")!;

      expect(setup.parentID).toBe("30");
      expect(setup.movedItem).toBe(true);
      expect(report.relocated).toEqual([]);
    });

    it("keeps a sibling order the draft changed", () => {
      const toc = liveBook();
      const draft = update(moveAfter(draftOf(toc), "21", "23"), "21", {
        movedItem: true,
      });
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(childIds(book, "20")).toEqual(["22", "23", "21"]);
      expect(finalize(book).get("21")!.movedItem).toBe(true);
      expect(report.relocated).toEqual([]);
    });

    it("detects a draft move from the baseline even without a moved flag", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "12", { parentID: "30" });
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(find(book, "12")!.parentID).toBe("30");
      expect(report.relocated).toEqual([]);
    });

    it("keeps a new page that is not published yet", () => {
      const toc = liveBook();
      const draft = [
        ...draftOf(toc),
        page("new-1", "Delta", "20", { addedItem: true, "uri.ui": "#" }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);
      const delta = find(book, "new-1")!;

      expect(delta.addedItem).toBe(true);
      expect(delta["uri.ui"]).toBe("#");
      expect(report.adopted).toEqual([]);
    });

    it("keeps an imported page whose id is not a live id", () => {
      const toc = liveBook();
      const imported = page("555-1700000000-abc", "Imported", "30", {
        addedItem: true,
        isImported: true,
      });
      const { book, report } = reconcileDraftWithToc(
        [...draftOf(toc), imported],
        toc,
      );
      expect(find(book, imported["@id"])).toBeTruthy();
      expect(report.untracked).toEqual([]);
    });

    it("keeps a pending delete of a page that is still live", () => {
      const toc = liveBook();
      const draft = update(draftOf(toc), "23", { deletedItem: true });
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(find(book, "23")!.deletedItem).toBe(true);
      expect(report.untracked).toEqual([]);
    });
  });

  describe("draft behind the live book (published or edited in the library since)", () => {
    it("clears a stale moved flag once the move is live", () => {
      const toc = moveAfter(liveBook(), "21", "23");
      const staleDraft = update(
        moveAfter(draftOf(liveBook()), "21", "23"),
        "21",
        { movedItem: true, isPlacementChanged: true },
      );
      const { book } = reconcileDraftWithToc(staleDraft, toc);
      const final = finalize(book);

      expect(childIds(book, "20")).toEqual(["22", "23", "21"]);
      for (const id of ["21", "22", "23"]) {
        expect(final.get(id)!.movedItem, id).toBe(false);
      }
    });

    it("clears a stale rename flag once the rename is live", () => {
      const toc = update(liveBook(), "22", {
        title: "2.2: Beta v2",
        "@title": "2.2: Beta v2",
      });
      const staleDraft = update(draftOf(liveBook()), "22", {
        title: "Beta v2",
        "@title": "Beta v2",
        renamedItem: true,
      });
      const beta = find(reconcileDraftWithToc(staleDraft, toc).book, "22")!;
      expect(beta.renamedItem).toBe(false);
      expect(beta.title).toBe("2.2: Beta v2");
    });

    it("adopts a new page that was published since, instead of creating it again", () => {
      const toc = [...liveBook(), page("24", "2.4: Delta", "20")];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "Delta", "20", { addedItem: true, "uri.ui": "#" }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);
      const delta = find(book, "24")!;

      expect(find(book, "new-1")).toBeUndefined();
      expect(delta.addedItem).toBe(false);
      expect(delta.isImported).toBe(false);
      expect(delta["uri.ui"]).toBe("https://lib/Book/24");
      expect(ids(report.adopted)).toEqual(["24"]);
      expect(report.insertedFromToc).toEqual([]);
    });

    it("adopts a published new subtree, parent first, and remaps the children", () => {
      const toc = [
        ...liveBook(),
        page("40", "4: Discussion", "1", { "@subpages": true }),
        page("41", "4.1: Limits", "40"),
      ];
      const draft = [
        ...draftOf(liveBook()),
        // Child listed before its parent to exercise the repeat-until-stable pass.
        page("new-c", "Limits", "new-p", { addedItem: true }),
        page("new-p", "Discussion", "1", { addedItem: true }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(ids(report.adopted).sort()).toEqual(["40", "41"]);
      expect(find(book, "41")!.parentID).toBe("40");
      expect(book.some((n) => n["@id"].startsWith("new-"))).toBe(false);
    });

    it("matches adopted titles case-insensitively, ignoring numbering", () => {
      const toc = [...liveBook(), page("24", "2.4: DELTA", "20")];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "delta", "20", { addedItem: true }),
      ];
      expect(ids(reconcileDraftWithToc(draft, toc).report.adopted)).toEqual([
        "24",
      ]);
    });

    it("does not adopt across parents", () => {
      const toc = [...liveBook(), page("24", "Delta", "10")];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "Delta", "20", { addedItem: true }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(report.adopted).toEqual([]);
      expect(find(book, "new-1")!.addedItem).toBe(true);
      // The live one is still unseen by the draft, so it gets inserted.
      expect(ids(report.insertedFromToc)).toEqual(["24"]);
    });

    it("pairs same-title new pages with live pages in order", () => {
      const toc = [
        ...liveBook(),
        page("24", "Appendix", "20"),
        page("25", "Appendix", "20"),
      ];
      const draft = [
        ...draftOf(liveBook()),
        page("new-a", "Appendix", "20", { addedItem: true }),
        page("new-b", "Appendix", "20", { addedItem: true }),
      ];
      const { report } = reconcileDraftWithToc(draft, toc);
      expect(ids(report.adopted)).toEqual(["24", "25"]);
    });

    it("does not adopt a new page the draft already deleted", () => {
      const toc = [...liveBook(), page("24", "Delta", "20")];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "Delta", "20", { addedItem: true, deletedItem: true }),
      ];
      expect(reconcileDraftWithToc(draft, toc).report.adopted).toEqual([]);
    });

    it("does not adopt a page that still has a default title", () => {
      // "New Page" is what every freshly added page is called, so a live page
      // with that title is far more likely a coincidence than this page.
      const toc = [
        ...liveBook(),
        page("24", "New Page", "20"),
        page("25", "New Page (1)", "20"),
      ];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "New Page", "20", { addedItem: true }),
        page("new-2", "New Page (1)", "20", { addedItem: true }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(report.adopted).toEqual([]);
      expect(find(book, "new-1")!.addedItem).toBe(true);
      expect(find(book, "new-2")!.addedItem).toBe(true);
      expect(ids(report.insertedFromToc)).toEqual(["24", "25"]);
    });

    it("does not adopt an imported page, so its content is still copied", () => {
      const toc = [...liveBook(), page("24", "Kinematics", "20")];
      const imported = page("555-1700000000-abc", "Kinematics", "20", {
        addedItem: true,
        isImported: true,
      });
      const { book, report } = reconcileDraftWithToc(
        [...draftOf(liveBook()), imported],
        toc,
      );

      expect(report.adopted).toEqual([]);
      expect(find(book, imported["@id"])!.isImported).toBe(true);
    });

    it("inserts a page added in the library at its live position", () => {
      const toc = liveBook();
      toc.splice(
        toc.findIndex((n) => n["@id"] === "22"),
        0,
        page("25", "2.2: Inserted", "20"),
      );
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );
      const inserted = finalize(book).get("25")!;

      expect(childIds(book, "20")).toEqual(["21", "25", "22", "23"]);
      expect(ids(report.insertedFromToc)).toEqual(["25"]);
      expect(inserted.addedItem).toBe(false);
      expect(inserted.movedItem).toBe(false);
    });

    it("inserts a first child live and marks the parent as having subpages", () => {
      const toc = [...liveBook(), page("31", "3.1: First", "30")];
      const { book } = reconcileDraftWithToc(draftOf(liveBook()), toc);

      expect(childIds(book, "30")).toEqual(["31"]);
      expect(find(book, "30")!["@subpages"]).toBe(true);
    });

    it("inserts a whole subtree added in the library", () => {
      const toc = [
        ...liveBook(),
        page("40", "4: Discussion", "1", { "@subpages": true }),
        page("41", "4.1: Limits", "40"),
      ];
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );

      expect(ids(report.insertedFromToc)).toEqual(["40", "41"]);
      expect(childIds(book, "1")).toEqual(["10", "20", "30", "40"]);
      expect(childIds(book, "40")).toEqual(["41"]);
    });

    it("follows a page moved to another parent in the library", () => {
      const toc = update(liveBook(), "23", { parentID: "30" });
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );
      const gamma = finalize(book).get("23")!;

      expect(gamma.parentID).toBe("30");
      expect(gamma.movedItem).toBe(false);
      expect(childIds(book, "20")).toEqual(["21", "22"]);
      expect(ids(report.relocated)).toEqual(["23"]);
    });

    it("follows a page moved to the book's top level in the library", () => {
      const moved = { ...find(liveBook(), "22")!, parentID: "1" };
      const rest = without(liveBook(), "22");
      const at = rest.findIndex((n) => n["@id"] === "30");
      const toc = [...rest.slice(0, at), moved, ...rest.slice(at)];
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );

      expect(childIds(book, "1")).toEqual(["10", "20", "22", "30"]);
      expect(ids(report.relocated)).toEqual(["22"]);
      expect(finalize(book).get("22")!.movedItem).toBe(false);
    });

    it("follows a sibling reorder done in the library", () => {
      const toc = moveAfter(liveBook(), "21", "23"); // live: 22, 23, 21
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );
      const final = finalize(book);

      expect(childIds(book, "20")).toEqual(["22", "23", "21"]);
      expect(ids(report.relocated).sort()).toEqual(["21", "22", "23"]);
      for (const id of ["21", "22", "23"]) {
        expect(final.get(id)!.movedItem, id).toBe(false);
      }
    });

    it("removes a page deleted in the library and reports it", () => {
      const toc = without(liveBook(), "22");
      const { book, report } = reconcileDraftWithToc(
        draftOf(liveBook()),
        toc,
      );

      expect(find(book, "22")).toBeUndefined();
      expect(ids(report.untracked)).toEqual(["22"]);
    });

    it("removes a published delete quietly", () => {
      const toc = without(liveBook(), "22");
      const draft = update(draftOf(liveBook()), "22", { deletedItem: true });
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(find(book, "22")).toBeUndefined();
      expect(report.untracked).toEqual([]);
    });

    it("removes a deleted subtree and moves draft-added children up", () => {
      const toc = without(liveBook(), "10", "11", "12");
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "Notes", "11", { addedItem: true }),
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(ids(report.untracked).sort()).toEqual(["10", "11", "12"]);
      expect(find(book, "new-1")!.parentID).toBe("1");
      expect(book.some((n) => ["10", "11", "12"].includes(n["@id"]))).toBe(
        false,
      );
    });
  });

  describe("draft and live book both changed", () => {
    it("keeps the draft's move and follows the library's move of another page", () => {
      const toc = update(liveBook(), "23", { parentID: "10" });
      const draft = update(draftOf(liveBook()), "12", {
        parentID: "30",
        movedItem: true,
      });
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(find(book, "12")!.parentID).toBe("30");
      expect(find(book, "23")!.parentID).toBe("10");
      expect(ids(report.relocated)).toEqual(["23"]);
    });

    it("keeps the draft's order when both reordered the same siblings", () => {
      const toc = moveAfter(liveBook(), "23", "21"); // live: 21, 23, 22
      const draft = update(moveAfter(draftOf(liveBook()), "21", "23"), "21", {
        movedItem: true,
      }); // draft: 22, 23, 21
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(childIds(book, "20")).toEqual(["22", "23", "21"]);
      expect(report.relocated).toEqual([]);
    });

    it("never makes a parent cycle when each side moved one page under the other", () => {
      // Library moved 21 under 23; the draft moved 23 under 21. 21 keeps its
      // number in the draft, so it isn't flagged as moved there.
      const toc = update(liveBook(), "21", { parentID: "23" });
      const draft = update(draftOf(liveBook()), "23", {
        parentID: "21",
        movedItem: true,
      });
      const { book, report } = reconcileDraftWithToc(draft, toc);
      const byId = new Map(book.map((n) => [n["@id"], n]));

      // The draft's move wins; 21 stays where the draft has it.
      expect(byId.get("21")!.parentID).toBe("20");
      expect(byId.get("23")!.parentID).toBe("21");
      expect(report.relocated).toEqual([]);
      // Every page still reaches the book root.
      for (const node of book) {
        const seen = new Set<string>();
        let current: RemixerSubPage | undefined = node;
        while (current && (current.parentID ?? "-1") !== "-1") {
          expect(seen.has(current["@id"]), `cycle at ${node["@id"]}`).toBe(
            false,
          );
          seen.add(current["@id"]);
          current = byId.get(current.parentID!);
        }
        expect(current, `orphaned ${node["@id"]}`).toBeDefined();
      }
      // The job will put 21 back under 20, so it must show as moved.
      expect(finalize(book).get("21")!.movedItem).toBe(true);
    });

    it("keeps a draft rename on a page the library moved", () => {
      const toc = update(liveBook(), "23", { parentID: "30" });
      const draft = update(draftOf(liveBook()), "23", {
        title: "Gamma v2",
        "@title": "Gamma v2",
        renamedItem: true,
      });
      const gamma = find(reconcileDraftWithToc(draft, toc).book, "23")!;

      expect(gamma.parentID).toBe("30");
      expect(gamma.renamedItem).toBe(true);
      expect(gamma.title).toBe("Gamma v2");
    });

    it("keeps a pending delete of a page the library moved", () => {
      const toc = update(liveBook(), "23", { parentID: "30" });
      const draft = update(draftOf(liveBook()), "23", { deletedItem: true });
      const gamma = find(reconcileDraftWithToc(draft, toc).book, "23")!;

      expect(gamma.deletedItem).toBe(true);
      expect(gamma.parentID).toBe("30");
    });

    it("handles adopt, insert, relocate and remove in one load", () => {
      let toc = liveBook();
      toc = without(toc, "12"); // deleted live
      toc = update(toc, "23", { parentID: "30" }); // moved live
      toc = [
        ...toc,
        page("24", "2.4: Delta", "20"),
        page("31", "3.1: Extra", "30"),
      ];
      const draft = [
        ...draftOf(liveBook()),
        page("new-1", "Delta", "20", { addedItem: true }), // published since
        page("new-2", "Epsilon", "20", { addedItem: true }), // still unpublished
      ];
      const { book, report } = reconcileDraftWithToc(draft, toc);

      expect(ids(report.untracked)).toEqual(["12"]);
      expect(ids(report.relocated)).toEqual(["23"]);
      expect(ids(report.adopted)).toEqual(["24"]);
      expect(ids(report.insertedFromToc)).toEqual(["31"]);
      expect(find(book, "new-2")!.addedItem).toBe(true);
      expect(childIds(book, "30").sort()).toEqual(["23", "31"]);
    });
  });
});

// ---------------------------------------------------------------------------
// Matter slot numbering (buildBookPaths under Front/Back Matter)
// ---------------------------------------------------------------------------

describe("matter slot numbering", () => {
  const B = "https://lib/Book";
  const FM = `${B}/00%3A_Front_Matter`;
  const BM = `${B}/zz%3A_Back_Matter`;
  const custom = (
    id: string,
    title: string,
    parentID: string,
    extra: Partial<RemixerSubPage> = {},
  ) => page(id, title, parentID, { addedItem: true, "uri.ui": "#", ...extra });

  /** Leaf path number (the publish slot) per page id. */
  const slots = (book: RemixerSubPage[]) =>
    new Map(buildBookPaths(book).map((n) => [n["@id"], n.pathNumber?.join(".")]));

  const frontMatter = (...customs: RemixerSubPage[][]): RemixerSubPage[] => [
    page("1", "Book", "-1"),
    page("f", "Front Matter", "1", { "uri.ui": FM }),
    ...(customs[0] ?? []),
    page("f1", "TitlePage", "f", { "uri.ui": `${FM}/01%3A_TitlePage` }),
    ...(customs[1] ?? []),
    page("f2", "InfoPage", "f", { "uri.ui": `${FM}/02%3A_InfoPage` }),
    page("f3", "Table of Contents", "f", {
      "uri.ui": `${FM}/03%3A_Table_of_Contents`,
    }),
    ...(customs[2] ?? []),
    page("f4", "Licensing", "f", { "uri.ui": `${FM}/04%3A_Licensing` }),
    ...(customs[3] ?? []),
    page("c", "1: Chapter", "1", { "uri.ui": `${B}/01%3A_Chapter` }),
  ];

  it("numbers front matter customs after the default above them", () => {
    const s = slots(
      frontMatter(
        [custom("a", "Before Title", "f")],
        [custom("b", "Dedication", "f"), custom("c2", "Foreword", "f")],
        [custom("d", "Preface", "f")],
        [custom("e", "Acknowledgements", "f")],
      ),
    );
    expect(s.get("a")).toBe("00.01");
    expect(s.get("b")).toBe("01.01");
    expect(s.get("c2")).toBe("01.02");
    expect(s.get("d")).toBe("03.01");
    expect(s.get("e")).toBe("04.01");
  });

  it("skips deleted customs without using up a slot", () => {
    const s = slots(
      frontMatter(
        [],
        [
          custom("b", "Dedication", "f", { deletedItem: true }),
          custom("c2", "Foreword", "f"),
        ],
      ),
    );
    expect(s.get("c2")).toBe("01.01");
  });

  const backMatter = (...customs: RemixerSubPage[][]): RemixerSubPage[] => [
    page("1", "Book", "-1"),
    page("c", "1: Chapter", "1", { "uri.ui": `${B}/01%3A_Chapter` }),
    page("b", "Back Matter", "1", { "uri.ui": BM }),
    ...(customs[0] ?? []),
    page("b1", "Index", "b", { "uri.ui": `${BM}/10%3A_Index` }),
    ...(customs[1] ?? []),
    page("b2", "Glossary", "b", { "uri.ui": `${BM}/20%3A_Glossary` }),
    page("b3", "Detailed Licensing", "b", {
      "uri.ui": `${BM}/30%3A_Detailed_Licensing`,
    }),
    ...(customs[2] ?? []),
  ];

  it("numbers back matter customs as the default's slot plus one", () => {
    const s = slots(
      backMatter(
        [custom("x", "Appendix", "b")],
        [custom("y", "Answers", "b"), custom("z", "Notes", "b")],
        [custom("w", "Colophon", "b")],
      ),
    );
    expect(s.get("x")).toBe("01");
    expect(s.get("y")).toBe("11");
    expect(s.get("z")).toBe("12");
    expect(s.get("w")).toBe("31");
  });

  it("continues a long back matter run as 19.01, 19.02… before the next default", () => {
    const run = Array.from({ length: 11 }, (_, i) =>
      custom(`r${i}`, `Extra ${i}`, "b"),
    );
    const s = slots(backMatter([], run));
    expect(s.get("r0")).toBe("11");
    expect(s.get("r8")).toBe("19");
    expect(s.get("r9")).toBe("19.01");
    expect(s.get("r10")).toBe("19.02");
  });

  it("leaves default matter pages without a slot of their own", () => {
    const s = slots(backMatter());
    // Defaults keep their container's path; their URL carries the fixed slot.
    expect(s.get("b1")).toBe(s.get("b"));
  });
});

// ---------------------------------------------------------------------------
// Pages created by a publish run that failed partway
// ---------------------------------------------------------------------------

describe("applyCreatedPageIds", () => {
  const draftWithNewPages = () => [
    ...draftOf(liveBook()),
    page("new-ch", "New Chapter", "1", { addedItem: true, "uri.ui": "#" }),
    page("new-pg", "New Page", "new-ch", { addedItem: true, "uri.ui": "#" }),
    page("555-1700000000-abc", "Kinematics", "20", {
      addedItem: true,
      isImported: true,
    }),
  ];

  it("gives created pages their live ids and moves their children along", () => {
    const { book, mapped } = applyCreatedPageIds(draftWithNewPages(), [
      { draftID: "new-ch", pageID: "40" },
      { draftID: "new-pg", pageID: "41" },
      { draftID: "555-1700000000-abc", pageID: "24" },
    ]);

    expect(mapped).toBe(3);
    expect(find(book, "40")).toMatchObject({ addedItem: false, isImported: false });
    expect(find(book, "41")).toMatchObject({ parentID: "40", addedItem: false });
    expect(find(book, "24")).toMatchObject({ isImported: false, addedItem: false });
    expect(book.some((n) => n["@id"].includes("new-") || n["@id"].includes("-17"))).toBe(false);
  });

  it("leaves pages the run didn't reach as new", () => {
    const { book, mapped } = applyCreatedPageIds(draftWithNewPages(), [
      { draftID: "new-ch", pageID: "40" },
    ]);

    expect(mapped).toBe(1);
    expect(find(book, "new-pg")).toMatchObject({ parentID: "40", addedItem: true });
    expect(find(book, "555-1700000000-abc")!.isImported).toBe(true);
  });

  it("is a no-op for an empty list, unknown drafts, and a second application", () => {
    const draft = draftWithNewPages();
    expect(applyCreatedPageIds(draft, []).book).toBe(draft);
    expect(applyCreatedPageIds(draft, undefined).book).toBe(draft);
    expect(
      applyCreatedPageIds(draft, [{ draftID: "new-gone", pageID: "99" }]).mapped,
    ).toBe(0);

    const once = applyCreatedPageIds(draft, [{ draftID: "new-ch", pageID: "40" }]);
    const twice = applyCreatedPageIds(once.book, [
      { draftID: "new-ch", pageID: "40" },
    ]);
    expect(twice.mapped).toBe(0);
    expect(twice.book).toBe(once.book);
  });

  it("never maps onto a live id the draft already has", () => {
    // e.g. the live page already came back into the draft some other way.
    const draft = [...draftWithNewPages(), page("40", "New Chapter", "1")];
    const { book, mapped } = applyCreatedPageIds(draft, [
      { draftID: "new-ch", pageID: "40" },
    ]);
    expect(mapped).toBe(0);
    expect(book.filter((n) => n["@id"] === "40")).toHaveLength(1);
  });

  it("stops a retry recreating a default-titled page the failed run created", () => {
    // The run created "New Chapter" (40) and "New Page" (41), then failed.
    // Title matching deliberately skips default titles, so without the run's
    // record both would be inserted from the live book *and* created again.
    const toc = [
      ...liveBook(),
      page("40", "4: New Chapter", "1", { "@subpages": true }),
      page("41", "4.1: New Page", "40"),
    ];
    const withoutRecord = reconcileDraftWithToc(draftWithNewPages(), toc);
    expect(find(withoutRecord.book, "new-ch")!.addedItem).toBe(true);
    expect(ids(withoutRecord.report.insertedFromToc)).toEqual(["40", "41"]);

    const { book: mappedDraft } = applyCreatedPageIds(draftWithNewPages(), [
      { draftID: "new-ch", pageID: "40" },
      { draftID: "new-pg", pageID: "41" },
    ]);
    const { book, report } = reconcileDraftWithToc(mappedDraft, toc);

    expect(report.insertedFromToc).toEqual([]);
    expect(book.filter((n) => n.addedItem && !n.isImported)).toEqual([]);
    expect(find(book, "41")!.parentID).toBe("40");
    // The imported page the run never reached is still pending.
    expect(find(book, "555-1700000000-abc")!.isImported).toBe(true);
  });
});
