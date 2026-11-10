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

describe("path rule: & : ? are kept, the rest of the reserved set is dropped", () => {
  it("stripReservedPathChars", () => {
    assert.equal(stripReservedPathChars("A&B: why?"), "A&B: why?");
    assert.equal(stripReservedPathChars("a/b\\c#d%e+f\"g'h<i>j|k{l}m^n[o]p`q"), "abcdefghijklmnopq");
  });

  it("bookRootPathSegment keeps & : ? and drops path-breaking characters", () => {
    assert.equal(bookRootPathSegment("Reading & Writing"), "reading_&_writing");
    assert.equal(bookRootPathSegment("Chem: Why? 100%"), "chem:_why?_100");
    assert.equal(bookRootPathSegment("  a / b # c  "), "a_b_c");
    assert.equal(bookRootPathSegment("%%%"), "book");
  });

  it("sanitizeRemixerUriEnding keeps & : ? and heals encoded values", () => {
    assert.equal(sanitizeRemixerUriEnding("01:_Q&A_why?"), "01:_Q&A_why?");
    assert.equal(sanitizeRemixerUriEnding("01%3A_Q%26A"), "01:_Q&A");
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
