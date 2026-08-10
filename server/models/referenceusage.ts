import { Document, model, Schema } from "mongoose";

export type ReferenceDisplayLocation =
  | "endOfPage"
  | "endOfChapter"
  | "backmatter";

export type pageRefrences = {
  pageID: string;
  refrences: {
    key: string;
    refID: string;
  }[];
};

export interface ReferenceUsageInterface extends Document {
  projectID: string;
  createdBy: string;
  updatedBy: string;
  format: string;
  displayLocation?: ReferenceDisplayLocation;
  pageTitle?: string;
  /** Reference document IDs (`referenceID`) belonging to this project. */
  entries: string[];
  pageRefrences: pageRefrences[];
  backmatterReferenceList: string[];
  backmatterPageID?: string;
}

const pageRefrencesSchema = new Schema<pageRefrences>(
  {
    pageID: { type: String, required: true },
    refrences: {
      type: [
        {
          key: { type: String, required: true },
          refID: { type: String, required: true },
        },
        { _id: false },
      ],
      default: () => [],
    },
  },
  { _id: false },
);

const ReferenceUsageSchema = new Schema<ReferenceUsageInterface>({
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  format: { type: String, required: true },
  displayLocation: {
    type: String,
    enum: ["endOfPage", "endOfChapter", "backmatter"],
    required: false,
  },
  pageTitle: { type: String, required: false },
  entries: { type: [String], default: () => [] },
  pageRefrences: { type: [pageRefrencesSchema], default: () => [] },
  backmatterReferenceList: { type: [String], default: () => [] },
  backmatterPageID: { type: String, required: false },
});

ReferenceUsageSchema.index({ projectID: 1 }, { unique: true });
export const ReferenceUsage = model<ReferenceUsageInterface>(
  "ReferenceUsage",
  ReferenceUsageSchema,
  "referenceusage",
);
