import { User } from "./User";

export enum AccountRequestPurpose {
  OER = "oer",
  H5P = "h5p",
  ADAPT = "adapt",
  ANALYTICS = "analytics",
}

export type AccountRequestUser = Pick<
  User,
  | "uuid"
  | "firstName"
  | "lastName"
  | "avatar"
  | "email"
  | "instructorProfile"
  | "verifiedInstructor"
>;

export type AccountRequest = {
  _id: string;
  status: "open" | "completed";
  requester: AccountRequestUser;
  purpose: AccountRequestPurpose;
  libraries?: string[];
  moreInfo?: boolean;
  createdAt?: Date;
};
