import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectCitations,
  extractCitationKeys,
  rewriteCitationKeys,
  workIdentity,
} from "./referenceCitations.js";

describe("collectCitations", () => {
  const page = (pageID: string, keys: string[], title = `Page ${pageID}`) => ({
    pageID,
    title,
    references: keys.map((key) => ({ key })),
  });

  it("collects each cited key with every page citing it", () => {
    assert.deepEqual(
      collectCitations([page("1", ["a", "b"]), page("2", ["a"])]),
      [
        {
          key: "a",
          pages: [
            { pageID: "1", title: "Page 1" },
            { pageID: "2", title: "Page 2" },
          ],
        },
        { key: "b", pages: [{ pageID: "1", title: "Page 1" }] },
      ],
    );
  });

  it("uses the latest entry for a page recorded more than once", () => {
    assert.deepEqual(collectCitations([page("1", ["old"]), page("1", ["new"])]), [
      { key: "new", pages: [{ pageID: "1", title: "Page 1" }] },
    ]);
  });

  it("is empty when nothing is cited", () => {
    assert.deepEqual(collectCitations([page("1", [])]), []);
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
