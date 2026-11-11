import { describe, it } from "node:test";
import assert from "node:assert/strict";
import RemixerTemplates from "./CXOne/CXOneRemixerTemplates.js";
import { classifyPageContent } from "./page-classifier.js";

const TEXT =
  "Authored paragraph with enough words to be fingerprinted reliably by the " +
  "provenance scanner, which ignores very short pages because their hashes " +
  "would collide with every other short page in the library.";

describe("classifyPageContent", () => {
  it("classifies a Remixer transclusion stub", () => {
    const result = classifyPageContent(
      RemixerTemplates.POST_TranscludeCrossLibrary("bio", 9, "https://bio.libretexts.org/x", []),
      ["transcluded:yes"],
    );
    assert.equal(result.kind, "transclude");
    assert.equal(result.isStub, true);
    assert.equal(result.refs.length, 1);
    assert.equal(result.fingerprint.contentHash, null);
  });

  it("classifies authored text as original, with fingerprints", () => {
    const result = classifyPageContent(`<p>${TEXT}</p>`);
    assert.equal(result.kind, "original");
    assert.ok(result.fingerprint.contentHash);
    assert.ok(result.fingerprint.simBands);
  });

  it("classifies authored text plus an embedded block as mixed", () => {
    const result = classifyPageContent(
      `<p>${TEXT}</p><pre class="script">wiki.page("Shared/Box", "Key");</pre>`,
    );
    assert.equal(result.kind, "mixed");
    assert.equal(result.isStub, false);
    assert.deepEqual(result.refs, [
      { kind: "same-library", path: "Shared/Box", section: "Key" },
    ]);
  });

  it("classifies organizing and empty pages as structural", () => {
    assert.equal(
      classifyPageContent(`<p>${TEXT}</p>`, ["article:topic-guide"]).kind,
      "structural",
    );
    assert.equal(classifyPageContent("<p>  </p>").kind, "structural");
  });

  it("treats generated matter as structural, with no fingerprint", () => {
    // Detailed Licensing / InfoPage carry real text, identical in every book.
    const result = classifyPageContent(`<p>${TEXT}</p>`, [], { generatedMatter: true });
    assert.equal(result.kind, "structural");
    assert.equal(result.fingerprint.contentHash, null);
    assert.equal(result.fingerprint.simBands, null);
  });

  it("does not record reuse for generated matter that transcludes a shared page", () => {
    // The standard InfoPage is a cross-library stub (dev-10864 → chem-170365).
    const infoPage = RemixerTemplates.POST_TranscludeCrossLibrary(
      "chem",
      170365,
      "https://chem.libretexts.org/x",
      [],
    );
    const result = classifyPageContent(infoPage, [], { generatedMatter: true });
    assert.equal(result.kind, "structural");
    assert.equal(result.isStub, false);
    assert.deepEqual(result.refs, []);
  });
});
