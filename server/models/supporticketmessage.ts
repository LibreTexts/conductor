import { Schema, model } from "mongoose";
import { Document } from "mongoose";
import { SanitizedUserSelectProjection } from "./user.js";

export interface SupportTicketMessageInterface extends Document {
  uuid: string;
  ticket: string;
  message: string;
  attachments?: string[];
  senderUUID?: string; // User uuid (if user is logged in)
  senderEmail?: string; // else, fallback to the sender's email
  senderIsStaff: boolean;
  timeSent: string;
  type: 'internal' | 'general'; // internal = staff only, general = user & staff
}

const SupportTicketMessageSchema = new Schema<SupportTicketMessageInterface>({
  uuid: {
    type: String,
    required: true,
    unique: true,
  },
  ticket: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  attachments: {
    type: [String],
    required: true,
  },
  senderUUID: {
    type: String,
    required: false,
  },
  senderEmail: {
    type: String,
    required: false,
  },
  senderIsStaff: {
    type: Boolean,
    required: true,
    default: false,
  },
  timeSent: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["internal", "general"],
  },
});

SupportTicketMessageSchema.virtual("sender", {
  ref: "User",
  localField: "senderUUID",
  foreignField: "uuid",
  justOne: true,
  options: {
    projection: SanitizedUserSelectProjection,
  }
});

SupportTicketMessageSchema.index({ uuid: 1 });
SupportTicketMessageSchema.set("toObject", { virtuals: true });
SupportTicketMessageSchema.set("toJSON", { virtuals: true });

const SupportTicketMessage = model<SupportTicketMessageInterface>(
  "SupportTicketMessage",
  SupportTicketMessageSchema
);

export default SupportTicketMessage;
