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
 * Precomputed per-book rollup of the provenance graph. Small (one document
 * per book) and read by the UI and the book connection graph, which never
 * touch the page-level collections directly.
 */
export interface BookReuseSummaryInterface {
  /** The Commons bookID, `${lib}-${coverID}`. */
  _id: string;
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

const BookReuseSummarySchema = new Schema<BookReuseSummaryInterface>(
  {
    _id: { type: String, required: true },
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
