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
  assignedTo?: User;
  user?: User;
  guest?: SupportTicketGuest;
  timeOpened: string;
  timeClosed?: string;
};
