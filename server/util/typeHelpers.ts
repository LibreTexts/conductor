import { BookSortOption } from "../types";
import { AssetTagKeyInterface } from "../models/assettagkey.js";

export const isBookSortOption = (text: string): text is BookSortOption => {
    return (
        text === "title" ||
        text === "author" ||
        text === "random"
    );
}

export const isAssetTagKeyObject = (value: any): value is AssetTagKeyInterface => {
  if(!value) return false;
  if(typeof value !== "object") return false;
  return (
    "orgID" in value &&
    "title" in value &&
    "hex" in value
  );
}