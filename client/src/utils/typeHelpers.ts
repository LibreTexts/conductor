import {
  CatalogLocation,
  CustomFormHeading,
  CustomFormTextBlock,
  CustomFormPrompt,
  LicenseReport,
  InstructorVerifReqStatus,
  InstructorVerifReqStatuses,
  CentralIdentityUser,
} from "../types";

export function isCatalogLocation(
  location: string
): location is CatalogLocation {
  return ["central", "campus", "all"].includes(location);
}

export function hasMessage(obj: any): obj is { message: string } {
  return "message" in obj;
}

export function hasResponse(obj: any): obj is { response: any } {
  return "response" in obj;
}

export function hasErrorData(obj: any): obj is { data: object } {
  return "data" in obj;
}

export function hasErrorDataMsg(obj: any): obj is { errMsg: string } {
  return "errMsg" in obj;
}

export function hasErrorDataErrors(obj: any): obj is { errors: any[] } {
  return "errors" in obj;
}

export function hasErrorStatusCode(obj: any): obj is { statusCode: number } {
  return "statusCode" in obj;
}

export function isLicenseReport(obj: any): obj is LicenseReport {
  return (
    "coverID" in obj &&
    "id" in obj &&
    "library" in obj &&
    "timestamp" in obj &&
    "runtime" in obj
  );
}

export function isCustomFormHeadingOrTextBlock(
  obj: any
): obj is CustomFormHeading | CustomFormTextBlock {
  return "text" in obj && "order" in obj;
}

export function isCustomFormPromptBlock(obj: any): obj is CustomFormPrompt {
  return "promptType" in obj && "promptText" in obj;
}

export const isKeyOfInstructorVerifReqStatus = (key: string): key is InstructorVerifReqStatus => {
  return InstructorVerifReqStatuses.includes(key as InstructorVerifReqStatus);
}

export const isCentralIdentityUser = (obj: any): obj is CentralIdentityUser => {
  return (
    "active" in obj &&
    "avatar" in obj &&
    "createdAt" in obj &&
    "disabled" in obj &&
    "email" in obj &&
    "enabled" in obj &&
    "expired" in obj &&
    "external_idp" in obj &&
    "external_subject_id" in obj &&
    "first_name" in obj &&
    "last_name" in obj &&
    "last_password_change" in obj &&
    "legacy" in obj &&
    "organizations" in obj &&
    "registration_complete" in obj &&
    "updatedAt" in obj &&
    "user_type" in obj &&
    "uuid" in obj &&
    "verify_status" in obj
  );
}

export const isCentralIdentityUserProperty = (key: string): key is keyof CentralIdentityUser => {
  return (
    key === "active" ||
    key === "avatar" ||
    key === "createdAt" ||
    key === "disabled" ||
    key === "email" ||
    key === "enabled" ||
    key === "expired" ||
    key === "external_idp" ||
    key === "external_subject_id" ||
    key === "first_name" ||
    key === "last_name" ||
    key === "last_password_change" ||
    key === "legacy" ||
    key === "organizations" ||
    key === "registration_complete" ||
    key === "updatedAt" ||
    key === "user_type" ||
    key === "uuid" ||
    key === "verify_status"
  );
}



