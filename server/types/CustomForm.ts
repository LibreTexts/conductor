export type CustomFormHeadingType = {
  text: string;
  order: number;
};

export type CustomFormTextBlockType = {
  text: string;
  order: number;
};

export type CustomFormPromptType = {
  promptType:
    | "3-likert"
    | "5-likert"
    | "7-likert"
    | "text"
    | "dropdown"
    | "checkbox";
  promptText: string;
  promptRequired: boolean;
  promptOptions?: {
    key?: string;
    value?: string;
    text?: string;
  }[];
  order: number;
};
