import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidCitationKey,
  normalizeDoi,
  normalizeHttpUrl,
  sanitizeReferenceField,
  sanitizeReferenceText,
} from "./referenceSanitize.js";

describe("sanitizeReferenceText", () => {
  const injections: [string, string][] = [
    ["Intro<script>alert(1)</script> to Bio", "Introalert(1) to Bio"],
    ["<img src=x onerror=alert(1)>Title", "Title"],
    ["<svg/onload=alert(1)>X", "X"],
    ["Title <img src=x onerror=alert(1)", "Title"],
    ["A<!-- <script>x</script> -->B", "AB"],
  ];
  for (const [input, expected] of injections) {
    it(`makes ${JSON.stringify(input)} inert`, () => {
      const output = sanitizeReferenceText(input);
      assert.equal(output, expected);
      assert.doesNotMatch(output, /[<>]/);
    });
  }

  it("keeps comparisons readable without real angle brackets", () => {
    const output = sanitizeReferenceText("p < 0.05 and x > y");
    assert.doesNotMatch(output, /[<>]/);
    assert.match(output, /^p . 0\.05 and x . y$/);
  });

  it("keeps ordinary punctuation", () => {
    assert.equal(sanitizeReferenceText("Smith & Jones: “A, B”"), "Smith & Jones: “A, B”");
  });

  it("drops bidi overrides and control characters", () => {
    const rlo = String.fromCharCode(0x202e);
    const nul = String.fromCharCode(0);
    assert.equal(sanitizeReferenceText(`abc${rlo}def${nul}`), "abcdef");
  });

  it("collapses whitespace and caps the length", () => {
    assert.equal(sanitizeReferenceText("  a\n\n b\t c  "), "a b c");
    assert.equal(sanitizeReferenceText("x".repeat(50), 10).length, 10);
  });

  it("is idempotent", () => {
    const once = sanitizeReferenceText("a < b <i>c</i>");
    assert.equal(sanitizeReferenceText(once), once);
  });
});

describe("normalizeHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    assert.equal(normalizeHttpUrl(" https://ex.org/a?b=1 "), "https://ex.org/a?b=1");
  });
  it("rejects script and data URLs", () => {
    assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
    assert.equal(normalizeHttpUrl("data:text/html,x"), null);
    assert.equal(normalizeHttpUrl("not a url"), null);
  });
  it("allows clearing the field", () => {
    assert.equal(normalizeHttpUrl(""), "");
  });
});

describe("normalizeDoi", () => {
  it("strips doi.org and doi: prefixes", () => {
    assert.equal(normalizeDoi("https://doi.org/10.1000/ABC.1"), "10.1000/ABC.1");
    assert.equal(normalizeDoi("doi: 10.1000/x"), "10.1000/x");
  });
  it("rejects values that aren't DOIs", () => {
    assert.equal(normalizeDoi("10.1/<script>"), null);
    assert.equal(normalizeDoi("not a doi"), null);
  });
});

describe("isValidCitationKey", () => {
  it("accepts BibTeX-style keys", () => {
    for (const key of ["smith2020", "Smith:2020-a", "a.b+c/d_e"]) {
      assert.ok(isValidCitationKey(key), key);
    }
  });
  it("rejects keys that could break markup or citations", () => {
    for (const key of ["", "a b", "x}y", "a,b", "<img>", "_lead", "k".repeat(101)]) {
      assert.ok(!isValidCitationKey(key), key);
    }
  });
});

describe("sanitizeReferenceField", () => {
  it("drops invalid URLs and DOIs instead of serving them", () => {
    assert.equal(sanitizeReferenceField("url", "javascript:alert(1)"), "");
    assert.equal(sanitizeReferenceField("doi", "nonsense"), "");
  });
  it("cleans other fields as text", () => {
    assert.equal(sanitizeReferenceField("title", "<b>Bold</b> move"), "Bold move");
  });
});
