//
// LibreTexts Conductor
// helpers.js
//

const { validate: uuidValidate } = require('uuid');


/**
 * Checks that a string has a (trimmed) length greater than 0.
 * @param {String} str - The string to validate.
 * @returns {Boolean} True if non-empty or not a string, false otherwise.
 */
const isEmptyString = (str) => {
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
const truncateString = (str, len) => {
    if (str.length > len) {
        let subString = str.substring(0, len);
        return subString + "...";
    } else {
        return str;
    }
};


/**
 * Constructs a basic array with OrgIDs given
 * an array of Role objects.
 */
const buildOrgArray = (roles) => {
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
const validateUUIDArray = (arr) => {
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
const threePartDateStringToDate = (value) => {
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
const ensureUniqueStringArray = (arr) => {
    if (Array.isArray(arr)) {
        let uniqueValues = [];
        arr.forEach((item) => {
            if (!uniqueValues.includes(item)) uniqueValues.push(item);
        });
        return uniqueValues;
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
const stringContainsOneOfSubstring = (str, arr, returnStr) => {
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
 * Returns the production URL set in the server's environment variables.
 * @returns {String} the first production URL or an empty string if not found.
 */
const getProductionURL = () => {
    let prodURLs = String(process.env.PRODUCTIONURLS).split(',');
    if (Array.isArray(prodURLs) && prodURLs.length > 0) return prodURLs[0];
    return '';
};


module.exports = {
    isEmptyString,
    truncateString,
    buildOrgArray,
    validateUUIDArray,
    threePartDateStringToDate,
    ensureUniqueStringArray,
    stringContainsOneOfSubstring,
    getProductionURL
};
