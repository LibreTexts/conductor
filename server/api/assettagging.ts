import { AssetTagInterface } from "../models/assettag.js";

function validateAssetTag(tag: AssetTagInterface): boolean {
  if (!tag.title) return false;
  if (!tag.value)
    return false;
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
