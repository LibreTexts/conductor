import { ProjectFile } from "../types";
import { AssetTagTemplate, AssetTagValue } from "../types/AssetTagging";
import { isAssetTagTemplateArray } from "./typeHelpers";

/**
 * Loops through all tags and removes any empty options
 * If a tag is not a dropdown/multiselect, it will remove the options array
 * @returns {void}
 */
export function cleanDropdownOptions(
  tags: AssetTagTemplate[]
): AssetTagTemplate[] {
  if (!isAssetTagTemplateArray(tags)) return tags;

  tags.forEach((tag) => {
    if (tag.valueType === "dropdown") {
      tag.options = tag.options?.filter((o) => o !== "");
    } else if (tag.valueType === "multiselect") {
      tag.options = tag.options?.filter((o) => o !== "");
    } else {
      tag.options = undefined;
    }
  });

  return tags;
}

export function getInitValueFromTemplate(tag: AssetTagTemplate): AssetTagValue {
  if (tag.defaultValue) {
    return tag.defaultValue;
  }

  switch (tag.valueType) {
    case "multiselect":
      return [] as string[];
    case "dropdown":
      return tag.options?.[0] || "";
    case "boolean":
      return false;
    case "number":
      return 0;
    case "date":
      return new Date();
    case "text":
    default:
      return "";
  }
}