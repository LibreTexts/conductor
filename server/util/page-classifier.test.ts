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
});
