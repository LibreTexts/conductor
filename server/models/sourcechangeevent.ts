import { model, Schema } from "mongoose";

/** Events older than this are dropped by a TTL index. */
const SOURCE_CHANGE_EVENT_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * One book reached by a source change. Stored per book rather than per page
 * so the event stays small however many pages reuse a popular source.
 */
export type SourceChangeAffectedBook = {
  bookID: string;
  /** Affected pages in this book. */
  pages: number;
  /** Shortest chain from the changed source into this book (1 = direct). */
  minHops: number;
  /** Example intermediate pages for the shortest chain, nearest the source first. */
  via: string[];
  /** Reached only through a fork/full copy: the copy is out of date. */
  frozen: boolean;
};

/**
 * A change (or deletion) of a page that other pages reuse, with every book it
 * reaches through the live chain. The notification job turns unsent events
 * into lead emails.
 */
export interface SourceChangeEventInterface {
  sourcePage: string;
  sourceBook?: string | null;
  fromRev?: number;
  toRev?: number;
  /** The source was deleted, so live reuse of it renders nothing. */
  deleted: boolean;
  changedAt: Date;
  affected: SourceChangeAffectedBook[];
  affectedPageCount: number;
  /** The downstream walk stopped at its depth limit. */
  truncated: boolean;
  notifiedAt?: Date | null;
}

const AffectedBookSchema = new Schema<SourceChangeAffectedBook>(
  {
    bookID: { type: String, required: true },
    pages: { type: Number, required: true },
    minHops: { type: Number, required: true },
    via: { type: [String], default: [] },
    frozen: { type: Boolean, default: false },
  },
  { _id: false },
);

const SourceChangeEventSchema = new Schema<SourceChangeEventInterface>(
  {
    sourcePage: { type: String, required: true },
    sourceBook: { type: String, default: null },
    fromRev: { type: Number },
    toRev: { type: Number },
    deleted: { type: Boolean, default: false },
    changedAt: { type: Date, required: true },
    affected: { type: [AffectedBookSchema], default: [] },
    affectedPageCount: { type: Number, default: 0 },
    truncated: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

// One event per source revision, so a re-polled change is not queued twice.
// Partial: changes found without a revision number (e.g. deletions) are exempt.
SourceChangeEventSchema.index(
  { sourcePage: 1, toRev: 1 },
  { unique: true, partialFilterExpression: { toRev: { $exists: true } } },
);
// The notification job's queue.
SourceChangeEventSchema.index({ notifiedAt: 1, changedAt: 1 });
SourceChangeEventSchema.index(
  { changedAt: 1 },
  { expireAfterSeconds: SOURCE_CHANGE_EVENT_TTL_SECONDS },
);

const SourceChangeEvent = model<SourceChangeEventInterface>(
  "SourceChangeEvent",
  SourceChangeEventSchema,
  "sourcechangeevents",
);

export default SourceChangeEvent;
