import { Document, model } from "mongoose";
import {
  SanitizedUserSelectProjection,
  SanitizedUserSelectQuery,
  UserInterface,
} from "./user.js";
import { Schema } from "mongoose";

export interface SupportTicketGuestInterface {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
}

export interface SupportTicketFeedEntryInterface {
  action: string;
  blame: string;
  date: string;
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
  assignedUUIDs?: string[]; // User uuids
  userUUID?: string; // User uuid
  guest?: SupportTicketGuestInterface;
  timeOpened: string;
  timeClosed?: string;
  feed: SupportTicketFeedEntryInterface[];
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
  assignedUUIDs: {
    type: [String],
  },
  userUUID: {
    type: String,
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
  feed: {
    type: [
      {
        action: {
          type: String,
          required: true,
        },
        blame: {
          type: String,
          required: true,
        },
        date: {
          type: String,
          required: true,
        },
      },
    ],
  },
});

SupportTicketSchema.virtual("assignedUsers", {
  ref: "User",
  localField: "assignedUUIDs",
  foreignField: "uuid",
  options: {
    projection: SanitizedUserSelectProjection,
  },
});

SupportTicketSchema.virtual("user", {
  ref: "User",
  localField: "userUUID",
  foreignField: "uuid",
  justOne: true,
  options: {
    projection: SanitizedUserSelectProjection,
  },
});

SupportTicketSchema.index({ title: "text" });
SupportTicketSchema.set("toObject", { virtuals: true });
SupportTicketSchema.set("toJSON", { virtuals: true });

const SupportTicket = model<SupportTicketInterface>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
