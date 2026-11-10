import {
  detectTranscludeStub,
  extractReuseRefs,
  type ReuseRef,
} from "./transclusion.js";
import { fingerprintPage, type PageFingerprint } from "./content-fingerprint.js";

/**
 * What a page's own markup says about it. `fork` and `full` never appear here:
 * a copy carries no marker, so those kinds come from Remixer records, page
 * properties or fingerprint matches, not from reading the page.
 */
export type ContentKind = "original" | "transclude" | "mixed" | "structural";

/** Tags of pages that organize a book rather than hold authored content. */
const STRUCTURAL_TAGS = new Set([
  "article:topic-category",
  "article:topic-guide",
  "coverpage:yes",
]);

export type PageClassification = {
  kind: ContentKind;
  /** The page is nothing but a pointer at one other page. */
  isStub: boolean;
  /** Every reuse block in the page, in document order. */
  refs: ReuseRef[];
  /**
   * Fingerprints of the page's own text. Empty for a stub, which has no text
   * of its own.
   */
  fingerprint: PageFingerprint;
};

const NO_FINGERPRINT: PageFingerprint = {
  wordCount: 0,
  contentHash: null,
  simBands: null,
};

/**
 * Classifies a page from its raw body and tags.
 *
 * Order matters: a pure pointer is a transclusion whatever its tags say;
 * otherwise organizing pages are structural even when they embed reuse blocks;
 * otherwise any reuse block makes an authored page mixed.
 */
export const classifyPageContent = (
  rawContents: string,
  tags: string[] = [],
): PageClassification => {
  const refs = extractReuseRefs(rawContents);

  if (detectTranscludeStub(rawContents) !== null) {
    return { kind: "transclude", isStub: true, refs, fingerprint: NO_FINGERPRINT };
  }

  const fingerprint = fingerprintPage(rawContents);
  let kind: ContentKind;
  if (tags.some((tag) => STRUCTURAL_TAGS.has(tag))) {
    kind = "structural";
  } else if (refs.length > 0) {
    kind = "mixed";
  } else if (fingerprint.wordCount === 0) {
    // No text and no reuse: an empty or media-only shell.
    kind = "structural";
  } else {
    kind = "original";
  }

  return { kind, isStub: false, refs, fingerprint };
};
