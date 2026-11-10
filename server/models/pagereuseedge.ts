import { model, Schema } from "mongoose";
import {
  REUSE_EDGE_TYPES,
  type ReuseEdgeType,
} from "../util/provenance-graph.js";

/** How an edge was learned. The first origin recorded is kept. */
export const REUSE_EDGE_ORIGINS = [
  "remixer",
  "scan",
  "fingerprint",
  "property",
  "manual",
] as const;
export type ReuseEdgeOrigin = (typeof REUSE_EDGE_ORIGINS)[number];

/**
 * - `active`: the reuse is current.
 * - `source-changed`: the source changed since the target's leads were last told.
 * - `broken`: the source is gone (deleted, or the chain loops), so a live
 *   transclusion renders nothing.
 * - `removed`: the target no longer reuses the source.
 */
export const REUSE_EDGE_STATUSES = [
  "active",
  "source-changed",
  "broken",
  "removed",
] as const;
export type ReuseEdgeStatus = (typeof REUSE_EDGE_STATUSES)[number];

/** Statuses of an edge that still exists in the target's content. */
export const CURRENT_EDGE_STATUSES: readonly ReuseEdgeStatus[] = [
  "active",
  "source-changed",
];

/**
 * One direct reuse: `target` reuses `source`. Chains (A → B → C) are stored as
 * their direct links only and walked when needed; see provenance-graph.
 */
export interface PageReuseEdgeInterface {
  /** `${target}<${source}`; see `reuseEdgeId`. */
  _id: string;
  target: string;
  source: string;
  /** Denormalized for the book-level graph. */
  targetBook?: string | null;
  sourceBook?: string | null;
  type: ReuseEdgeType;
  origin: ReuseEdgeOrigin;
  /** 1 for edges read from markup or recorded by Remixer; lower for fingerprints. */
  confidence: number;
  /**
   * Pages the reuse was chosen through but that the content skips. Remixer
   * points a new page straight at A even when the user picked B (a stub of A),
   * so the edge is target ← A with `via: [B]`.
   */
  via?: string[];
  /** Source revision when the reuse was created. */
  linkedRevision?: number;
  /** Last source revision the target's leads have been told about. */
  seenRevision?: number;
  status: ReuseEdgeStatus;
  createdAt: Date;
  verifiedAt?: Date;
  removedAt?: Date;
}

const PageReuseEdgeSchema = new Schema<PageReuseEdgeInterface>(
  {
    _id: { type: String, required: true },
    target: { type: String, required: true },
    source: { type: String, required: true },
    targetBook: { type: String, default: null },
    sourceBook: { type: String, default: null },
    type: { type: String, enum: REUSE_EDGE_TYPES, required: true },
    origin: { type: String, enum: REUSE_EDGE_ORIGINS, required: true },
    confidence: { type: Number, default: 1, min: 0, max: 1 },
    via: { type: [String], default: undefined },
    linkedRevision: { type: Number },
    seenRevision: { type: Number },
    status: { type: String, enum: REUSE_EDGE_STATUSES, default: "active" },
    createdAt: { type: Date, required: true },
    verifiedAt: { type: Date },
    removedAt: { type: Date },
  },
  { versionKey: false },
);

// Fan-out when a source changes: "who reuses this page?"
PageReuseEdgeSchema.index({ source: 1, status: 1 });
// Lineage and reconciliation of one page's own reuse.
PageReuseEdgeSchema.index({ target: 1 });
// Book-level graph aggregation.
PageReuseEdgeSchema.index({ sourceBook: 1, targetBook: 1 });
PageReuseEdgeSchema.index({ targetBook: 1 });

const PageReuseEdge = model<PageReuseEdgeInterface>(
  "PageReuseEdge",
  PageReuseEdgeSchema,
  "pagereuseedges",
);

export default PageReuseEdge;
