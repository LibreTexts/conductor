import { GenericKeyTextValueObj, User } from "../types";

export const SupportTicketPriorityOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "low",
    text: "Low",
    value: "low",
  },
  {
    key: "medium",
    text: "Medium",
    value: "medium",
  },
  {
    key: "high",
    text: "High",
    value: "high",
  },
];

export const SupportTicketCategoryOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "general",
    text: "General Inquiry",
    value: "general",
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

export const isSupportStaff = (user?: User): boolean => {
  if (!user || !user.uuid) return false;
  if (user.isSuperAdmin) return true;
  const foundRole = user.roles.find(
    (r) => r.org === "libretexts" && r.role === "support"
  );
  return !!foundRole;
};
