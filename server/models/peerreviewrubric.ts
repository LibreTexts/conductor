import { model, Schema, Document } from "mongoose";
import {
  CustomFormHeadingType,
  CustomFormPromptType,
  CustomFormTextBlockType,
} from "../types";
import {
  CustomFormHeadingSchema,
  CustomFormPromptSchema,
  CustomFormTextBlockSchema,
} from "../util/CustomFormSchemas.js";

export interface PeerReviewRubricInterface extends Document {
  orgID: string;
  rubricID: string;
  isOrgDefault: boolean;
  rubricTitle: string;
  headings: CustomFormHeadingType[];
  textBlocks: CustomFormTextBlockType[];
  prompts: CustomFormPromptType[];
}

const PeerReviewRubricSchema = new Schema<PeerReviewRubricInterface>(
  {
    orgID: {
      // the organization the rubric was created in
      type: String,
      required: true,
    },
    rubricID: {
      // organization identifier OR base62 7-digit identifier
      type: String,
      required: true,
      unique: true,
    },
    isOrgDefault: {
      // indicates the Rubric is an Organization's default Rubric
      type: Boolean,
      default: false,
    },
    rubricTitle: {
      // the Rubric title, if not an Organization default
      type: String,
      required: true,
    },
    headings: [CustomFormHeadingSchema],
    textBlocks: [CustomFormTextBlockSchema],
    prompts: [CustomFormPromptSchema],
  },
  {
    timestamps: true,
  }
);

const PeerReviewRubric = model<PeerReviewRubricInterface>(
  "PeerReviewRubric",
  PeerReviewRubricSchema
);

export default PeerReviewRubric;
