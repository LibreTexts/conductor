import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contentHash,
  fingerprintPage,
  fromSimBands,
  MIN_FINGERPRINT_WORDS,
  normalizePageText,
  simhash64,
  simhashDistance,
  toSimBands,
} from "./content-fingerprint.js";

const PARAGRAPH =
  "The mole is the amount of substance of a system which contains as many " +
  "elementary entities as there are atoms in twelve grams of carbon twelve. " +
  "Chemists use the mole to count particles by weighing them, because single " +
  "atoms are far too small to count one by one in any laboratory setting.";

const OTHER_PARAGRAPH =
  "Photosynthesis converts light energy into chemical energy stored in sugar. " +
  "Plants, algae and some bacteria capture sunlight with chlorophyll and use " +
  "it to split water, releasing oxygen as a by-product of the light reactions " +
  "that power the Calvin cycle in the stroma of the chloroplast.";

describe("normalizePageText", () => {
  it("gives the same text however the markup wraps it", () => {
    const a = "<p>Hello <b>World</b></p><p>again!</p>";
    const b = "<div>hello world</div>\n<div>  Again </div>";
    assert.equal(normalizePageText(a), "hello world again");
    assert.equal(normalizePageText(a), normalizePageText(b));
  });

  it("keeps inline-split words whole", () => {
    assert.equal(normalizePageText("<p>chem<b>istry</b></p>"), "chemistry");
  });

  it("drops reuse blocks, scripts, template tags and comments", () => {
    const body = `
      <p>{{template.ShowOrg()}}</p>
      <p class="template:tag-insert"><em>Tags recommended</em><a href="#">article:topic</a></p>
      <div class="mt-contentreuse-widget" data-page="X"><pre class="script">wiki.page("X", NULL);</pre></div>
      <!-- editor note -->
      <style>p { color: red }</style>
      <p>Own words.</p>`;
    assert.equal(normalizePageText(body), "own words");
  });

  it("unwraps the JSON envelope the contents API can return", () => {
    const envelope = JSON.stringify({ body: "<p>Inside</p>" });
    assert.equal(normalizePageText(envelope), "inside");
  });
});

describe("contentHash", () => {
  it("is 16 bytes, stable, and null for empty text", () => {
    const h1 = contentHash("same text");
    const h2 = contentHash("same text");
    assert.ok(h1 && h2);
    assert.equal(h1.length, 16);
    assert.ok(h1.equals(h2));
    assert.equal(contentHash(""), null);
  });
});

describe("simhash64", () => {
  it("is null for text shorter than the minimum", () => {
    const short = Array.from({ length: MIN_FINGERPRINT_WORDS - 1 }, (_, i) => `w${i}`).join(" ");
    assert.equal(simhash64(short), null);
  });

  it("stays close for a lightly edited copy and far for unrelated text", () => {
    const original = simhash64(normalizePageText(`<p>${PARAGRAPH}</p>`));
    const edited = simhash64(
      normalizePageText(`<p>${PARAGRAPH.replace("laboratory", "lab")}</p>`),
    );
    const unrelated = simhash64(normalizePageText(`<p>${OTHER_PARAGRAPH}</p>`));
    assert.ok(original && edited && unrelated);
    assert.ok(simhashDistance(original, edited) <= 12);
    assert.ok(simhashDistance(original, unrelated) > simhashDistance(original, edited));
  });
});

describe("toSimBands / fromSimBands", () => {
  it("round-trips and tags each band with its index", () => {
    const hash = { hi: 0xdeadbeef, lo: 0x01234567 };
    const bands = toSimBands(hash);
    assert.deepEqual(bands.map((b) => Math.floor(b / 65536)), [0, 1, 2, 3]);
    assert.deepEqual(fromSimBands(bands), hash);
  });

  it("rejects a malformed band list", () => {
    assert.equal(fromSimBands([1, 2, 3]), null);
    assert.equal(fromSimBands([0, 0, 0, 0]), null);
  });
});

describe("fingerprintPage", () => {
  it("fingerprints the same text in different markup identically", () => {
    const a = fingerprintPage(`<p>${PARAGRAPH}</p>`);
    const b = fingerprintPage(`<div><span>${PARAGRAPH}</span></div>`);
    assert.ok(a.contentHash && b.contentHash);
    assert.ok(a.contentHash.equals(b.contentHash));
    assert.deepEqual(a.simBands, b.simBands);
    assert.ok(a.wordCount >= MIN_FINGERPRINT_WORDS);
  });

  it("has no fingerprint for an empty page", () => {
    assert.deepEqual(fingerprintPage(""), {
      wordCount: 0,
      contentHash: null,
      simBands: null,
    });
  });
});
