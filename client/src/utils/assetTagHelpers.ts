import { AssetTag } from "../types";
import { isAssetTagArray } from "./typeHelpers";

/**
 * Loops through all tags and removes any empty options
 * If a tag is not a dropdown, it will remove the options array
 * @returns {void}
 */
export function cleanDropdownOptions(tags: AssetTag[]): AssetTag[] {
  if (!isAssetTagArray(tags)) return tags;

  tags.forEach((tag) => {
    if (tag.valueType === "dropdown") {
      tag.options = tag.options?.filter((o) => o !== "");
    } else {
      tag.options = undefined;
    }
  });

  return tags;
}
