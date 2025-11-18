import { z } from "zod";
import { Organization } from "../types";

// Zod schema for hex color validation
const hexColorSchema = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
  message: "Invalid hex color format"
});

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

  // Use zod to validate hex color
  const result = hexColorSchema.safeParse(hexString);
  if (result.success) {
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
  minirepos: {
    enabled: true,
    order: 3,
  },
  projects: {
    enabled: true,
    order: 4,
  },
  authors: {
    enabled: true,
    order: 5,
  }
};