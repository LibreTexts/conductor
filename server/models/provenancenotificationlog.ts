import { model, Schema, Types } from "mongoose";

/** Kept as long as the events they refer to. */
const NOTIFICATION_LOG_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * One lead told (or being told) about one source change. Written *before*
 * the email goes out, as a claim: the unique index means two job runs can
 * never both email the same lead about the same event, and a failed send
 * deletes its claim so the next run tries again.
 */
export interface ProvenanceNotificationLogInterface {
  eventID: Types.ObjectId;
  /** Lead UUID. */
  recipient: string;
  projectIDs: string[];
  claimedAt: Date;
  /** Set once the email was handed to the mail provider. */
  sentAt?: Date | null;
}

const ProvenanceNotificationLogSchema = new Schema<ProvenanceNotificationLogInterface>(
  {
    eventID: { type: Schema.Types.ObjectId, required: true },
    recipient: { type: String, required: true },
    projectIDs: { type: [String], default: [] },
    claimedAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
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
