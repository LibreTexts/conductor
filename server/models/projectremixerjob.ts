import { model, Schema, Document } from "mongoose";

export type ProjectRemixerJobStatus =
  | "pending"
  | "running"
  | "success"
  | "error";

export interface ProjectRemixerJobInterface extends Document {
  jobID: string;
  remixerID: string;
  projectID: string;
  userID: string;
  status: ProjectRemixerJobStatus;
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

const ProjectRemixerJobSchema = new Schema<ProjectRemixerJobInterface>(
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

ProjectRemixerJobSchema.index({ projectID: 1, userID: 1 }, { unique: false });

// The collection keeps its historical (misspelled) name: it was derived from
// the old "PrejectRemixerJob" model name, and renaming it would orphan the
// existing job documents.
const ProjectRemixerJob = model<ProjectRemixerJobInterface>(
  "ProjectRemixerJob",
  ProjectRemixerJobSchema,
  "prejectremixerjobs",
);

export default ProjectRemixerJob;