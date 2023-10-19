import { AssetTagKeyInterface } from "../models/assettagkey.js";

export const isAssetTagKeyObject = (value: any): value is AssetTagKeyInterface => {
  if(!value) return false;
  if(typeof value !== "object") return false;
  return (
    "orgID" in value &&
    "title" in value &&
    "hex" in value
  );
}