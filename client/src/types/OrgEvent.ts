import { BaseDocument } from "./BaseDocument";
import {
  CustomFormHeading,
  CustomFormTextBlock,
  CustomFormPrompt,
} from "./CustomForm";
import { User } from "./User";

export type OrgEventParticipant = BaseDocument & {
  user: User;
  paymentStatus: "na" | "unpaid" | "paid";
  formResponses: { promptNum: number; responseVal?: string }[];
};

export type OrgEvent = BaseDocument & {
  _id: string;
  orgID: string;
  eventID: string;
  title: string;
  description?: string;
  regFee?: number;
  regOpenDate: Date;
  regCloseDate: Date;
  startDate: Date;
  endDate: Date;
  headings: CustomFormHeading[];
  textBlocks: CustomFormTextBlock[];
  prompts: CustomFormPrompt[];
  participants: OrgEventParticipant[];
  createdBy: string;
  canceled: boolean;
};
