import { Document, model, Schema } from "mongoose";

export interface ReferencePopulateJobInterface extends Document {
  projectID: string;
  jobID: string;
  createdBy: string;
  status: ReferencePopulateJobStatus;
  createdAt: Date;
  /** Bumped on every progress write, so a job that stops reporting is detectable. */
  updatedAt: Date;
  message: string[];
  totalPages: number;
  completedPages: number;
}

enum ReferencePopulateJobStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

const ReferencePopulateJobSchema = new Schema<ReferencePopulateJobInterface>(
  {
    projectID: { type: String, required: true },
    jobID: { type: String, required: true },
    createdBy: { type: String, required: true },
    status: { type: String, enum: ReferencePopulateJobStatus, required: true },
    message: { type: [String], default: () => [] },
    totalPages: { type: Number, required: true },
    completedPages: { type: Number, required: true },
  },
  { timestamps: true },
);

ReferencePopulateJobSchema.index({ projectID: 1 });
// At most one running job per project: two jobs would rewrite the same pages
// and interleave the saved per-page citations.
ReferencePopulateJobSchema.index(
  { projectID: 1 },
  {
    name: "one_pending_job_per_project",
    unique: true,
    partialFilterExpression: { status: ReferencePopulateJobStatus.PENDING },
  },
);

export const ReferencePopulateJob = model<ReferencePopulateJobInterface>(
  "ReferencePopulateJob",
  ReferencePopulateJobSchema,
  "referencepopulatejobs",
);
