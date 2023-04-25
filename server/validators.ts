import { isEmptyString } from "./util/helpers.js";

/**
 * Verifies that a given string is in the format 'MM-DD-YYY' and
 * will convert to a native Date object.
 * @param {String} value  - the date string to validate
 * @returns {Boolean} true if valid date string, false otherwise
 */
export const threePartDateStringValidator = (value: string) => {
  if (isEmptyString(value)) {
    return false;
  }
  // validate
  const rawDate = String(value).split("-");
  const date = new Date(
    parseInt(rawDate[2]),
    parseInt(rawDate[0]) - 1,
    parseInt(rawDate[1])
  );
  if (!(date instanceof Date)) {
    return false;
  } else {
    return true;
  }
};
