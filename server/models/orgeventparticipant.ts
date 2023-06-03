import { model, Schema, Document, Types } from "mongoose";
import User from "./user.js";
import OrgEventFeeWaiver from "./orgeventfeewaiver.js";

export interface OrgEventParticipantInterface extends Document {
  user: Types.ObjectId;
  orgID: string;
  eventID: string;
  paymentStatus:
    | "na"
    | "unpaid"
    | "paid"
    | "waived"
    | "partial_waived"
    | "refunded";
  formResponses: { promptNum: number; responseVal?: string }[];
  feeWaiver?: Types.ObjectId;
  amountPaid?: number;
  shippingAddress?: {
    lineOne: string;
    lineTwo?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

const OrgEventParticipantSchema = new Schema<OrgEventParticipantInterface>({
  user: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
    index: true,
  },
  orgID: {
    type: String,
    required: true,
  },
  eventID: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["na", "unpaid", "paid", "waived", "partial_waived", "refunded"],
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
  feeWaiver: {
    type: Schema.Types.ObjectId,
    ref: OrgEventFeeWaiver,
    required: false,
  },
  amountPaid: Number,
  shippingAddress: {
    lineOne: String,
    lineTwo: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
});

// ensure that each user can only register for an event once
OrgEventParticipantSchema.index({ eventID: 1, user: 1 }, { unique: true });

const OrgEventParticipant = model<OrgEventParticipantInterface>(
  "OrgEventParticipant",
  OrgEventParticipantSchema
);

export default OrgEventParticipant;
