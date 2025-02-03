import { User, UserWCentralID } from "./User";

export type SupportTicketGuest = {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
};

export type SupportTicketPriority = "low" | "medium" | "high" | "severe";

export type SupportTicket = {
  uuid: string;
  title: string;
  description: string;
  apps?: number[]; // Central Identity app IDs
  attachments?: SupportTicketAttachment[];
  priority: SupportTicketPriority;
  status: "open" | "in_progress" | "closed";
  category: string;
  capturedURL?: string;
  assignedUUIDs?: string[]; // User uuids
  assignedUsers?: UserWCentralID[];
  user?: UserWCentralID;
  guest?: SupportTicketGuest;
  ccedEmails?: string[]; // Email addresses
  timeOpened: string;
  timeClosed?: string;
  feed: SupportTicketFeedEntry[];
  deviceInfo?: SupportTicketDeviceInfo;
  autoCloseTriggered?: boolean;
  autoCloseDate?: string;
  autoCloseSilenced?: boolean;
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
  type: 'internal' | 'general'; // internal = staff only, general = user & staff
};

export type SupportTicketFeedEntry = {
  action: string;
  blame: string;
  date: string;
}

export type SupportTicketAttachment = {
  name: string;
  uuid: string;
  uploadedBy: string;
  uploadedDate: string;
}

export type SupportTicketDeviceInfo = {
  userAgent?: string;
  language?: string;
  screenResolution?: string;
  timeZone?: string;
}