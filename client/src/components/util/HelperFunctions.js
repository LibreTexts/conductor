//
// LibreTexts Conductor
// HelperFunctions.js
//

/**
 * Accepts a string and checks if it is empty.
 * @param {string} str - the string to check
 * @returns {boolean} true if the string is empty,
 *                    false if non-empty or not a string
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
 * Accepts a string and returns the same string
 * with the first letter capitalized.
 * @param {string} str - the string to modify
 * @returns {string} the modified string
 */
const capitalizeFirstLetter = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};


/**
 * Accepts a URL or URL search string and updates
 * or inserts the a URL paramter with the a new value.
 * @param {string} url   - the full URL or search string to modify
 * @param {string} param - the name of the parameter to update
 * @param {string} value - the new value to set for the URL parameter
 * @returns {string} the updated URL
 */
const updateParams = (url, param, value) => {
    var i = url.indexOf('#');
    var hash = i === -1 ? ''  : url.substr(i);
         url = i === -1 ? url : url.substr(0, i);

    var re = new RegExp("([?&])" + param + "=.*?(&|$)", "i");
    var separator = url.indexOf('?') !== -1 ? "&" : "?";
    if (url.match(re)) {
        url = url.replace(re, '$1' + param + "=" + value + '$2');
    } else {
        url = url + separator + param + "=" + value;
    }
    return url + hash;
};


/**
 * Accepts a password string and validates it against Conductor
 * password standards.
 * @param {string} passInput - the password to validate
 * @returns {boolean} true if password is valid, false otherwise
 */
const validatePassword = (passInput) => {
    if (typeof(passInput) === 'string') {
        if ((passInput.length > 9) && (/\d/.test(passInput))) {
            return true;
        }
    }
    return false;
};


/**
 * Accepts a string containing a URL and attempts to normalize it
 * to include protocol.
 * @param {string} url - the URL to normalize.
 * @returns {string} the normalized URL
 */
const normalizeURL = (url) => {
    if (typeof(url) === 'string') {
        if (url.match(/^(http|https):\/\//g) === null) {
            return 'https://' + url;
        }
        return url;
    } else {
        return '';
    }
};


module.exports = {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter,
    updateParams,
    validatePassword,
    normalizeURL
};
