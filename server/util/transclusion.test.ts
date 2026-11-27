import { describe, it } from "node:test";
import assert from "node:assert/strict";
import RemixerTemplates from "./CXOne/CXOneRemixerTemplates.js";
import { detectTranscludeStub, extractReuseRefs } from "./transclusion.js";

describe("extractReuseRefs", () => {
  it("reads the same-library stub Remixer writes as one ref", () => {
    const body = RemixerTemplates.POST_TranscludeSameLibrary(
      "Bookshelves/Chemistry/1.1:_Atoms",
      [],
    );
    assert.deepEqual(extractReuseRefs(body), [
      { kind: "same-library", path: "Bookshelves/Chemistry/1.1:_Atoms" },
    ]);
  });

  it("reads the cross-library stub Remixer writes", () => {
    const body = RemixerTemplates.POST_TranscludeCrossLibrary(
      "bio",
      777,
      "https://bio.libretexts.org/Bookshelves/X",
      [],
    );
    assert.deepEqual(extractReuseRefs(body), [
      { kind: "cross-library", subdomain: "bio", pageID: 777 },
    ]);
  });

  it("lists every embedded block in an authored page, with sections", () => {
    const body = `
      <p>Authored introduction.</p>
      <div class="mt-contentreuse-widget" data-page="Shared/Definitions" data-section="Mole" data-show="false">
        <pre class="script">wiki.page("Shared/Definitions", "Mole");</pre>
      </div>
      <pre class="script">template('CrossTransclude/Web',{'Library':'phys','PageID':12});</pre>
      <pre class="script">wiki.page("Shared/Prereqs", NULL);</pre>`;
    assert.deepEqual(extractReuseRefs(body), [
      { kind: "same-library", path: "Shared/Definitions", section: "Mole" },
      { kind: "cross-library", subdomain: "phys", pageID: 12 },
      { kind: "same-library", path: "Shared/Prereqs" },
    ]);
  });

  it("does not report the same ref twice", () => {
    const block = `<pre class="script">wiki.page("Shared/A", NULL);</pre>`;
    assert.equal(extractReuseRefs(block + block).length, 1);
  });

  it("ignores reuse markup inside an HTML comment", () => {
    const body = `<p>Text</p><!-- <pre class="script">wiki.page("Old/Page", NULL);</pre> -->`;
    assert.deepEqual(extractReuseRefs(body), []);
  });

  it("returns nothing for a page without reuse", () => {
    assert.deepEqual(extractReuseRefs("<p>Just text.</p>"), []);
    assert.deepEqual(extractReuseRefs(""), []);
  });

  it("agrees with detectTranscludeStub on a stub's single source", () => {
    const body = RemixerTemplates.POST_TranscludeSameLibrary("Shared/A", []);
    const stub = detectTranscludeStub(body);
    assert.deepEqual(stub, { kind: "same-library", path: "Shared/A" });
    assert.equal(extractReuseRefs(body).length, 1);
  });
});
