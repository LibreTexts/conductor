import isHexColor from "validator/es/lib/isHexColor";
import { Organization } from "../types";

/**
 * @description Ensures a given string is a safe hex code for use in styling
 * @param {string} hexString - unsafe string to check
 * @returns {string} - sanitized hex code with '#' prepended, empty string if sanitizing failed
 */
export function sanitizeCustomColor(hexString: string): string {
  if (typeof hexString !== "string" || hexString.length < 6) {
    return "";
  }

  if (hexString.charAt(0) !== "#") {
    hexString = `#${hexString}`;
  }

  if (isHexColor(hexString)) {
    return hexString;
  }

  return "";
}

export const DEFAULT_COMMONS_MODULES: NonNullable<
  Organization["commonsModules"]
> = {
  books: {
    enabled: true,
    order: 1,
  },
  assets: {
    enabled: true,
    order: 2,
  },
  projects: {
    enabled: true,
    order: 3,
  },
};
