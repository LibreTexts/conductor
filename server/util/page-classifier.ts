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

/** Library tags of pages that organize a book rather than hold authored content. */
const STRUCTURAL_TAGS = new Set([
  "article:topic-category",
  "article:topic-guide",
  "coverpage:yes",
]);

export type ClassifyPageOptions = {
  /**
   * The page is a Front/Back Matter container or one of the standard pages
   * generated into it (TitlePage, Index, …), as worked out from the page tree
   * (see `TreePageInfo.isGeneratedMatter`). Kept separate from `tags`, which
   * are only ever the library's own tags.
   */
  generatedMatter?: boolean;
};

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
  { generatedMatter = false }: ClassifyPageOptions = {},
): PageClassification => {
  // Generated matter wins even over a transclusion: the batch service's
  // standard InfoPage transcludes one shared page into every book, and
  // recording that as reuse would link every book to it (and notify every
  // project whenever it changes). It is boilerplate, not reuse: no refs.
  if (generatedMatter) {
    return { kind: "structural", isStub: false, refs: [], fingerprint: NO_FINGERPRINT };
  }

  const refs = extractReuseRefs(rawContents);

  if (detectTranscludeStub(rawContents) !== null) {
    return { kind: "transclude", isStub: true, refs, fingerprint: NO_FINGERPRINT };
  }

  // Organizing and generated pages are the same boilerplate in every book, so
  // they get no fingerprint: matching them across books would report
  // thousands of false copies.
  if (tags.some((tag) => STRUCTURAL_TAGS.has(tag))) {
    return { kind: "structural", isStub: false, refs, fingerprint: NO_FINGERPRINT };
  }

  const fingerprint = fingerprintPage(rawContents);
  let kind: ContentKind;
  if (refs.length > 0) {
    kind = "mixed";
  } else if (fingerprint.wordCount === 0) {
    // No text and no reuse: an empty or media-only shell.
    kind = "structural";
  } else {
    kind = "original";
  }

  return { kind, isStub: false, refs, fingerprint };
};
