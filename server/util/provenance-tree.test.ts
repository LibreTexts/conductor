import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  flattenPageTree,
  parseConductorSource,
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
        properties: {
          property: {
            "@name": "urn:custom.mindtouch.com#conductor-source",
            contents: {
              "#text": JSON.stringify({ source: "bio-55", type: "fork", revision: 4 }),
            },
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

  it("reads the Conductor source property on a copied page", () => {
    assert.deepEqual(pages[1].conductorSource, { source: "bio-55", type: "fork", revision: 4 });
    assert.equal(pages[3].conductorSource, null);
  });

  it("handles an empty response", () => {
    assert.deepEqual(flattenPageTree(undefined), []);
  });
});

describe("parseConductorSource", () => {
  it("rejects malformed or foreign values", () => {
    assert.equal(parseConductorSource("not json"), null);
    assert.equal(parseConductorSource(JSON.stringify({ source: "bio-55", type: "transclude-same" })), null);
    assert.equal(parseConductorSource(JSON.stringify({ source: "$where", type: "fork" })), null);
    assert.equal(parseConductorSource(undefined), null);
  });
});
