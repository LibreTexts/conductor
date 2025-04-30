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

export interface SupportTicketAttachmentInterface {
  name: string;
  uuid: string;
  uploadedBy: string;
  uploadedDate: string;
}

export interface SupportTicketDeviceInfoInterface {
  userAgent?: string;
  language?: string;
  screenResolution?: string;
  timeZone?: string;
}

export interface SupportTicketInterface extends Document {
  uuid: string;
  title: string;
  description: string;
  apps?: number[]; // Central Identity app IDs
  attachments?: SupportTicketAttachmentInterface[];
  priority: "low" | "medium" | "high" | "severe";
  status: "open" | "in_progress" | "closed";
  category: string;
  guestAccessKey: string;
  capturedURL?: string;
  assignedUUIDs?: string[]; // User uuids
  ccedEmails?: {
    email: string;
    accessKey: string;
  }[]; // Email addresses
  userUUID?: string; // User uuid
  guest?: SupportTicketGuestInterface;
  timeOpened: string;
  timeClosed?: string;
  feed: SupportTicketFeedEntryInterface[];
  deviceInfo?: SupportTicketDeviceInfoInterface;
  autoCloseTriggered?: boolean;
  autoCloseDate?: string;
  autoCloseSilenced?: boolean;
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
  },
  attachments: {
    type: [
      {
        name: {
          type: String,
          required: true,
        },
        uuid: {
          type: String,
          required: true,
        },
        uploadedBy: {
          type: String,
          required: true,
        },
        uploadedDate: {
          type: String,
          required: true,
        },
      },
    ],
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "severe"],
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
  guestAccessKey: {
    type: String,
    required: true,
  },
  capturedURL: {
    type: String,
  },
  assignedUUIDs: {
    type: [String],
  },
  ccedEmails: {
    type: [
      {
        email: {
          type: String,
          required: true,
        },
        accessKey: {
          type: String,
          required: true,
        },
      },
    ],
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
  deviceInfo: {
    userAgent: {
      type: String,
    },
    language: {
      type: String,
    },
    screenResolution: {
      type: String,
    },
    timeZone: {
      type: String,
    },
  },
  autoCloseTriggered: {
    type: Boolean,
  },
  autoCloseDate: {
    type: Date,
  },
  autoCloseSilenced: {
    type: Boolean,
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

SupportTicketSchema.virtual("messages", {
  ref: "SupportTicketMessage",
  localField: "uuid",
  foreignField: "ticket",
});

SupportTicketSchema.set("toObject", { virtuals: true });
SupportTicketSchema.set("toJSON", { virtuals: true });

const SupportTicket = model<SupportTicketInterface>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
