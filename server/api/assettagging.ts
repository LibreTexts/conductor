import { AssetTagInterface } from "../models/assettag.js";
import { AssetTagValueTypes } from "../util/assettags.js";

function validateAssetTag(tag: AssetTagInterface): boolean {
  if (!tag.title) return false;
  if (!tag.valueType || !AssetTagValueTypes.includes(tag.valueType))
    return false;
  if (tag.valueType === "dropdown" && !tag.options) return false;
  return true;
}

function validateAssetTagArray(tags: AssetTagInterface[]):boolean {
  for (const tag of tags) {
    if (!validateAssetTag(tag)) return false;
  }
  return true;
}


export {
  validateAssetTag,
  validateAssetTagArray,
}
