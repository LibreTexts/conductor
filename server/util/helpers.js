//
// LibreTexts Conductor
// helpers.js
//
import { validate as uuidValidate } from 'uuid';
import { format as formatDate, parseISO } from "date-fns";
import validator from 'validator';

/**
 * Checks that a string has a (trimmed) length greater than 0.
 * @param {String} str - The string to validate.
 * @returns {Boolean} True if non-empty or not a string, false otherwise.
 */
export const isEmptyString = (str) => {
    if (typeof(str) === 'string') return (!str || str.trim().length === 0);
    return false;
};


/**
 * Accepts a string and returns it truncated to the
 * specified length. If the string is already shorter
 * than specified length, the original string is returned.
 * @param {string} str - the string to truncate
 * @param {number} len - the integer specifying the number
 *                       of characters to allow before truncation
 * @returns {string} the truncated (if applicable) string
 */
export const truncateString = (str, len) => {
    if (str.length > len) {
        let subString = str.substring(0, len);
        return subString + "...";
    } else {
        return str;
    }
};

/**
 * Accepts a string and returns the same string with the first letter capitalized.
 * @param {String} str - The string to modify.
 * @returns {String} The modified string.
 */
export const capitalizeFirstLetter = (str) => {
  if (typeof(str) !== 'string' || str.length === 0) {
    return '';
  }
  if(str.length === 1) return str[0].toUpperCase();
  return str.charAt(0).toUpperCase() + str.slice(1);
};


/**
 * Constructs a basic array with OrgIDs given
 * an array of Role objects.
 */
export const buildOrgArray = (roles) => {
    var orgs = [];
    roles.forEach((item) => {
        if (item.org) {
            orgs.push(item.org);
        }
    });
    return orgs;
};


/**
 * Validates that an array of strings contains only UUIDs.
 * @param {string[]} arr  - the array of strings to validate
 * @returns {Boolean} true if valid array, false otherwise.
 */
export const validateUUIDArray = (arr) => {
    if (Array.isArray(arr)) {
        let validArray = true;
        arr.forEach((item) => {
            if (typeof(item) !== 'string' || !uuidValidate(item)) {
                validArray = false;
            }
        });
        return validArray
    }
    return false;
};



/**
 * Attempts to convert a given string in the format 'MM-DD-YYYY' to
 * a native Date object.
 * @param {String} value  - the date string to convert
 * @returns {(Date|null)} Date if valid, null otherwise
 */
export const threePartDateStringToDate = (value) => {
    try {
        let dateComp = String(value).split('-');
        let month, day, year;
        if (dateComp.length == 3) {
            month = parseInt(dateComp[0]) - 1;
            day = parseInt(dateComp[1]);
            year = parseInt(dateComp[2]);
        }
        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    } catch (err) {
        return null;
    }
    return null;
};


/**
 * Returns an array of strings with duplicates filtered out.
 * @param {String[]} arr - the array to filter.
 * @returns {String[]} the unique array of strings
 */
export const ensureUniqueStringArray = (arr) => {
    if (Array.isArray(arr)) {
        return Array.from(new Set(arr.filter((item) => item))); // filter empty strings
    }
    return [];
};


/**
 * Check if a string contains any of the substrings in the provided array.
 * @param {String} str - the string to check.
 * @param {String[]} arr - the array of substrings to look for.
 * @param {Boolean} [returnStr] - return the first found substring as part of an object (optional).
 * @returns {Boolean|Object} Boolean of search result, or an object with the result boolean and the first matched substring.
 */
export const stringContainsOneOfSubstring = (str, arr, returnStr) => {
    let contains = false;
    let foundSubstring = '';
    if (typeof(str) === 'string' && Array.isArray(arr)) {
        arr.forEach((item) => {
            if (!contains && typeof(item) === 'string' && str.includes(item)) {
                contains = true;
                foundSubstring = item;
            }
        });
    }
    if (typeof(returnStr) === 'boolean' && returnStr === true) {
        return {
            result: contains,
            substr: foundSubstring
        };
    }
    return contains;
};


/**
 * Checks if a native Date is properly instantiated.
 * @param {Object} date - The Date object to validate.
 */
export const isValidDateObject = (date) => {
    return date instanceof Date && !isNaN(date);
};


/**
 * Computes the difference (in milliseconds) between two dates.
 * @param {Date} date1 - The first date object.
 * @param {Date} date2 - The second date object.
 * @returns {number} The difference in milliseconds.
 */
export const computeDateDifference = (date1, date2) => {
    if (isValidDateObject(date1) && isValidDateObject(date2)) {
        return Math.abs(date2 - date1);
    }
    return 0;
};


/**
 * Creates and validates a new Date from a provided date string.
 * @param {string} dateString - The date string to use in instantiation.
 * @returns {Date|null} A date object if successfully created, null otherwise.
 */
export const createAndValidateDateObject = (dateString) => {
    let newDate = null;
    const dateObj = new Date(dateString);
    if (isValidDateObject(dateObj)) newDate = dateObj;
    return newDate;
};

/**
 * Safely parse and format a date string or Date object to desired display format.
 *
 * @param date - Date object or ISO date string to parse.
 * @returns Formatted date string.
 */
export function parseAndFormatDate(date, formatString) {
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


/**
 * Returns the production URL set in the server's environment variables.
 *
 * @returns {string} The production URL or an empty string if not found.
 */
export const getProductionURL = () => {
    return process.env.CONDUCTOR_DOMAIN || '';
};

/**
 * Removes a leading slash, if any, from a string.
 *
 * @param {string} str - The string to work on.
 * @returns {string} The string with the leading slash removed.
 */
export function removeLeadingSlash(str) {
  return str.startsWith('/') ? str.slice(1) : str;
}

/**
 * Removes a trailing slash, if any, from a given string.
 *
 * @param {string} str - The string to work on.
 * @returns {string} The string with the trailing slash removed.
 */
export function removeTrailingSlash(str) {
  return str.endsWith('/') ? str.slice(0, -1) : str;
}

/**
 * Assembles a url given an array of parts.
 *
 * @param {string[]} parts - Array of strings to include in the URL, in desired order.
 * @returns {string} The assembled url, or empty string if error encountered.
 */
export function assembleUrl(parts) {
  if (!Array.isArray(parts)) {
    return '';
  }
  let url = '';
  for (let i = 0, n = parts.length; i < n; i += 1) {
    const currPart = parts[i];
    if (!isEmptyString(currPart)) {
      if (!url.endsWith('/') && url.trim().length > 1) {
        url = `${url}/`;
      }
      if (currPart.startsWith('/')) {
        url = `${url}${currPart.slice(1, currPart.length)}`;
      } else {
        url = `${url}${currPart}`;
      }
    }
  }
  return url;
}

/**
 * Validates that a string is a fully-qualified URL.
 *
 * @param {string} input - String to validate.
 * @returns {boolean} True if string is a fully-qualified URL.
 */
export function isFullURL(input) {
  try {
    const url = new URL(input);
    return !!url;
  } catch (e) {
    return false;
  }
}

/**
 * @description Ensures a given string is a safe hex code for use in styling
 * @param {string} hexString - unsafe string to check
 * @returns {string} - sanitized hex code with '#' prepended, empty string if sanitizing failed
 */
export function sanitizeCustomColor(hexString) {
  if (typeof hexString !== "string" || hexString.length < 6) {
    return "";
  }

  if (hexString.charAt(0) !== "#") {
    hexString = `#${hexString}`;
  }

  if (validator.isHexColor(hexString)) {
    return hexString;
  }

  return "";
}

/**
 * Calculates skip offset for server-side pagination
 * @param {number} page - Active page number (integer)
 * @param {number} offsetMultiplier - Number of records to return for each page
 * @returns {number} - The number of records to offset, or 0 if an error was encountered
 */
export function getPaginationOffset(page, offsetMultiplier = 25) {
  const parsedPage = parseInt(page);
  const parsedMultiplier = parseInt(offsetMultiplier);
  if (!Number.isInteger(parsedPage) || !Number.isInteger(parsedMultiplier)) {
    return 0;
  }

  let offset = 0;
  if (parsedPage > 1) {
    offset = (parsedPage - 1) * offsetMultiplier;
  }

  return offset;
}

/**
 * Generates a random number between 0 and max
 * @param {Number} max - The maximum number to generate a random offset for 
 * @returns {Number} - A random number between 0 and max
 */
export function getRandomOffset(max){
  return Math.floor(Math.random() * max);
}

/**
 * Breaks up a url into the subdomain and path
 * @param {string} url
 * @returns {string[]}
 */
export function parseLibreTextsURL(url) {
  if (url.includes('?')) //strips any query parameters
      url = url.split('?')[0];
  if (url && url.match(/https?:\/\/.*?\.libretexts\.org/)) {
      return [url.match(/(?<=https?:\/\/).*?(?=\.)/)[0], url.match(/(?<=https?:\/\/.*?\/).*/)[0]]
  }
  else {
      return [];
  }
}

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getSubdomainFromUrl(url){
  const hostname = new URL(url).hostname;
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}