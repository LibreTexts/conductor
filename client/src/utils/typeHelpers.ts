import {
  CatalogLocation,
  CustomFormHeading,
  CustomFormTextBlock,
  CustomFormPrompt,
  LicenseReport,
  InstructorVerifReqStatus,
  InstructorVerifReqStatuses,
  CentralIdentityUser,
  CentralIdentityVerificationRequest,
  Organization,
  KBPageEditor,
  AssetTagTemplate,
  AssetTagTemplateValueType,
  AssetTag,
  AssetTagFramework,
  AssetTagKey,
  Book,
  ProjectFile,
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

export const isKeyOfInstructorVerifReqStatus = (
  key: string
): key is InstructorVerifReqStatus => {
  return InstructorVerifReqStatuses.includes(key as InstructorVerifReqStatus);
};

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
};

export const isCentralIdentityUserProperty = (
  key: string
): key is keyof CentralIdentityUser => {
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
};

export const isCentralIdentityVerificationRequestProperty = (
  key: string
): key is keyof CentralIdentityVerificationRequest => {
  return (
    key === "user_id" ||
    key === "status" ||
    key === "bio_url" ||
    key === "decision_reason" ||
    key === "created_at" ||
    key === "updated_at"
  );
};

export const isOrganization = (obj: any): obj is Organization => {
  return "orgID" in obj && "name" in obj && "domain" in obj;
};

export const isKBPageEditor = (obj: any): obj is KBPageEditor => {
  if (!obj) return false;
  return "firstName" in obj && "lastName" in obj && "avatar" in obj;
};

export const isKBPageEditor = (obj: any): obj is KBPageEditor => {
  if (!obj) return false;
  return "firstName" in obj && "lastName" in obj && "avatar" in obj;
};

export const isAssetTagFramework = (value: any): value is AssetTagFramework => {
  return (
    "uuid" in value &&
    "name" in value &&
    "description" in value &&
    "orgID" in value &&
    "templates" in value &&
    "enabled" in value
  );
};

// Asset Tag TEMPLATES
export const isAssetTagTemplateValueType = (
  value: string
): value is AssetTagTemplateValueType => {
  return (
    value === "text" ||
    value === "number" ||
    value === "date" ||
    value === "boolean" ||
    value === "dropdown" ||
    value === "multiselect"
  );
};

export const isAssetTagTemplate = (value: any): value is AssetTagTemplate => {
  return (
    "key" in value &&
    "valueType" in value &&
    "isDeleted" in value &&
    isAssetTagTemplateValueType(value.valueType)
  );
};

export const isAssetTagTemplateArray = (
  value: any
): value is AssetTagTemplate[] => {
  return Array.isArray(value) && value.every((v) => isAssetTagTemplate(v));
};

// Asset Tags
export const isAssetTag = (value: any): value is AssetTag => {
  return (
    "uuid" in value &&
    "title" in value &&
    "value" in value &&
    "isDeleted" in value
  );
};

export const isAssetTagArray = (value: any): value is AssetTag[] => {
  return Array.isArray(value) && value.every((v) => isAssetTag(v));
};

export const isAssetTagKeyObject = (value: any): value is AssetTagKey => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  return "orgID" in value && "title" in value && "hex" in value;
};

// Book
export const isBook = (obj: any): obj is Book => {
  if (!obj) return false;
  if (typeof obj !== "object") return false;
  return (
    "bookID" in obj &&
    "title" in obj &&
    "author" in obj &&
    "affiliation" in obj &&
    "library" in obj &&
    "subject" in obj &&
    "location" in obj &&
    "course" in obj &&
    "program" in obj &&
    "license" in obj &&
    "thumbnail" in obj &&
    "summary" in obj &&
    "links" in obj &&
    "lastUpdated" in obj &&
    "libraryTags" in obj
  );
};

// Project Files
export const isProjectFile = (obj: any): obj is ProjectFile => {
  if (!obj) return false;
  if (typeof obj !== "object") return false;
  return (
    "fileID" in obj &&
    "name" in obj &&
    "access" in obj &&
    "storageType" in obj &&
    "size" in obj &&
    "description" in obj
  );
};
