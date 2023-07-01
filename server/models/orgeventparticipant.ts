import { model, Schema, Document, Types } from "mongoose";
import User from "./user.js";
import OrgEventFeeWaiver from "./orgeventfeewaiver.js";

export interface OrgEventParticipantInterface extends Document {
  regID: string;
  user?: Types.ObjectId;
  orgID: string;
  eventID: string;
  firstName?: string;
  lastName?: string;
  email?: string;
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
  registeredBy: Types.ObjectId;
}

const OrgEventParticipantSchema = new Schema<OrgEventParticipantInterface>({
  regID: {
    type: String,
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: false,
  },
  orgID: { type: String, required: true },
  eventID: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: false,
  },
  lastName: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: false,
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
  registeredBy: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
  },
});

const OrgEventParticipant = model<OrgEventParticipantInterface>(
  "OrgEventParticipant",
  OrgEventParticipantSchema
);

export default OrgEventParticipant;
