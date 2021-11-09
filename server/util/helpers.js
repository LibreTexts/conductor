//
// LibreTexts Conductor
// helpers.js
//

const { validate: uuidValidate } = require('uuid');


/**
 * Checks that the provided argument @str is a string
 * with a (whitespace-removed) length greater than 0.
 */
const isEmptyString = (str) => {
    if (typeof str === 'string') {
        return (!str || str.trim().length === 0 );
    } else {
        return false;
    }
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


module.exports = {
    isEmptyString,
    truncateString,
    buildOrgArray,
    validateUUIDArray,
    threePartDateStringToDate
};
