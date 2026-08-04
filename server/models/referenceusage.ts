import { Document, model, Schema } from "mongoose";

export interface ReferenceUsageInterface extends Document {
  projectID: string;
  createdBy: string;
  updatedBy: string;
  format: string;
  /** Reference document IDs (`referenceID`) belonging to this project. */
  entries: string[];
}

const ReferenceUsageSchema = new Schema<ReferenceUsageInterface>({
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  format: { type: String, required: true },
  entries: { type: [String], default: () => [] },
});

ReferenceUsageSchema.index({ projectID: 1 }, { unique: true });
export const ReferenceUsage = model<ReferenceUsageInterface>(
  "ReferenceUsage",
  ReferenceUsageSchema,
  "referenceusage",
);
