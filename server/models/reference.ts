import base62 from "base62-random";
import { Document, model, Schema } from "mongoose";

export interface ReferenceInterface extends Document {
  projectID: string;
  createdBy: string;
  updatedBy: string;
  format: string;
}

const ReferenceSchema = new Schema<ReferenceInterface>({
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  format: { type: String, required: true },
});

ReferenceSchema.index({ projectID: 1, referenceID: 1 }, { unique: true });
export const Reference = model<ReferenceInterface>("Reference", ReferenceSchema);