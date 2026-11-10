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
  _id: string;
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
    _id: { type: String, required: true },
    phase: { type: String, enum: PROVENANCE_SCAN_PHASES, default: "idle" },
    cursor: { type: String, default: null },
    changesSince: { type: Date, default: null },
    leaseID: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastRunAt: { type: Date },
    lastCompletedAt: { type: Date },
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
