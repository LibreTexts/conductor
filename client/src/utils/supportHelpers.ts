import { GenericKeyTextValueObj } from "../types";

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

export const SupportTicketCategoryOptions: GenericKeyTextValueObj<string>[] = [{
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
  key: "integrate",
  text: "Integrating LibreTexts Content/Platform",
  value: "integrate",
},
{
  key: "other",
  text: "Other",
  value: "other",
}
]
