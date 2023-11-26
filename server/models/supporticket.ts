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
  category: string;
  capturedURL?: string;
  assignedToUUID?: string; // User uuid
  userUUID?: string; // User uuid
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
  category: {
    type: String,
    required: true,
  },
  capturedURL: {
    type: String,
  },
  assignedToUUID: {
    type: String,
  },
  userUUID: {
    type: String
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

SupportTicketSchema.virtual("assignedTo", {
  ref: "User",
  localField: "assignedToUUID",
  foreignField: "uuid",
  justOne: true,
});

SupportTicketSchema.virtual("user", {
  ref: "User",
  localField: "userUUID",
  foreignField: "uuid",
  justOne: true,
});

SupportTicketSchema.index({ title: "text" });

const SupportTicket = model<SupportTicketInterface>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
