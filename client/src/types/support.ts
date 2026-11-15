import { SupportQueue } from "./supportqueues";
import { AssignableUser, User, UserWCentralID } from "./User";

export type SupportTicketGuest = {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
};

export type SupportTicketPriority = "low" | "medium" | "high" | "severe";

export type SupportTicketStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "awaiting_requester"
  | "closed"
  | "unknown";

export type SupportTicket = {
  uuid: string;
  queue_id: string;
  title: string;
  description: string;
  apps?: number[]; // Central Identity app IDs
  attachments?: SupportTicketAttachment[];
  priority?: SupportTicketPriority;
  status: SupportTicketStatus;
  category?: string;
  capturedURL?: string;
  assignedUUIDs?: string[]; // User uuids
  assignedUsers?: AssignableUser[];
  user?: UserWCentralID;
  guest?: SupportTicketGuest;
  ccedEmails?: {
    email: string;
  }[];
  timeOpened: string;
  timeClosed?: string;
  feed: SupportTicketFeedEntry[];
  deviceInfo?: SupportTicketDeviceInfo;
  autoCloseTriggered?: boolean;
  autoCloseDate?: string;
  autoCloseSilenced?: boolean;
  lastReplyAt?: string;
  metadata?: Record<string, any>;
  privacy?: SupportTicketPrivacy;
  queue?: SupportQueue;
};

export type PrivacyRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "marketing_opt_out"
  | "parent_guardian"
  | "legal_disclosure"
  | "appeal"
  | "general";

export type PrivacyOutcome =
  | "fulfilled"
  | "partly_fulfilled"
  | "denied"
  | "referred"
  | "withdrawn"
  | "could_not_verify";

export type SupportTicketPrivacy = {
  dateReceived: string;
  requestType: PrivacyRequestType;
  intakeChannel: string;
  actingForOther?: { isAgent: boolean; note?: string };
  products?: string[];
  schoolRecord?: { isSchoolRecord: boolean; institution?: string };
  identityVerification?: { method: string; date?: string };
  dueDate: string;
  extension?: { reason: string; newDueDate: string; notifiedAt?: string };
  responseDate?: string;
  responseOutcome?: PrivacyOutcome;
  responseSummary?: string;
  denialBasis?: { reason: string; note?: string };
  appealOf?: string;
  appealUUIDs?: string[];
  redactedAt?: string;
};

export type SupportTicketMessage = {
  uuid: string;
  ticket: string;
  message: string;
  attachments?: string[];
  senderUUID?: string; // User uuid (if user is logged in)
  sender?: User;
  senderEmail?: string; // else, fallback to the sender's email (ie guest)
  senderIsStaff: boolean;
  timeSent: string;
  type: "internal" | "general"; // internal = staff only, general = user & staff
};

export type SupportTicketFeedEntry = {
  action: string;
  blame: string;
  date: string;
};

export type SupportTicketAttachment = {
  name: string;
  uuid: string;
  uploadedBy: string;
  uploadedDate: string;
};

export type SupportTicketDeviceInfo = {
  userAgent?: string;
  language?: string;
  screenResolution?: string;
  timeZone?: string;
};
