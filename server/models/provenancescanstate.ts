import { model, Schema } from "mongoose";

export const PROVENANCE_SCAN_PHASES = [
  "idle",
  "scanning",
  "resolving",
  "fingerprinting",
  "complete",
] as const;
export type ProvenanceScanPhase = (typeof PROVENANCE_SCAN_PHASES)[number];

/**
 * Per-library progress of the provenance scanner. The scanner runs in
 * time-sliced cron invocations, so everything needed to resume lives here,
 * along with a lease so only one server instance scans a library at a time.
 */
export interface ProvenanceScanStateInterface {
  /** Library subdomain. */
  library: string;
  phase: ProvenanceScanPhase;
  /** Resume point within the current phase (e.g. the last bookID finished). */
  cursor?: string | null;
  /** Change detection reads library changes after this time. */
  changesSince?: Date | null;
  /** Owner of the lease, so a superseded holder can't renew or release it. */
  leaseID?: string | null;
  /** A past value means the holder died and the lease is free. */
  lockedUntil?: Date | null;
  lastRunAt?: Date;
  lastCompletedAt?: Date;
  /**
   * Change feed (`events/page-hierarchy`): the newest event (`@mt-epoch`, ms)
   * already applied. The changes job reads only events after it.
   */
  eventsCursor?: number | null;
  /** When the changes job last read this library's feed. */
  eventsPolledAt?: Date | null;
  /** The last read hit its page limit before reaching the cursor: events were skipped. */
  eventsGapAt?: Date | null;
  /** Books the feed showed changes in, waiting to be re-read. */
  pendingRescanBooks?: string[];
  stats: {
    scanned: number;
    skipped: number;
    edgesAdded: number;
    edgesRemoved: number;
    errors: number;
  };
}

const count = { type: Number, default: 0 };

const ProvenanceScanStateSchema = new Schema<ProvenanceScanStateInterface>(
  {
    library: { type: String, required: true, unique: true },
    phase: { type: String, enum: PROVENANCE_SCAN_PHASES, default: "idle" },
    cursor: { type: String, default: null },
    changesSince: { type: Date, default: null },
    leaseID: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastRunAt: { type: Date },
    lastCompletedAt: { type: Date },
    eventsCursor: { type: Number, default: null },
    eventsPolledAt: { type: Date, default: null },
    eventsGapAt: { type: Date, default: null },
    pendingRescanBooks: { type: [String], default: [] },
    stats: {
      scanned: count,
      skipped: count,
      edgesAdded: count,
      edgesRemoved: count,
      errors: count,
    },
  },
  { versionKey: false },
);

const ProvenanceScanState = model<ProvenanceScanStateInterface>(
  "ProvenanceScanState",
  ProvenanceScanStateSchema,
  "provenancescanstates",
);

export default ProvenanceScanState;
