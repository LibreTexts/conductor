import { model, Schema } from "mongoose";

/**
 * One library page in the provenance graph. Kept deliberately small (no HTML,
 * no long arrays) because there is one document per page across every
 * library: millions of documents.
 *
 * `kind` describes the page's content as last scanned:
 * - `original`: owns its content, no reuse markup.
 * - `transclude`: a pure pointer at another page (whole-page transclusion).
 * - `fork` / `full`: a one-time copy of another page (known from Remixer, a
 *   page property, or a fingerprint match; the HTML itself carries no marker).
 * - `mixed`: own content plus embedded reuse blocks.
 * - `structural`: TOC, guide, cover or empty pages with no authored content.
 * - `unknown`: not scanned yet, or the scan could not read the page.
 */
export const PAGE_NODE_KINDS = [
  "original",
  "transclude",
  "fork",
  "full",
  "mixed",
  "structural",
  "unknown",
] as const;
export type PageNodeKind = (typeof PAGE_NODE_KINDS)[number];

export interface PageNodeInterface {
  /** `${lib}-${pageID}`; see `pageNodeId`. */
  _id: string;
  lib: string;
  pageID: number;
  /** The book (coverpage) the page belongs to, `${lib}-${coverID}`. */
  bookID?: string | null;
  parentID?: number | null;
  path?: string;
  title?: string;
  kind: PageNodeKind;
  /** Number of active outgoing reuse edges. */
  reuseCount: number;
  /** Ultimate origin of the page's content; null when it owns its content. */
  rootSource?: string | null;
  /** 0 = own content, 1 = direct reuse, 2 = A → B → C, ... */
  reuseDepth?: number;
  /** The page's whole-page chain loops back on itself. */
  reuseCycle?: boolean;
  /** 16-byte SHA-256 prefix of the page's normalized own text. */
  contentHash?: Buffer | null;
  /** 64-bit SimHash as four index-tagged 16-bit bands; see content-fingerprint. */
  simBands?: number[] | null;
  wordCount?: number;
  /** MindTouch revision number at the last scan. */
  revision?: number;
  modifiedAt?: Date;
  scannedAt?: Date;
  deletedAt?: Date | null;
}

const PageNodeSchema = new Schema<PageNodeInterface>(
  {
    _id: { type: String, required: true },
    lib: { type: String, required: true },
    pageID: { type: Number, required: true },
    bookID: { type: String, default: null },
    parentID: { type: Number, default: null },
    path: { type: String },
    title: { type: String },
    kind: { type: String, enum: PAGE_NODE_KINDS, default: "unknown" },
    reuseCount: { type: Number, default: 0 },
    rootSource: { type: String, default: null },
    reuseDepth: { type: Number },
    reuseCycle: { type: Boolean },
    contentHash: { type: Buffer, default: null },
    simBands: { type: [Number], default: undefined },
    wordCount: { type: Number },
    revision: { type: Number },
    modifiedAt: { type: Date },
    scannedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

// Per-book breakdowns and page listings.
PageNodeSchema.index({ bookID: 1, kind: 1 });
// Incremental scans: what changed in a library since a point in time.
PageNodeSchema.index({ lib: 1, modifiedAt: -1 });
// Exact-copy detection.
PageNodeSchema.index({ contentHash: 1 }, { sparse: true });
// Near-copy candidates (LSH buckets). Multikey over the four bands.
PageNodeSchema.index({ simBands: 1 }, { sparse: true });
// "Which pages ultimately come from X?"
PageNodeSchema.index({ rootSource: 1 }, { sparse: true });

const PageNode = model<PageNodeInterface>("PageNode", PageNodeSchema, "pagenodes");

export default PageNode;
