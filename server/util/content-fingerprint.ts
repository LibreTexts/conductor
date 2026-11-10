import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { unwrapPageBody } from "./transclusion.js";

/**
 * Content fingerprints for the page provenance graph.
 *
 * Two fingerprints per page, both computed from the page's *own* visible text
 * (reuse blocks, DekiScript and template scaffolding stripped):
 *
 * - `contentHash`: 16 bytes of SHA-256 over the normalized text. Equal hashes
 *   mean the same text, which finds exact copies (forks that were never edited).
 * - `simBands`: a 64-bit SimHash over word 3-shingles, stored as four 16-bit
 *   bands. Near-identical texts differ in few bits, so a fork that was lightly
 *   edited still shares at least one band with its source. A multikey index on
 *   the bands turns "find similar pages" into bucket lookups (LSH) instead of an
 *   all-pairs comparison over millions of pages.
 *
 * The four bands together *are* the full 64-bit SimHash, so nothing else needs
 * storing to confirm a candidate pair by Hamming distance.
 */

/** Elements that are page machinery, not authored text. */
const NON_CONTENT_SELECTORS = [
  'p[class~="template:tag-insert"]',
  "p.mt-script-comment",
  "div.comment",
  "div.mt-contentreuse-widget",
  ".mt-guide-content",
  "pre.script",
  "script",
  "style",
];

/**
 * Elements that separate words visually. A space is inserted around each so
 * `<p>a</p><p>b</p>` reads as "a b" rather than "ab", which keeps the text the
 * same however the editor happened to wrap it. Inline elements (`<b>`, `<a>`)
 * are left alone so `chem<b>istry</b>` stays one word.
 */
const WORD_BREAK_SELECTORS = [
  "address", "article", "aside", "blockquote", "br", "caption", "dd", "div",
  "dl", "dt", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5",
  "h6", "header", "hr", "li", "ol", "p", "pre", "section", "table", "tbody",
  "td", "tfoot", "th", "thead", "tr", "ul",
].join(",");

/**
 * Below this many words a page has too little text for a meaningful SimHash:
 * short stubs, headings-only pages and boilerplate would all collide.
 */
export const MIN_FINGERPRINT_WORDS = 20;

/** Words per shingle. Three keeps word order significant without being brittle. */
const SHINGLE_SIZE = 3;

const BAND_BITS = 16;
const BAND_COUNT = 4;
const BAND_SPAN = 1 << BAND_BITS;

/**
 * Reduces a page body to its own visible words: lower case, NFKC, letters and
 * digits only, single spaces. Returns "" for a page with no text of its own.
 */
export const normalizePageText = (rawContents: string): string => {
  const html = unwrapPageBody(rawContents);
  if (!html.trim()) return "";

  const $ = cheerio.load(html, null, false);
  $.root()
    .find("*")
    .addBack()
    .contents()
    .filter((_, node) => node.type === "comment")
    .remove();
  $(NON_CONTENT_SELECTORS.join(",")).remove();
  $(WORD_BREAK_SELECTORS).each((_, el) => {
    $(el).before(" ").after(" ");
  });

  return ($.root().text() ?? "")
    // DekiScript template calls, e.g. {{template.ShowOrg()}}.
    .replace(/\{\{[\s\S]*?\}\}/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
};

/** 16-byte SHA-256 prefix of normalized text, or null for empty text. */
export const contentHash = (normalizedText: string): Buffer | null => {
  if (!normalizedText) return null;
  return createHash("sha256").update(normalizedText, "utf8").digest().subarray(0, 16);
};

const FNV_PRIME = 16777619;
const FNV_OFFSET_LO = 2166136261;
// A second, unrelated offset basis so the two 32-bit halves are independent.
const FNV_OFFSET_HI = 3735928559;

const fnv1a32 = (value: string, offset: number): number => {
  let hash = offset >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
};

/** MurmurHash3's 32-bit finalizer: spreads FNV's weak low-bit mixing. */
const fmix32 = (input: number): number => {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
};

/** A 64-bit SimHash as two unsigned 32-bit halves. */
export type SimHash64 = { hi: number; lo: number };

/**
 * SimHash over word shingles of normalized text, or null when the text is too
 * short to fingerprint reliably (see {@link MIN_FINGERPRINT_WORDS}).
 */
export const simhash64 = (normalizedText: string): SimHash64 | null => {
  const words = normalizedText ? normalizedText.split(" ") : [];
  if (words.length < MIN_FINGERPRINT_WORDS) return null;

  const weights = new Int32Array(64);
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i += 1) {
    const shingle = words.slice(i, i + SHINGLE_SIZE).join(" ");
    const lo = fmix32(fnv1a32(shingle, FNV_OFFSET_LO));
    const hi = fmix32(fnv1a32(shingle, FNV_OFFSET_HI));
    for (let bit = 0; bit < 32; bit += 1) {
      weights[bit] += (lo >>> bit) & 1 ? 1 : -1;
      weights[32 + bit] += (hi >>> bit) & 1 ? 1 : -1;
    }
  }

  let lo = 0;
  let hi = 0;
  for (let bit = 0; bit < 32; bit += 1) {
    if (weights[bit] > 0) lo |= 1 << bit;
    if (weights[32 + bit] > 0) hi |= 1 << bit;
  }
  return { hi: hi >>> 0, lo: lo >>> 0 };
};

/**
 * Splits a SimHash into four 16-bit bands, each tagged with its band index
 * (`index * 65536 + value`) so equal values in different bands never collide
 * in the shared multikey index.
 */
export const toSimBands = ({ hi, lo }: SimHash64): number[] => [
  0 * BAND_SPAN + (lo & 0xffff),
  1 * BAND_SPAN + (lo >>> 16),
  2 * BAND_SPAN + (hi & 0xffff),
  3 * BAND_SPAN + (hi >>> 16),
];

/** Inverse of {@link toSimBands}. Returns null for a malformed band list. */
export const fromSimBands = (bands: number[]): SimHash64 | null => {
  if (!Array.isArray(bands) || bands.length !== BAND_COUNT) return null;
  // Filled with null, not left sparse: `some` skips holes, so a list that
  // repeats one band index would otherwise pass the completeness check.
  const values: (number | null)[] = Array.from({ length: BAND_COUNT }, () => null);
  for (const band of bands) {
    const index = Math.floor(band / BAND_SPAN);
    if (index < 0 || index >= BAND_COUNT || values[index] !== null) return null;
    values[index] = band - index * BAND_SPAN;
  }
  if (values.some((v) => v === null)) return null;
  const [b0, b1, b2, b3] = values as number[];
  return {
    lo: ((b1 << 16) | b0) >>> 0,
    hi: ((b3 << 16) | b2) >>> 0,
  };
};

const popcount32 = (value: number): number => {
  let v = value >>> 0;
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff;
};

/** Number of differing bits between two SimHashes (0–64). */
export const simhashDistance = (a: SimHash64, b: SimHash64): number =>
  popcount32(a.hi ^ b.hi) + popcount32(a.lo ^ b.lo);

export type PageFingerprint = {
  /** Words of own text after normalization. */
  wordCount: number;
  contentHash: Buffer | null;
  simBands: number[] | null;
};

/** Computes both fingerprints for a page body in one pass. */
export const fingerprintPage = (rawContents: string): PageFingerprint => {
  const text = normalizePageText(rawContents);
  const simhash = simhash64(text);
  return {
    wordCount: text ? text.split(" ").length : 0,
    contentHash: contentHash(text),
    simBands: simhash ? toSimBands(simhash) : null,
  };
};
