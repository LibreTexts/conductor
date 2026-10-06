import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareCitations,
  extractCitationKeys,
  rewriteCitationKeys,
  workIdentity,
} from "./referenceCitations.js";

describe("compareCitations", () => {
  const entries = [
    { referenceID: "r1", citationKey: "smith2020", title: "Cited" },
    { referenceID: "r2", citationKey: "lee2019", title: "Never cited" },
  ];
  const page = (pageID: string, keys: string[], title = `Page ${pageID}`) => ({
    pageID,
    title,
    references: keys.map((key) => ({ key })),
  });

  it("lists cited keys with no reference, with every page citing them", () => {
    const check = compareCitations(
      [page("1", ["smith2020", "ghost"]), page("2", ["ghost"])],
      entries,
    );
    assert.deepEqual(check.missing, [
      {
        key: "ghost",
        pages: [
          { pageID: "1", title: "Page 1" },
          { pageID: "2", title: "Page 2" },
        ],
      },
    ]);
  });

  it("lists references no page cites", () => {
    const check = compareCitations([page("1", ["smith2020"])], entries);
    assert.deepEqual(check.unused, [
      { referenceID: "r2", citationKey: "lee2019", title: "Never cited" },
    ]);
  });

  it("uses the latest entry for a page recorded more than once", () => {
    const check = compareCitations(
      [page("1", ["old"]), page("1", ["smith2020", "lee2019"])],
      entries,
    );
    assert.deepEqual(check, { missing: [], unused: [] });
  });

  it("reports everything as unused when nothing is cited", () => {
    const check = compareCitations([], entries);
    assert.equal(check.missing.length, 0);
    assert.equal(check.unused.length, 2);
  });
});

describe("extractCitationKeys", () => {
  it("returns unique keys in order of first appearance", () => {
    const html = String.raw`<p>\librecite{b} then \librecite{a, b,c}</p>`;
    assert.deepEqual(extractCitationKeys(html), ["b", "a", "c"]);
  });

  it("ignores text without the backslash", () => {
    assert.deepEqual(extractCitationKeys("librecite{a}"), []);
  });

  it("drops malformed keys", () => {
    const html = String.raw`\librecite{good, bad key, <x>}`;
    assert.deepEqual(extractCitationKeys(html), ["good"]);
  });
});

describe("rewriteCitationKeys", () => {
  it("renames keys only inside citations, keeping spacing", () => {
    const html = String.raw`See \librecite{smith2020} and \librecite{lee, smith2020,x}. Plain smith2020 stays.`;
    assert.equal(
      rewriteCitationKeys(html, { smith2020: "smith2020a" }),
      String.raw`See \librecite{smith2020a} and \librecite{lee, smith2020a,x}. Plain smith2020 stays.`,
    );
  });

  it("leaves content unchanged when there is nothing to rename", () => {
    const html = String.raw`\librecite{a}`;
    assert.equal(rewriteCitationKeys(html, {}), html);
  });
});

describe("workIdentity", () => {
  it("matches the same DOI written differently", () => {
    assert.equal(
      workIdentity({ doi: "https://doi.org/10.1000/ABC" }),
      workIdentity({ doi: "10.1000/abc" }),
    );
  });

  it("falls back to the URL, ignoring scheme, case and trailing slash", () => {
    assert.equal(
      workIdentity({ url: "http://Ex.org/a/" }),
      workIdentity({ url: "https://ex.org/a" }),
    );
  });

  it("is null without a DOI or URL", () => {
    assert.equal(workIdentity({}), null);
  });
});
