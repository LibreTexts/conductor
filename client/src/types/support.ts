import { User } from "./User";

export type SupportTicketGuest = {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
};

export type SupportTicket = {
  uuid: string;
  title: string;
  description: string;
  apps: number[]; // Central Identity app IDs
  attachments?: string[];
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "closed";
  category: string;
  capturedURL?: string;
  assignedUsers?: User[];
  user?: User;
  guest?: SupportTicketGuest;
  timeOpened: string;
  timeClosed?: string;
  feed: SupportTicketFeedEntry[];
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
};

export type SupportTicketFeedEntry = {
  action: string;
  blame: string;
  date: string;
}
