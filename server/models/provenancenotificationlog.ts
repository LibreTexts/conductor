import { model, Schema, Types } from "mongoose";

/** Kept as long as the events they refer to. */
const NOTIFICATION_LOG_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * One lead told (or being told) about one source change. Written *before*
 * the email goes out, as a claim: the unique index means two job runs can
 * never both email the same lead about the same event. A failed send frees
 * its claim for the next run, counting the failure; after a few, the run
 * gives up on that lead for that event.
 */
export interface ProvenanceNotificationLogInterface {
  eventID: Types.ObjectId;
  /** Lead UUID. */
  recipient: string;
  projectIDs: string[];
  claimedAt: Date;
  /** Set once the email was handed to the mail provider. */
  sentAt?: Date | null;
  /** The run that holds the claim, so it can tell its claims from others'. */
  claimToken?: string | null;
  /** Sends to this lead that failed for this event. */
  failures?: number;
  /** Last failed send; while set, the claim is free for the next run to retry. */
  failedAt?: Date | null;
  /**
   * Set after too many failed sends: the lead is treated as unreachable for
   * this event, so it completes and can't hold up the queue for everyone.
   */
  gaveUpAt?: Date | null;
}

const ProvenanceNotificationLogSchema = new Schema<ProvenanceNotificationLogInterface>(
  {
    eventID: { type: Schema.Types.ObjectId, required: true },
    recipient: { type: String, required: true },
    projectIDs: { type: [String], default: [] },
    claimedAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    claimToken: { type: String, default: null },
    failures: { type: Number, default: 0 },
    failedAt: { type: Date, default: null },
    gaveUpAt: { type: Date, default: null },
  },
  { versionKey: false },
);

ProvenanceNotificationLogSchema.index({ eventID: 1, recipient: 1 }, { unique: true });
ProvenanceNotificationLogSchema.index(
  { claimedAt: 1 },
  { expireAfterSeconds: NOTIFICATION_LOG_TTL_SECONDS },
);

const ProvenanceNotificationLog = model<ProvenanceNotificationLogInterface>(
  "ProvenanceNotificationLog",
  ProvenanceNotificationLogSchema,
  "provenancenotificationlogs",
);

export default ProvenanceNotificationLog;
