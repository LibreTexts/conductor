import { model, Schema, Document } from "mongoose";

export type GlossaryCsvImportJobStatus =
  | "pending"
  | "running"
  | "success"
  | "error";

export interface GlossaryCsvImportJobInterface extends Document {
  jobID: string;
  coverID: number;
  library: string;
  userID: string;
  glossaryID?: string;
  status: GlossaryCsvImportJobStatus;
  totalRows: number;
  processedRows: number;
  /** Rows that created a new term in the book. */
  imported: number;
  /** Rows that overwrote an existing term's definition. */
  updated: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GlossaryCsvImportJobSchema = new Schema<GlossaryCsvImportJobInterface>(
  {
    jobID: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    coverID: {
      type: Number,
      required: true,
    },
    library: {
      type: String,
      required: true,
    },
    userID: {
      type: String,
      required: true,
      index: true,
    },
    glossaryID: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "error"],
      default: "pending",
      index: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    imported: {
      type: Number,
      default: 0,
    },
    updated: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

GlossaryCsvImportJobSchema.index({ coverID: 1, library: 1, userID: 1 });

const GlossaryCsvImportJob = model<GlossaryCsvImportJobInterface>(
  "GlossaryCsvImportJob",
  GlossaryCsvImportJobSchema,
);

export default GlossaryCsvImportJob;
