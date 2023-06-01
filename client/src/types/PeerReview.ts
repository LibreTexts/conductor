import { BaseDocument } from "./BaseDocument";
import { CustomFormHeading, CustomFormTextBlock } from "./CustomForm";

export type PeerReview = BaseDocument & {
  projectID: string;
  peerReviewID: string;
  rubricID: string;
  rubricTitle: string;
  author: string;
  authorEmail?: string;
  anonAuthor: boolean;
  authorType: "student" | "instructor";
  rating?: number;
  headings?: CustomFormHeading[];
  textBlocks?: CustomFormTextBlock[];
  responses: {
    promptType: string;
    promptText: string;
    promptRequired: boolean;
    likertResponse?: number;
    textResponse?: string;
    dropdownResponse?: string;
    checkboxResponse?: boolean;
    promptOptions?: {
      key?: string;
      value?: string;
      text?: string;
    }[];
    order: number;
  }[];
};
