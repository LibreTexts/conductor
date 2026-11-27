import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  previousRevision,
  revisionHistory,
  sanitizeRevisionContent,
  sanitizeRevisionDiff,
} from "./revision-diff.js";

describe("sanitizeRevisionDiff", () => {
  it("keeps text structure and the change marks", () => {
    assert.equal(
      sanitizeRevisionDiff('<p><ins>Test.</ins></p><p><span><del>old</del></span></p>'),
      "<p><ins>Test.</ins></p><p><span><del>old</del></span></p>",
    );
  });

  it("removes scripts, handlers, styles and embeds", () => {
    const out = sanitizeRevisionDiff(
      '<p onclick="x()" style="color:red">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)><iframe src="https://e.com"></iframe>',
    );
    assert.equal(out, "<p>Hi</p>");
  });

  it("keeps only http(s) links and opens them in a new tab", () => {
    assert.equal(
      sanitizeRevisionDiff('<a href="javascript:alert(1)">a</a><a href="https://x.org">b</a>'),
      // The unsafe link loses its href (the leftover target/rel are inert).
      '<a target="_blank" rel="noopener noreferrer">a</a><a href="https://x.org" target="_blank" rel="noopener noreferrer">b</a>',
    );
  });
});

describe("revisionHistory", () => {
  const raw = [8, 9, 10, 11].map((n) => ({
    "@revision": String(n),
    "date.edited": "Wed, 11 Nov 2026 18:40:53 GMT",
    description: `${n} words added`,
    "uri.ui": "https://dev.libretexts.org/Page",
    "user.author": { fullname: "Ada Lovelace", username: "ada" },
  }));

  it("lists every revision newest first, marking the change's own", () => {
    const list = revisionHistory(raw, 8, 10);
    assert.deepEqual(list.map((r) => [r.revision, r.inChange]), [[11, false], [10, true], [9, true], [8, false]]);
    assert.deepEqual(list[1], {
      revision: 10,
      editedAt: "2026-11-11T18:40:53.000Z",
      author: "Ada Lovelace",
      summary: "10 words added",
      inChange: true,
    });
  });

  it("marks only the new revision when the previous one is unknown", () => {
    assert.deepEqual(revisionHistory(raw, undefined, 11).filter((r) => r.inChange).map((r) => r.revision), [11]);
  });

  it("marks nothing without a revision (a deletion)", () => {
    assert.equal(revisionHistory(raw, 8, undefined).some((r) => r.inChange), false);
  });

  it("caps the list but keeps the change's revisions when they are older", () => {
    assert.deepEqual(revisionHistory(raw, 7, 8, 2).map((r) => r.revision), [11, 10, 8]);
  });
});

describe("previousRevision", () => {
  const raw = [1, 2, 5].map((n) => ({ "@revision": String(n) }));
  it("is the closest older revision, or null for the first", () => {
    assert.equal(previousRevision(raw, 5), 2);
    assert.equal(previousRevision(raw, 1), null);
  });
});

describe("sanitizeRevisionContent", () => {
  const origin = "https://chem.libretexts.org";

  it("resolves relative images and links against the library", () => {
    assert.equal(
      sanitizeRevisionContent('<p><img src="/@api/deki/files/1/a.png" alt="Atom"> <a href="/Bookshelves/X">x</a></p>', origin),
      '<p><img src="https://chem.libretexts.org/@api/deki/files/1/a.png" alt="Atom" /> <a href="https://chem.libretexts.org/Bookshelves/X" target="_blank" rel="noopener noreferrer">x</a></p>',
    );
  });

  it("drops images that aren't https and anything scriptable", () => {
    const out = sanitizeRevisionContent(
      '<p class="lt-chem-1" style="color:red" onclick="x()">Hi<script>alert(1)</script></p><img src="http://e.com/x.png"><img src="javascript:alert(1)"><iframe src="https://e.com"></iframe>',
      origin,
    );
    assert.equal(out, "<p>Hi</p>");
  });
});
