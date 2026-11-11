import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { revisionsBetween, sanitizeRevisionDiff } from "./revision-diff.js";

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

describe("revisionsBetween", () => {
  const raw = [8, 9, 10, 11].map((n) => ({
    "@revision": String(n),
    "date.edited": "Wed, 11 Nov 2026 18:40:53 GMT",
    description: `${n} words added`,
    "uri.ui": "https://dev.libretexts.org/Page",
    "user.author": { fullname: "Ada Lovelace", username: "ada" },
  }));

  it("lists the revisions after fromRev up to toRev, newest first", () => {
    const list = revisionsBetween(raw, 8, 10);
    assert.deepEqual(list.map((r) => r.revision), [10, 9]);
    assert.deepEqual(list[0], {
      revision: 10,
      editedAt: "2026-11-11T18:40:53.000Z",
      author: "Ada Lovelace",
      summary: "10 words added",
      url: "https://dev.libretexts.org/Page?revision=10",
    });
  });

  it("shows only the new revision when the previous one is unknown", () => {
    assert.deepEqual(revisionsBetween(raw, undefined, 11).map((r) => r.revision), [11]);
  });

  it("lists nothing without a revision to show (a deletion)", () => {
    assert.deepEqual(revisionsBetween(raw, 8, undefined), []);
  });
});
