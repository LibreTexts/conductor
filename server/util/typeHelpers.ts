import { BookSortOption, CentralIdentityVerificationRequestStatus } from "../types";
import { AssetTagKeyInterface } from "../models/assettagkey.js";
import { AssetTagFrameworkInterface } from "../models/assettagframework";
import { Types } from "mongoose";
import { z } from "zod";
import { AuthorInterface } from "../models/author";

export const isBookSortOption = (text: string): text is BookSortOption => {
  return text === "title" || text === "author" || text === "random";
};

export const isAssetTagKeyObject = (
  value: any
): value is AssetTagKeyInterface => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  return "orgID" in value && "title" in value && "hex" in value;
};

export const isAssetTagFrameworkObject = (
  value: any
): value is AssetTagFrameworkInterface => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  return "orgID" in value && "name" in value && "uuid" in value;
};

export const compareMongoIDs = (firstID: any, secondID: any): boolean => {
  // If either ID is null or undefined, return false
  if (!firstID || !secondID) return false;

  // Convert both IDs to strings
  const parsedFirstID = firstID.toString();
  const parsedSecondID = secondID.toString();

  // If either ID does not exist, return false
  if (!parsedFirstID || !parsedSecondID) return false;

  // Attempt to convert both IDs to ObjectIDs
  const firstIDtoOID = new Types.ObjectId(parsedFirstID);
  const secondIDtoOID = new Types.ObjectId(parsedSecondID);

  // Use the ObjectID.equals() method to compare the two IDs
  return firstIDtoOID.equals(secondIDtoOID);
};

function _getDefaultsFromSchema<Schema extends z.AnyZodObject>(schema: Schema) {
  return Object.fromEntries(
    Object.entries(schema.shape).map(([key, value]) => {
      if (value instanceof z.ZodDefault)
        return [key, value._def.defaultValue()];
      return [key, undefined];
    })
  );
}

export function getSchemaWithDefaults<Schema extends z.AnyZodObject>(
  actual: z.infer<typeof schema>,
  schema: Schema
) {
  const defaults = _getDefaultsFromSchema(schema);
  return Object.assign(defaults, actual);
}

export function isAuthorObject(value: any): value is AuthorInterface {
  if (!value) return false;
  if (typeof value !== "object") return false;
  return "firstName" in value && "lastName" in value;
}

export function isCentralIdentityVerificationRequestStatus(
  text: string
): text is CentralIdentityVerificationRequestStatus {
  return (
    text === "approved" ||
    text === "denied" ||
    text === "needs_change" ||
    text === "open"
  );
}