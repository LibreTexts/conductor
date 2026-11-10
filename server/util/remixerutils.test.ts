import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertLibraryPagePath,
  bookRootPathSegment,
  extractPagePath,
  sanitizeRemixerUriEnding,
  stripReservedPathChars,
  toCanonicalPageUrl,
} from "./remixerutils.js";

// The client runs the same cases against its mirrors in
// client/src/components/remixer/pathRule.test.ts. Change both together.

describe("path rule: & and ? are dropped (MindTouch only serves them as ?title=), : is kept", () => {
  it("stripReservedPathChars", () => {
    assert.equal(stripReservedPathChars("A&B: why?"), "AB: why");
    assert.equal(stripReservedPathChars("a/b\\c#d%e+f\"g'h<i>j|k{l}m^n[o]p`q"), "abcdefghijklmnopq");
  });

  it("bookRootPathSegment keeps master's cover-slug style and drops reserved characters", () => {
    // Master's mapping: spaces → "-", then ":" "." "-" → "_".
    assert.equal(bookRootPathSegment("Chem 101: Intro"), "chem_101__intro");
    assert.equal(bookRootPathSegment("Self-Advocacy, Vol. 2"), "self_advocacy,_vol__2");
    // The bug this branch fixes: "&" must never reach the path.
    assert.equal(bookRootPathSegment("Reading & Writing"), "reading__writing");
    assert.equal(bookRootPathSegment("Why? 100%"), "why_100");
    assert.equal(bookRootPathSegment("&&&"), "book");
  });

  it("sanitizeRemixerUriEnding drops & and ?, keeps :, and heals encoded values", () => {
    assert.equal(sanitizeRemixerUriEnding("01:_Q&A_why?"), "01:_QA_why");
    assert.equal(sanitizeRemixerUriEnding("01%3A_Intro"), "01:_Intro");
    assert.equal(sanitizeRemixerUriEnding("a/b#c d"), "abcd");
    assert.equal(sanitizeRemixerUriEnding(".."), undefined);
  });
});

describe("toCanonicalPageUrl", () => {
  it("turns the ?title= form into a %-encoded pathname", () => {
    assert.equal(
      toCanonicalPageUrl(
        "https://human.libretexts.org/?title=Workbench/esl_reading_%26_writing/00%3A_Front_Matter",
      ),
      "https://human.libretexts.org/Workbench/esl_reading_%26_writing/00%3A_Front_Matter",
    );
    assert.equal(
      toCanonicalPageUrl("https://dev.libretexts.org/?title=Book/Why%3F"),
      "https://dev.libretexts.org/Book/Why%3F",
    );
  });

  it("keeps % and + as written in the library path", () => {
    assert.equal(
      toCanonicalPageUrl("https://chem.libretexts.org/?title=Book/50%25_Off"),
      "https://chem.libretexts.org/Book/50%25_Off",
    );
    // A raw "+" is a plus sign in a page path, never a space.
    assert.equal(
      toCanonicalPageUrl("https://eng.libretexts.org/?title=Book/C++_Programming"),
      "https://eng.libretexts.org/Book/C%2B%2B_Programming",
    );
    // A bare "%" that is not an escape is kept, not thrown on.
    assert.equal(
      toCanonicalPageUrl("https://chem.libretexts.org/?title=Book/50%_Off"),
      "https://chem.libretexts.org/Book/50%25_Off",
    );
  });

  it("leaves pathname, API and placeholder URLs alone", () => {
    const pathname = "https://chem.libretexts.org/Bookshelves/Book/01%3A_Intro";
    assert.equal(toCanonicalPageUrl(pathname), pathname);
    const api = "https://chem.libretexts.org/@api/deki/pages/12?redirects=0";
    assert.equal(toCanonicalPageUrl(api), api);
    assert.equal(toCanonicalPageUrl("#"), "#");
    assert.equal(toCanonicalPageUrl(""), "");
  });

  it("agrees with extractPagePath, and the result passes the path guard", () => {
    const query = "https://human.libretexts.org/?title=Workbench/a_%26_b";
    assert.equal(extractPagePath(query), "Workbench/a_%26_b");
    const path = decodeURIComponent(extractPagePath(toCanonicalPageUrl(query)));
    assert.equal(path, "Workbench/a_&_b");
    assert.doesNotThrow(() => assertLibraryPagePath(`${path}/01:_Intro`));
  });
});
