import { GenericKeyTextValueObj } from "./Misc";

export type CustomFormHeading = {
  text: string;
  order: number;
};

export type CustomFormTextBlock = {
  text: string;
  order: number;
};

export type CustomFormPromptType =
  | "3-likert"
  | "5-likert"
  | "7-likert"
  | "text"
  | "dropdown"
  | "checkbox";

export type CustomFormPrompt = {
  promptType: CustomFormPromptType;
  promptText: string;
  promptRequired: boolean;
  promptOptions?: GenericKeyTextValueObj<string>[];
  order: number;
  value?: string | number | boolean;
};

export type CustomFormBlockType =
  | CustomFormHeading
  | CustomFormTextBlock
  | CustomFormPrompt;

export type CustomFormUIType = "heading" | "textBlock" | "prompt";

/**
 * UI-Ready mapping of CustomFormBlockType
 */
export type CustomFormElement = CustomFormBlockType & {
  uiType: CustomFormUIType;
};
