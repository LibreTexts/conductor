import { BaseDocument } from "./BaseDocument";
import { TimeZoneOption } from "./Misc";
import {
  CustomFormHeading,
  CustomFormTextBlock,
  CustomFormPrompt,
} from "./CustomForm";
import { User } from "./User";

export type OrgEventParticipantFormResponse = {
  promptNum: number;
  responseVal?: string;
};

export type OrgEventParticipant = BaseDocument & {
  user: User;
  orgID: string;
  eventID: string;
  paymentStatus: "na" | "unpaid" | "paid" | "waived" | "partial_waived" | "refunded";
  formResponses: OrgEventParticipantFormResponse[];
  shippingAddress?: {
    lineOne: string;
    lineTwo?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
};

export type OrgEventFeeWaiver = BaseDocument & {
  name: string;
  eventID: string;
  percentage: number;
  code: string;
  expirationDate: Date;
  timeZone: TimeZoneOption;
  createdBy: string;
  active: boolean;
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
  timeZone: TimeZoneOption;
  headings: CustomFormHeading[];
  textBlocks: CustomFormTextBlock[];
  prompts: CustomFormPrompt[];
  participants: OrgEventParticipant[];
  feeWaivers: OrgEventFeeWaiver[];
  collectShipping: boolean;
  createdBy: string;
  canceled: boolean;
};
