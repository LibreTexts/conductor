import { model, Schema, Document } from "mongoose";
import {
  CustomFormHeadingType,
  CustomFormPromptType,
  CustomFormTextBlockType,
  TimeZoneOption,
} from "../types";
import {
  CustomFormHeadingSchema,
  CustomFormPromptSchema,
  CustomFormTextBlockSchema,
} from "../util/CustomFormSchemas.js";

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
  timeZone: TimeZoneOption;
  headings: CustomFormHeadingType[];
  textBlocks: CustomFormTextBlockType[];
  prompts: CustomFormPromptType[];
  collectShipping: boolean;
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
    timeZone: {
      type: Object,
      required: true,
    },
    headings: [CustomFormHeadingSchema],
    textBlocks: [CustomFormTextBlockSchema],
    prompts: [CustomFormPromptSchema],
    collectShipping: {
      type: Boolean,
      default: false,
    },
    canceled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);
OrgEventSchema.index({ orgID: 1, eventID: 1 }, { unique: true }); // Prevent duplicate eventIDs within an org
OrgEventSchema.index({ orgID: 1, title: 1 }, { unique: true }); // Prevent duplicate event titles within an org

const OrgEvent = model<OrgEventInterface>("OrgEvent", OrgEventSchema);

export default OrgEvent;
