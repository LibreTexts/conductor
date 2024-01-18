import { format, parseISO } from "date-fns";
import { ProjectFile, User } from "../types";
import { AssetTagTemplate, AssetTagValue } from "../types/AssetTagging";
import { isAssetTagTemplateArray } from "./typeHelpers";
import useGlobalError from "../components/error/ErrorHooks";
import axios from "axios";

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

/**
 * Formats a number of bytes as a UI-ready/human-readable string.
 *
 * @param {number} bytes - The file size in bytes.
 * @param {number} [dp=1] - Number of decimal points to round to.
 */
export function fileSizePresentable(bytes: number, dp = 1) {
  let fileBytes = bytes;
  const metric = 1000;
  if (Math.abs(fileBytes) < metric) {
    return `${fileBytes} B`;
  }

  const UNITS = ["KB", "MB", "GB", "TB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    fileBytes /= metric;
    ++u;
  } while (
    Math.round(Math.abs(fileBytes) * r) / r >= metric &&
    u < UNITS.length - 1
  );

  return `${fileBytes.toFixed(dp)} ${UNITS[u]}`;
}

export function getPrettyCreatedDate(createdDate: Date) {
  const date = format(parseISO(createdDate.toString()), "MM/dd/yy");

  const time = format(parseISO(createdDate.toString()), "h:mm aa");

  return `${date} at ${time}`;
}

export function getPrettyUploader(uploader: User) {
  if (uploader.firstName && uploader.lastName) {
    return `${uploader.firstName} ${uploader.lastName}`;
  }
  return "";
}

export function getPrettyAuthorsList(authors?: ProjectFile["authors"]) {
  if (!authors || !authors.length) return "Unknown";
  return authors.filter((a) => !!a.name).map((a) => a.name).join(", ") || "Unknown";
}

/**
 * Requests a download link from the server for a File entry, then opens it in a new tab.
 * @param {string} projectID - Identifier of the Project containing the File.
 * @param {string} fileID - Identifier of the File to download.
 */
export async function downloadFile(
  projectID: string,
  fileID: string
): Promise<boolean> {
  try {
    if (!fileID) return false;
    const downloadRes = await axios.get(
      `/project/${projectID}/files/${fileID}/download`
    );
    if (!downloadRes.data.err) {
      if (typeof downloadRes.data.url === "string") {
        window.open(downloadRes.data.url, "_blank", "noreferrer");
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
}
