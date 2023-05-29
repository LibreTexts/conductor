import { GenericKeyTextValueObj } from "../../types";

export const customFormPromptTypes: GenericKeyTextValueObj<string>[] = [
  { key: "3-likert", text: "3-Point Likert", value: "3-likert" },
  { key: "5-likert", text: "5-Point Likert", value: "5-likert" },
  { key: "7-likert", text: "7-Point Likert", value: "7-likert" },
  { key: "text", text: "Text Response", value: "text" },
  { key: "dropdown", text: "Dropdown", value: "dropdown" },
  { key: "checkbox", text: "Checkbox", value: "checkbox" },
];
