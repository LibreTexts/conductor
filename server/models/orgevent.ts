import { model, Schema, Document, SchemaType, Types } from "mongoose";
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
import User from "./user.js";

export interface OrgEventParticipantInterface extends Document {
  user: Types.ObjectId;
  paymentStatus: "na" | "unpaid" | "paid";
  formResponses: { promptNum: number; responseVal?: string }[];
}

export const OrgEventParticipantSchema =
  new Schema<OrgEventParticipantInterface>();
OrgEventParticipantSchema.add({
  user: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["na", "unpaid", "paid"],
    required: true,
  },
  formResponses: [
    {
      promptNum: {
        type: Number,
        required: true,
        min: 0,
      },
      responseVal: {
        type: String,
        required: false,
      },
    },
  ],
});

export interface OrgEventInterface extends Document {
  orgID: string;
  eventID: string;
  title: string;
  description?: string;
  regFee?: number;
  regOpenDate: Date;
  regCloseDate: Date;
  startDate: Date;
  endDate: Date;
  headings: CustomFormHeadingType[];
  textBlocks: CustomFormTextBlockType[];
  prompts: CustomFormPromptType[];
  participants: (typeof OrgEventParticipantSchema)[];
  createdBy: string;
  canceled: boolean;
}

const OrgEventSchema = new Schema<OrgEventInterface>(
  {
    orgID: {
      type: String,
      required: true,
    },
    eventID: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    regFee: {
      type: Number,
      min: 0,
    },
    regOpenDate: {
      type: Date,
      required: true,
    },
    regCloseDate: {
      type: Date,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    headings: [CustomFormHeadingSchema],
    textBlocks: [CustomFormTextBlockSchema],
    prompts: [CustomFormPromptSchema],
    participants: [OrgEventParticipantSchema],
    canceled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const OrgEvent = model<OrgEventInterface>("OrgEvent", OrgEventSchema);

export default OrgEvent;
