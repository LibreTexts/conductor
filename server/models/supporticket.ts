import { Document, model } from "mongoose";
import { SanitizedUserSelectProjection } from "./user.js";
import { Schema } from "mongoose";
import { GenericKeyTextValueObj } from "../types/Misc.js";
import { SupportQueueInterface } from "./supportqueue.js";

export const SupportTicketPriorityOptions = [
  "low",
  "medium",
  "high",
  "severe",
];

export type SupportTicketPriorityEnum = "low" | "medium" | "high" | "severe";

export const SupportTicketCategoryOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "general",
    text: "General Inquiry",
    value: "general",
  },
  {
    key: "adaptcode",
    text: "ADAPT Access Code Request",
    value: "adaptcode",
  },
  {
    key: "technical",
    text: "Technical Issue (Bug, Error, etc.)",
    value: "technical",
  },
  {
    key: "feature",
    text: "Feature Request",
    value: "feature",
  },
  {
    key: "account",
    text: "Account Issue",
    value: "account",
  },
  {
    key: "bookstore",
    text: "Bookstore",
    value: "bookstore",
  },
  {
    key: "bulk",
    text: "Bulk Textbook Orders",
    value: "bulk",
  },
  {
    key: "integrate",
    text: "Integrating LibreTexts Content/Platform",
    value: "integrate",
  },
  {
    key: "delete-account",
    text: "Delete Account (ADAPT and all other applications)",
    value: "delete-account",
  },
  {
    key: "other",
    text: "Other",
    value: "other",
  },
];

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

export type SupportTicketStatusEnum =
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_requester"
  | "closed";
export const SupportTicketStatuses = [
  "open",
  "assigned",
  "in_progress",
  "awaiting_requester",
  "closed",
];

export interface SupportTicketInterface extends Document {
  uuid: string;
  uuidShort: string; // Last 7 characters of uuid
  queue_id: string;
  title: string;
  description?: string;
  apps?: number[]; // Central Identity app IDs
  attachments?: SupportTicketAttachmentInterface[];
  priority?: SupportTicketPriorityEnum;
  status: SupportTicketStatusEnum;
  category?: string;
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
  metadata?: Record<string, any>;
  queue?: SupportQueueInterface; // Populated
}

const SupportTicketSchema = new Schema<SupportTicketInterface>({
  uuid: {
    type: String,
    required: true,
    unique: true,
  },
  uuidShort: {
    type: String,
    required: true, // This is technically not a unique field
  },
  queue_id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
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
    enum: SupportTicketPriorityOptions,
    required: false,
  },
  status: {
    type: String,
    enum: SupportTicketStatuses,
    default: "open",
  },
  category: {
    type: String,
    required: false,
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
  metadata: {
    type: Schema.Types.Mixed,
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

SupportTicketSchema.virtual("queue", {
  ref: "SupportQueue",
  localField: "queue_id",
  foreignField: "id",
  justOne: true,
});

SupportTicketSchema.set("toObject", { virtuals: true });
SupportTicketSchema.set("toJSON", { virtuals: true });

const SupportTicket = model<SupportTicketInterface>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
