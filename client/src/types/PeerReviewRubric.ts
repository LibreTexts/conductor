import {
  CustomFormHeading,
  CustomFormPrompt,
  CustomFormTextBlock,
} from "./CustomForm";
import { Organization } from "./Organization";

export type PeerReviewRubric = {
  orgID: string;
  rubricID: string;
  isOrgDefault: boolean;
  rubricTitle: string;
  headings: CustomFormHeading[];
  textBlocks: CustomFormTextBlock[];
  prompts: CustomFormPrompt[];
  organization?: Organization;
  updatedAt?: string;
  createdAt?: string;
};
