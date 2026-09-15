import { model, Schema, Document } from "mongoose";

export type GlossaryConfigMode = "PAGE" | "CHAPTER" | "BACKMATTER";

export interface GlossaryConfigGroup {
  groupID: string;
  pageIds: string[];
  /** The page this group's combined glossary is displayed on. */
  targetPageId: string;
}

export interface GlossaryConfigInterface extends Document {
  projectId?: string;
  coverID: number;
  library: string;
  glossaryPageId?: string;
  mode: GlossaryConfigMode;
  groups: GlossaryConfigGroup[];
  createdAt: Date;
  updatedAt: Date;
}

const GlossaryConfigGroupSchema = new Schema<GlossaryConfigGroup>(
  {
    groupID: { type: String, required: true },
    pageIds: { type: [String], required: true, default: [] },
    targetPageId: { type: String, required: true },
  },
  { _id: false },
);

const GlossaryConfigSchema = new Schema<GlossaryConfigInterface>(
  {
    projectId: {
      type: String,
      required: false,
    },
    coverID: {
      type: Number,
      required: true,
    },
    library: {
      type: String,
      required: true,
    },
    glossaryPageId: {
      type: String,
      required: false,
    },
    mode: {
      type: String,
      enum: ["PAGE", "CHAPTER", "BACKMATTER"],
      required: true,
    },
    groups: {
      type: [GlossaryConfigGroupSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

GlossaryConfigSchema.index({ coverID: 1, library: 1 }, { unique: true });

const GlossaryConfig = model<GlossaryConfigInterface>(
  "GlossaryConfig",
  GlossaryConfigSchema,
);

export default GlossaryConfig;
