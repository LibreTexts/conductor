export type PeerReviewRubric = {
  orgID: string;
  rubricID: string;
  isOrgDefault: boolean;
  rubricTitle: string;
  headings: [
    {
      text: string;
      order: number;
    }
  ];
  textBlocks: [
    {
      text: string;
      order: number;
    }
  ];
  prompts: [
    {
      promptType:
        | "3-likert"
        | "5-likert"
        | "7-likert"
        | "text"
        | "dropdown"
        | "checkbox";
      promptText: string;
      promptRequired: boolean;
      promptOptions?: [
        {
          key?: string;
          value?: string;
          text?: string;
        }
      ];
      order: number;
    }
  ];
};
