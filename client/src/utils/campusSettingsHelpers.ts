import isHexColor from "validator/es/lib/isHexColor";

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
