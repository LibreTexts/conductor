import { model, Schema, Document } from "mongoose";

export type PrejectRemixerJobStatus =
  | "pending"
  | "running"
  | "success"
  | "error";

export interface PrejectRemixerJobInterface extends Document {
  jobID: string;
  remixerID: string;
  projectID: string;
  userID: string;
  status: PrejectRemixerJobStatus;
  messages: string[];
  errorMessage?: string;
}

const PrejectRemixerJobSchema = new Schema<PrejectRemixerJobInterface>(
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
    remixerID: {
        type: String,
        required: false,
        index: true,
    },
  },
  {
    timestamps: true,
  },
);

PrejectRemixerJobSchema.index({ projectID: 1, userID: 1 }, { unique: false });

const PrejectRemixerJob = model<PrejectRemixerJobInterface>(
  "PrejectRemixerJob",
  PrejectRemixerJobSchema,
);

export default PrejectRemixerJob;