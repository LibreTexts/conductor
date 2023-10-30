import { Document, model } from "mongoose";
import { UserInterface } from "./user";
import { Schema } from "mongoose";

export interface SupportTicketGuestInterface {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
}

export interface SupportTicketInterface extends Document {
  uuid: string;
  title: string;
  description: string;
  apps: number[]; // Central Identity app IDs
  attachments?: string[];
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "closed";
  assignedTo?: Schema.Types.ObjectId;
  user?: Schema.Types.ObjectId;
  guest?: SupportTicketGuestInterface;
  timeOpened: string;
  timeClosed?: string;
}

const SupportTicketSchema = new Schema<SupportTicketInterface>({
  uuid: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  apps: {
    type: [Number],
    required: true,
  },
  attachments: {
    type: [String],
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low",
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "closed"],
    default: "open",
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  guest: {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
    },
    organization: {
      type: String,
    },
  },
  timeOpened: {
    type: String,
    required: true,
  },
  timeClosed: {
    type: String,
  },
});

SupportTicketSchema.index({ uuid: 1 }, { unique: true });
SupportTicketSchema.index({ title: "text" });

const SupportTicket = model<SupportTicketInterface>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
