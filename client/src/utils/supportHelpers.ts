import { GenericKeyTextValueObj, SupportTicket, User } from "../types";

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
    key: "accessibility",
    text: "Accessibility",
    value: "accessibility",
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
    key: "assigned",
    text: "Assigned",
    value: "assigned",
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

// Privacy Inquiry tickets
type Option = { value: string; label: string };

export const PrivacyRequestTypeOptions: Option[] = [
  { value: "access", label: "Access my data" },
  { value: "correction", label: "Correct my data" },
  { value: "deletion", label: "Delete my data" },
  { value: "marketing_opt_out", label: "Opt out of marketing" },
  { value: "parent_guardian", label: "Parent or guardian request for a child" },
  { value: "legal_disclosure", label: "Legal or third-party disclosure request" },
  { value: "appeal", label: "Appeal of a prior decision" },
  { value: "general", label: "General privacy question" },
];

export const PrivacyIntakeChannelOptions: Option[] = [
  { value: "support_form", label: "Support Center form" },
  { value: "email", label: "Email forwarded by staff" },
  { value: "postal_mail", label: "Postal mail" },
  { value: "phone", label: "Phone" },
  { value: "institution_referral", label: "Referred by a school or institution" },
];

export const PrivacyProductOptions: Option[] = [
  { value: "libraries", label: "Libraries" },
  { value: "adapt", label: "ADAPT" },
  { value: "conductor", label: "Conductor" },
  { value: "libreone", label: "LibreOne" },
  { value: "academy_online", label: "Academy Online" },
  { value: "connections", label: "Connections" },
  { value: "forge", label: "Forge" },
  { value: "jupyterhub", label: "JupyterHub" },
  { value: "store", label: "Store" },
];

export const PrivacyVerificationOptions: Option[] = [
  { value: "registered_email", label: "Registered email" },
  { value: "signed_in_session", label: "Signed-in session" },
  { value: "proof_of_authority", label: "Proof of authority received" },
  { value: "could_not_verify", label: "Could not verify" },
];

export const PrivacyOutcomeOptions: Option[] = [
  { value: "fulfilled", label: "Fulfilled" },
  { value: "partly_fulfilled", label: "Partly fulfilled" },
  { value: "denied", label: "Denied" },
  { value: "referred", label: "Referred to institution" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "could_not_verify", label: "Could not verify identity" },
];

export const PrivacyDenialBasisOptions: Option[] = [
  { value: "identity_not_verified", label: "Identity not verified" },
  { value: "school_record", label: "Record controlled by a school" },
  { value: "legal_obligation", label: "Legal hold or obligation" },
  { value: "policy_exception", label: "Exception listed in the policy" },
  { value: "third_party_privacy", label: "Would affect another person's privacy" },
  { value: "other", label: "Other (explain)" },
];

export const PRIVACY_DENIAL_OUTCOMES = ["partly_fulfilled", "denied", "could_not_verify"];

export const getOptionLabel = (options: Option[], value?: string): string =>
  options.find((o) => o.value === value)?.label ?? "—";

export const isPrivacyOverdue = (ticket: Pick<SupportTicket, "privacy" | "status">): boolean =>
  !!ticket.privacy?.dueDate &&
  ticket.status !== "closed" &&
  new Date(ticket.privacy.dueDate).getTime() < Date.now();

export const isPrivacyIdentityVerified = (privacy: NonNullable<SupportTicket["privacy"]>): boolean =>
  !!privacy.identityVerification?.method && privacy.identityVerification.method !== "could_not_verify";

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
  "text/markdown", // .md
  "application/vnd.oasis.opendocument.text", // .odt
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf", // .pdf
  "model/gltf-binary", // .glb
  ".glb", // .glb (extension fallback; no MIME registered on Windows)
  "model/obj", // .obj
  ".obj", // .obj (extension fallback; no MIME registered on Windows)
  "model/stl", // .stl
  ".stl", // .stl (extension fallback; no MIME registered on Windows)
  "application/zip", // .zip
  "application/x-zip-compressed", // .zip (sometimes used on Windows)
  "application/vnd.ims.imsccv1p1+zip", // .imscc (Common Cartridge v1.1)
  "application/vnd.ims.imsccv1p2+zip", // .imscc (Common Cartridge v1.2)
  "application/vnd.ims.imsccv1p3+zip", // .imscc (Common Cartridge v1.3)
  ".imscc", // .imscc (extension fallback; browsers report no MIME for it)
  "text/x-tex", // .tex
  "text/vtt", // .vtt
  "application/x-ipynb+json", // .ipynb
  ".ipynb", // .ipynb (extension fallback; no MIME registered)
  "application/vnd.ms-access", // .accdb
  ".accdb", // .accdb (extension fallback; no MIME registered)
]