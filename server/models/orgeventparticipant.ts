import { model, Schema, Document, SchemaType, Types } from "mongoose";
import User from "./user.js";
import OrgEventFeeWaiver from "./orgeventfeewaiver.js";

export interface OrgEventParticipantInterface extends Document {
  user: Types.ObjectId;
  orgID: string;
  eventID: string;
  paymentStatus: "na" | "unpaid" | "paid";
  formResponses: { promptNum: number; responseVal?: string }[];
  feeWaiver?: Types.ObjectId;
}

const OrgEventParticipantSchema = new Schema<OrgEventParticipantInterface>({
  user: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
    index: true,
    unique: true, //Participants can only register once
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
  feeWaiver: {
    type: Schema.Types.ObjectId,
    ref: OrgEventFeeWaiver,
    required: false,
  }
});

const OrgEventParticipant = model<OrgEventParticipantInterface>(
  "OrgEventParticipant",
  OrgEventParticipantSchema
);

export default OrgEventParticipant;
