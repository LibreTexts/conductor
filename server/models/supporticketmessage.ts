import { Schema, model } from "mongoose";
import { Document } from "mongoose";

export interface SupportTicketMessageInterface extends Document {
  uuid: string;
  ticket: string;
  message: string;
  attachments?: string[];
  sender?: string;
  timeSent: string;
}

const SupportTicketMessageSchema = new Schema<SupportTicketMessageInterface>(
  {
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
    sender: {
      type: String,
      required: true,
    },
    timeSent: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const SupportTicketMessage = model<SupportTicketMessageInterface>(
  "SupportTicketMessage",
  SupportTicketMessageSchema
);

export default SupportTicketMessage;
