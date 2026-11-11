import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  flattenPageTree,
  structuralTagsFor,
} from "./provenance-tree.js";

/** Shaped like a real `tree?include=properties,lastmodified` response. */
const tree = {
  "@id": "100",
  "@revision": "3",
  "date.modified": "Fri, 30 Oct 2026 16:57:54 GMT",
  path: { "@seo": "true", "#text": "Bookshelves/Chem/Book" },
  title: "Book",
  properties: {
    property: [
      { "@name": "mindtouch.page#articleType", contents: { "#text": "topic-category" } },
    ],
  },
  subpages: {
    page: [
      {
        "@id": "101",
        "@revision": "7",
        path: { "#text": "Bookshelves/Chem/Book/1:_Atoms" },
        title: "1: Atoms",
        // A single (non-array) property is a plain object in the response.
        properties: {
          property: {
            "@name": "mindtouch.page#articleType",
            contents: { "#text": "topic-guide" },
          },
        },
        subpages: {
          page: { "@id": "102", title: "1.1: Protons", path: "Bookshelves/Chem/Book/1:_Atoms/1.1" },
        },
      },
      { "@id": "103", title: "2: Bonds" },
    ],
  },
};

describe("flattenPageTree", () => {
  const pages = flattenPageTree(tree);

  it("lists every page, cover first, with parents", () => {
    assert.deepEqual(
      pages.map(({ pageID, parentID, isCover }) => ({ pageID, parentID, isCover })),
      [
        { pageID: 100, parentID: null, isCover: true },
        { pageID: 101, parentID: 100, isCover: false },
        { pageID: 102, parentID: 101, isCover: false },
        { pageID: 103, parentID: 100, isCover: false },
      ],
    );
  });

  it("reads revision, date, path, title and article type", () => {
    const cover = pages[0];
    assert.equal(cover.revision, 3);
    assert.equal(cover.modifiedAt?.toISOString(), "2026-10-30T16:57:54.000Z");
    assert.equal(cover.path, "Bookshelves/Chem/Book");
    assert.equal(cover.articleType, "topic-category");
    assert.deepEqual(structuralTagsFor(cover), ["coverpage:yes", "article:topic-category"]);
    // A single (non-array) subpage and a plain-string path both parse.
    assert.equal(pages[2].path, "Bookshelves/Chem/Book/1:_Atoms/1.1");
  });

  it("reads a property given as a single object, not an array", () => {
    assert.equal(pages[1].articleType, "topic-guide");
    assert.equal(pages[3].articleType, undefined);
  });

  it("handles an empty response", () => {
    assert.deepEqual(flattenPageTree(undefined), []);
  });
});

describe("generated matter", () => {
  // Shape of dev book 9213: matter under the cover, and a second copy nested
  // under a wrapper chapter "Chapters" (renamed "1: InfoPage" by Remixer).
  const page = (id: string, title: string, path: string, children: any[] = []) => ({
    "@id": id,
    title,
    path: { "#text": `Workbench/book/${path}` },
    ...(children.length ? { subpages: { page: children } } : {}),
  });
  const book = page("9213", "Book", "", [
    page("10862", "Front Matter", "00:_Front_Matter", [
      page("10863", "TitlePage", "00:_Front_Matter/01:_TitlePage"),
      page("10871", "Info abc", "00:_Front_Matter/02.01:_Info_abc"),
    ]),
    page("10940", "Chapters", "01:_Chapters", [
      page("10941", "Front Matter", "01:_Chapters/1.01:_Front_Matter", [
        page("10982", "1: InfoPage", "01:_Chapters/1.01:_Front_Matter/01:_InfoPage"),
      ]),
      page("10623", "1: iVoices Media Collections", "01:_Chapters/1.01:_iVoices"),
      page("11049", "6: Back Matter", "01:_Chapters/zz:_Back_Matter", [
        page("11050", "Index", "01:_Chapters/zz:_Back_Matter/10:_Index"),
      ]),
    ]),
    page("9220", "Back Matter", "zz:_Back_Matter", [
      page("9221", "Index", "zz:_Back_Matter/10:_Index"),
      page("9227", "Tiling the Plane", "zz:_Back_Matter/11:_Tiling_the_Plane"),
    ]),
  ]);
  const byId = new Map(flattenPageTree(book).map((p) => [String(p.pageID), p]));
  const matter = (id: string) => byId.get(id)?.isGeneratedMatter;

  it("flags containers and their default pages at any depth", () => {
    for (const id of ["10862", "10863", "10941", "10982", "11049", "11050", "9220", "9221"]) {
      assert.equal(matter(id), true, `page ${id}`);
    }
  });

  it("keeps the cover, chapters and custom pages inside matter as content", () => {
    for (const id of ["9213", "10940", "10623", "10871", "9227"]) {
      assert.equal(matter(id), false, `page ${id}`);
    }
  });

  it("never invents tags: only the library's own values are reported", () => {
    assert.deepEqual(structuralTagsFor(byId.get("10982")!), []);
  });
});

