import { model, Schema, Document } from "mongoose";
import { peerReviewAuthorTypes } from "../util/peerreviewutils.js";
import {
  CustomFormHeadingType,
  CustomFormPromptType,
  CustomFormTextBlockType,
} from "../types/CustomForm";
import {
  CustomFormHeadingSchema,
  CustomFormPromptSchema,
  CustomFormTextBlockSchema
} from "../util/CustomFormSchemas.js";

export interface PeerReviewInterface extends Document {
  projectID: string;
  peerReviewID: string;
  rubricID: string;
  rubricTitle: string;
  author: string;
  authorEmail?: string;
  anonAuthor: boolean;
  authorType: "student" | "instructor";
  rating?: number;
  headings?: CustomFormHeadingType[];
  textBlocks?: CustomFormTextBlockType[];
  responses: CustomFormPromptType[];
}

const PeerReviewSchema = new Schema<PeerReviewInterface>(
  {
    projectID: {
      // the Project the Peer Review submission is for
      type: String,
      required: true,
    },
    peerReviewID: {
      // base62 9-digit identifier
      type: String,
      required: true,
    },
    rubricID: {
      // the identifier of the Rubric the review was based on
      type: String,
      required: true,
    },
    rubricTitle: {
      // the title of the Rubric the review was based on
      type: String,
      required: true,
    },
    author: {
      // UUID or name (if non-Conductor-user) of the submitter
      type: String,
      required: true,
    },
    authorEmail: String, // submitter's email (only if 'anonymous')
    anonAuthor: {
      // If the submitter is a Conductor user (false) or 'anonymous' (true)
      type: Boolean,
      default: false,
    },
    authorType: {
      // the submitter's role/type
      type: String,
      enum: peerReviewAuthorTypes,
      required: true,
    },
    rating: {
      // the resource's overall quality, rated on a scale of 0-5
      type: Number,
      min: 0,
      max: 5,
    },
    headings: [CustomFormHeadingSchema],
    textBlocks: [CustomFormTextBlockSchema],
    responses: [CustomFormPromptSchema],
  },
  {
    timestamps: true,
  }
);

const PeerReview = model<PeerReviewInterface>("PeerReview", PeerReviewSchema);

export default PeerReview;
