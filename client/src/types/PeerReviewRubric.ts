import {
  CustomFormHeading,
  CustomFormPrompt,
  CustomFormTextBlock,
} from "./CustomForm";

export type PeerReviewRubric = {
  orgID: string;
  rubricID: string;
  isOrgDefault: boolean;
  rubricTitle: string;
  headings: CustomFormHeading[];
  textBlocks: CustomFormTextBlock[];
  prompts: CustomFormPrompt[];
};
