import { isEmptyString } from './util/helpers.js';

/**
 * Verifies that a given string is in the format 'MM-DD-YYY' and
 * will convert to a native Date object.
 * @param {String} value  - the date string to validate
 * @returns {Boolean} true if valid date string, false otherwise
 */
export const threePartDateStringValidator = (value) => {
    if (!isEmptyString(value)) { // validate
        const rawDate = String(value).split('-');
        const date = new Date(rawDate[2], rawDate[0]-1, rawDate[1]);
        if (!(date instanceof Date && !isNaN(date))) {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
};
