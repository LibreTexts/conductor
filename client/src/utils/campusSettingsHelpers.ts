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

/**
 * Picks black or white text, whichever contrasts more with a 6-digit hex background.
 * One of the two always reaches at least 4.58:1, so the result passes WCAG AA for any color.
 */
export function readableTextColor(hexBackground: string): "#000000" | "#ffffff" {
  const channels = hexBackground.replace("#", "").match(/[0-9a-f]{2}/gi) ?? [];
  const [r, g, b] = channels.map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  // Contrast with black is (L + 0.05) / 0.05; with white, 1.05 / (L + 0.05).
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
