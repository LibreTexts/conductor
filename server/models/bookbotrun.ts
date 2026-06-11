import { model, Schema, Document } from "mongoose";

export type BookBotType = "editor-preprocess";

export type BookBotRunState =
  | "queued"
  | "starting"
  | "getSubpages"
  | "processing"
  | "done"
  | "error";

export interface BookBotRunPage {
  path: string;
  url: string;
}

export interface BookBotRunLogEntry {
  ts: Date;
  state: BookBotRunState;
  message?: string;
  percentage?: number;
}

export interface BookBotRunInterface extends Document {
  jobID: string;
  botType: BookBotType;
  triggeredBy: string;
  rootURL: string;
  libreUser: string;
  state: BookBotRunState;
  percentage?: number;
  pages: BookBotRunPage[];
  logs: BookBotRunLogEntry[];
  messages: string[];
  errorMessage?: string;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookBotRunPageSchema = new Schema<BookBotRunPage>(
  {
    path: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const BookBotRunLogEntrySchema = new Schema<BookBotRunLogEntry>(
  {
    ts: { type: Date, required: true, default: () => new Date() },
    state: {
      type: String,
      enum: ["queued", "starting", "getSubpages", "processing", "done", "error"],
      required: true,
    },
    message: { type: String },
    percentage: { type: Number },
  },
  { _id: false },
);

const BookBotRunSchema = new Schema<BookBotRunInterface>(
  {
    jobID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    botType: {
      type: String,
      enum: ["editor-preprocess"],
      required: true,
      index: true,
    },
    triggeredBy: {
      type: String,
      required: true,
      index: true,
    },
    rootURL: {
      type: String,
      required: true,
    },
    libreUser: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      enum: ["queued", "starting", "getSubpages", "processing", "done", "error"],
      default: "queued",
      index: true,
    },
    percentage: {
      type: Number,
    },
    pages: {
      type: [BookBotRunPageSchema],
      default: [],
    },
    logs: {
      type: [BookBotRunLogEntrySchema],
      default: [],
    },
    messages: {
      type: [String],
      default: [],
    },
    errorMessage: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

BookBotRunSchema.index({ botType: 1, createdAt: -1 });

const BookBotRun = model<BookBotRunInterface>("BookBotRun", BookBotRunSchema);

export default BookBotRun;
