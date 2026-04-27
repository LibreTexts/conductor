import { model, Schema, Document } from "mongoose";

export type PressbooksImportJobStatus =
  | "pending"
  | "running"
  | "success"
  | "error";

export interface PressbooksImportJobInterface extends Document {
  jobID: string;
  projectID: string;
  userID: string;
  library: number;
  pbBookURL: string;
  title?: string;
  status: PressbooksImportJobStatus;
  messages: string[];
  errorMessage?: string;
  resultPath?: string;
  resultURL?: string;
}

const PressbooksImportJobSchema = new Schema<PressbooksImportJobInterface>(
  {
    jobID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    projectID: {
      type: String,
      required: true,
      index: true,
    },
    userID: {
      type: String,
      required: true,
      index: true,
    },
    library: {
      type: Number,
      required: true,
    },
    pbBookURL: {
      type: String,
      required: true,
    },
    title: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "error"],
      default: "pending",
      index: true,
    },
    messages: {
      type: [String],
      default: [],
    },
    errorMessage: {
      type: String,
    },
    resultPath: {
      type: String,
    },
    resultURL: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

PressbooksImportJobSchema.index({ projectID: 1, userID: 1 }, { unique: false });

const PressbooksImportJob = model<PressbooksImportJobInterface>(
  "PressbooksImportJob",
  PressbooksImportJobSchema,
);

export default PressbooksImportJob;

