import { Document, Schema, model } from "mongoose";
import { TimeZoneOption } from "../types";

export interface OrgEventFeeWaiverInterface extends Document {
  name: string;
  orgID: string;
  eventID: string;
  percentage: number;
  code: string;
  expirationDate: Date;
  timeZone: TimeZoneOption;
  active: boolean;
  createdBy: string;
}

const OrgEventFeeWaiverSchema = new Schema<OrgEventFeeWaiverInterface>({
  name: {
    type: String,
    required: true,
  },
  orgID: {
    type: String,
    required: true,
  },
  eventID: {
    type: String,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  expirationDate: {
    type: Date,
    required: true,
  },
  timeZone: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
});


OrgEventFeeWaiverSchema.index({ eventID: 1, name: 1 }, { unique: true }); // Fee waiver name must be unique for each event
OrgEventFeeWaiverSchema.index({ eventID: 1, code: 1 }, { unique: true }); // Fee waiver code must be unique for each event

const OrgEventFeeWaiver = model<OrgEventFeeWaiverInterface>(
  "OrgEventFeeWaiver",
  OrgEventFeeWaiverSchema
);

export default OrgEventFeeWaiver;
