import { format as formatDate, parseISO } from "date-fns";
import { GenericKeyTextValueObj } from "../types";

/**
 *
 * @param {GenericKeyTextValueObj<string>} options - array of valid sort option objects
 * @param {string} value - value to check
 * @returns Given value if valid, otherwise the first option in given array. Returns empty string if error is encountered
 */
export function parseSortOption(
  options: GenericKeyTextValueObj<string>[],
  value?: string
): string {
  let validSortOptions: string[] = [];
  options.map((item) => {
    validSortOptions.push(item.key);
  });

  if (validSortOptions.length === 0) {
    return "";
  }

  if (value && validSortOptions.includes(value)) {
    return value;
  }

  return validSortOptions[0];
}

/**
 * Safely parse and format a date string or Date object to desired display format.
 *
 * @param date - Date object or ISO date string to parse.
 * @returns Formatted date string.
 */
export function parseAndFormatDate(date: Date | string, formatString: string) {
  try {
    if (date instanceof Date) {
      return formatDate(date, formatString);
    }
    return formatDate(parseISO(date), formatString);
  } catch (e) {
    console.error(e);
  }
  return "Unknown Date";
}
