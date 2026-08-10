import { Document, model, Schema } from "mongoose";

export interface ReferencePopulateJobInterface extends Document {
  projectID: string;
  jobID: string;
  createdBy: string;
  status: ReferencePopulateJobStatus;
  createdAt: Date;
  message: string[];
  totalPages: number;
  completedPages: number;
}

enum ReferencePopulateJobStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

const ReferencePopulateJobSchema = new Schema<ReferencePopulateJobInterface>({
  projectID: { type: String, required: true },
  jobID: { type: String, required: true },
  createdBy: { type: String, required: true },
  status: { type: String, enum: ReferencePopulateJobStatus, required: true },
  message: { type: [String], default: () => [] },
  totalPages: { type: Number, required: true },
  completedPages: { type: Number, required: true },
});

ReferencePopulateJobSchema.index({ projectID: 1 });

export const ReferencePopulateJob = model<ReferencePopulateJobInterface>(
  "ReferencePopulateJob",
  ReferencePopulateJobSchema,
  "referencepopulatejobs",
);