import { model, Schema, Document } from "mongoose";

export interface ThreadInterface extends Document {
  threadID: string;
  project: string;
  title: string;
  kind: "project" | "a11y" | "peerreview";
  createdBy: string;
  lastNotifSent?: Date;
}

const ThreadSchema = new Schema<ThreadInterface>(
  {
    threadID: {
      // base62 14-digit identifier
      type: String,
      required: true,
      unique: true,
    },
    project: {
      // the projectID the thread belongs to
      type: String,
      required: true,
    },
    title: {
      // the thread's title/topic
      type: String,
      required: true,
    },
    kind: {
      // the thread's type/area
      type: String,
      required: true,
      enum: ["project", "a11y", "peerreview"],
    },
    createdBy: {
      // the UUID of the user who created the thread
      type: String,
      required: true,
    },
    lastNotifSent: Date, // the datetime of the last email notification sent for new messages
  },
  {
    timestamps: true,
  }
);

const Thread = model<ThreadInterface>("Thread", ThreadSchema);

export default Thread;
