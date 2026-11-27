import { model, Schema } from "mongoose";
import {
  REUSE_EDGE_TYPES,
  type ReuseEdgeType,
} from "../util/provenance-graph.js";

/** Pages a book shares with one other book, and how. */
export type BookReuseLink = {
  bookID: string;
  /** Distinct reusing pages on the reusing side. */
  pages: number;
  types: ReuseEdgeType[];
};

/**
 * Reuse whose source page belongs to no scanned book yet, from one library.
 * Lets the library views show it without reading the page-level edges.
 */
export type UnscannedSourceLink = {
  /** The source pages' library. */
  lib: string;
  /** Distinct pages of this book reusing them. */
  pages: number;
  types: ReuseEdgeType[];
};

/** Distinct pages of a book whose reused source changed (unreviewed) or broke. */
export type BookReuseAttention = {
  sourceChanged: number;
  broken: number;
};

/**
 * Precomputed per-book rollup of the provenance graph. Small (one document
 * per book) and read by the UI and the book connection graph, which never
 * touch the page-level collections directly.
 */
export interface BookReuseSummaryInterface {
  /** The Commons bookID, `${lib}-${coverID}`. */
  bookID: string;
  lib: string;
  totals: {
    pages: number;
    original: number;
    transclude: number;
    fork: number;
    full: number;
    mixed: number;
    structural: number;
    unknown: number;
    /** Pages whose content comes through a chain (reuseDepth ≥ 2). */
    viaChain: number;
  };
  /** Books this book reuses content from. */
  upstream: BookReuseLink[];
  /** Books that reuse content from this book. */
  downstream: BookReuseLink[];
  /**
   * Reuse from books not scanned yet, by source library. Absent on summaries
   * written before it existed (see `BackfillBookReuseAttention`).
   */
  unscannedSources?: UnscannedSourceLink[];
  /** Pages needing attention. Absent on summaries written before it existed. */
  attention?: BookReuseAttention;
  computedAt: Date;
}

const BookReuseLinkSchema = new Schema<BookReuseLink>(
  {
    bookID: { type: String, required: true },
    pages: { type: Number, required: true },
    types: { type: [String], enum: REUSE_EDGE_TYPES, default: [] },
  },
  { _id: false },
);

const count = { type: Number, default: 0 };

const UnscannedSourceLinkSchema = new Schema<UnscannedSourceLink>(
  {
    lib: { type: String, required: true },
    pages: { type: Number, required: true },
    types: { type: [String], enum: REUSE_EDGE_TYPES, default: [] },
  },
  { _id: false },
);

const BookReuseSummarySchema = new Schema<BookReuseSummaryInterface>(
  {
    bookID: { type: String, required: true, unique: true },
    lib: { type: String, required: true },
    totals: {
      pages: count,
      original: count,
      transclude: count,
      fork: count,
      full: count,
      mixed: count,
      structural: count,
      unknown: count,
      viaChain: count,
    },
    upstream: { type: [BookReuseLinkSchema], default: [] },
    downstream: { type: [BookReuseLinkSchema], default: [] },
    unscannedSources: { type: [UnscannedSourceLinkSchema], default: undefined },
    attention: {
      type: new Schema<BookReuseAttention>(
        { sourceChanged: count, broken: count },
        { _id: false },
      ),
      default: undefined,
    },
    computedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

BookReuseSummarySchema.index({ lib: 1 });

const BookReuseSummary = model<BookReuseSummaryInterface>(
  "BookReuseSummary",
  BookReuseSummarySchema,
  "bookreusesummaries",
);

export default BookReuseSummary;
