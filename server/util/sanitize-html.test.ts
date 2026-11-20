import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRichHtml } from "./sanitize-html.js";

describe("sanitizeRichHtml", () => {
  it("strips scripts, event handlers, and javascript: links", () => {
    const output = sanitizeRichHtml(
      '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a>'
    );
    assert.doesNotMatch(output, /<script/i);
    assert.doesNotMatch(output, /onerror/i);
    assert.doesNotMatch(output, /javascript:/i);
    assert.match(output, /<p>Hi<\/p>/);
  });

  it("keeps embeds and classes CKEditor emits", () => {
    const output = sanitizeRichHtml(
      '<figure class="media"><oembed url="https://www.youtube.com/watch?v=abc"></oembed></figure><iframe src="https://example.com" allowfullscreen=""></iframe>'
    );
    assert.match(output, /<figure class="media">/);
    assert.match(output, /<oembed url="https:\/\/www\.youtube\.com\/watch\?v=abc">/);
    assert.match(output, /<iframe[^>]*allowfullscreen/);
  });
});
