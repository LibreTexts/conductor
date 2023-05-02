import { BaseDocument } from "./BaseDocument";

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
  headings?: {
    text: string;
    order: number;
  }[];
  textBlocks?: {
    text: string;
    order: number;
  }[];
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
