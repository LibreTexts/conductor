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
  /**
   * Pages this run created, as draft id (`new-…` / imported `${source}-…`) →
   * live MindTouch id. Written as each page is created, so a run that fails
   * partway still says which draft pages already exist live; the client maps
   * them onto its draft instead of creating them again.
   */
  createdPages: { draftID: string; pageID: string }[];
  createdAt: Date;
  updatedAt: Date;
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
    createdPages: {
        type: [
            {
                _id: false,
                draftID: { type: String, required: true },
                pageID: { type: String, required: true },
            },
        ],
        default: [],
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