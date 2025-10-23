import { GenericKeyTextValueObj, User } from "../types";

export const SupportTicketPriorityOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "low",
    text: "Low (General Inquiries, Feature Requests)",
    value: "low",
  },
  {
    key: "medium",
    text: "Medium (Technical Issues, Account Issues, etc.)",
    value: "medium",
  },
  {
    key: "high",
    text: "High (Wide-Spread Issues, Time-Sensitive Requests)",
    value: "high",
  },
  {
    key: "severe",
    text: "Severe (Critical Issues, System-Wide Outages)",
    value: "severe",
  },
];

export const SupportTicketCategoryOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "general",
    text: "General Inquiry",
    value: "general",
  },
  {
    key: "adaptcode",
    text: "ADAPT Access Code",
    value: "adaptcode",
  },
  {
    key: "technical",
    text: "Technical Issue",
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
    text: "Delete Account",
    value: "delete-account",
  },
  {
    key: "other",
    text: "Other",
    value: "other",
  },
];

export const getPrettySupportTicketCategory = (category: string): string => {
  const foundCategory = SupportTicketCategoryOptions.find(
    (c) => c.value === category
  );
  return foundCategory ? foundCategory.text : "Unknown";
}

export const SupportTicketStatusOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "open",
    text: "Needs Triage",
    value: "open",
  },
  {
    key: "in_progress",
    text: "In Progress",
    value: "in_progress",
  },
  {
    key: "awaiting_requester",
    text: "Awaiting Requester",
    value: "awaiting_requester",
  },
  {
    key: "closed",
    text: "Closed",
    value: "closed",
  },
];

export const getPrettySupportTicketStatus = (status: string): string => {
  const foundStatus = SupportTicketStatusOptions.find(
    (s) => s.value === status
  );
  return foundStatus ? foundStatus.text : "Unknown";
};

export const supportTicketAttachmentAllowedTypes = [
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv", // .csv
  "application/json", // .json
  "text/plain", // .txt
  "text/html", // .html
  "application/vnd.oasis.opendocument.text", // .odt
  "image/*",
  "video/*",
  "application/pdf",
]