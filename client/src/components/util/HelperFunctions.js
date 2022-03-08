//
// LibreTexts Conductor
// HelperFunctions.js
//

/**
 * Accepts a string and checks if it is empty.
 * @param {String} str - The string to check.
 * @returns {Boolean} True if the string is empty, false if non-empty or not a string.
 */
const isEmptyString = (str) => {
    if (typeof str === 'string') {
        return (!str || str.trim().length === 0 );
    } else {
        return false;
    }
};


/**
 * Accepts a string and returns it truncated to the specified length. If the string is already shorter
 * than specified length, the original string is returned.
 * @param {String} str - The string to truncate.
 * @param {Number} len - Integer specifying the number of characters to allow before truncation.
 * @returns {String} The truncated (if applicable) string.
 */
const truncateString = (str, len) => {
    if (typeof(str) === 'string') {
        if (str.length > len) {
            let subString = str.substring(0, len);
            return subString + "...";
        } else {
            return str;
        }
    }
    return '';
};


/**
 * Accepts a string and returns the same string with the first letter capitalized.
 * @param {String} str - The string to modify.
 * @returns {String} The modified string.
 */
const capitalizeFirstLetter = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};


/**
 * Accepts a URL or URL search string and updates or inserts the a URL parameter with the a new value.
 * @param {String} url   - The full URL or search string to modify.
 * @param {String} param - The name of the parameter to update.
 * @param {String} value - The new value to set for the URL parameter.
 * @returns {String} The updated URL.
 */
const updateParams = (url, param, value) => {
    let i = url.indexOf('#');
    let hash = i === -1 ? ''  : url.substr(i);
         url = i === -1 ? url : url.substr(0, i);

    let re = new RegExp("([?&])" + param + "=.*?(&|$)", "i");
    let separator = url.indexOf('?') !== -1 ? "&" : "?";
    if (url.match(re)) {
        url = url.replace(re, '$1' + param + "=" + value + '$2');
    } else {
        url = url + separator + param + "=" + value;
    }
    return url + hash;
};


/**
 * Accepts a password string and validates it against Conductor password standards.
 * @param {String} passInput - The password to validate.
 * @returns {Boolean} True if password is valid, false otherwise.
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
 * Accepts a string containing a URL and attempts to normalize it to include protocol.
 * @param {String} url - The URL to normalize.
 * @returns {String} The normalized URL.
 */
const normalizeURL = (url) => {
    if (typeof(url) === 'string') {
        if (url.match(/^(http|https):\/\//g) === null) {
            return 'https://' + url;
        }
        return url;
    }
    return '';
};


/**
 * Sort an array of user objects by first and lastname.
 * @param {Object[]} users - The array to sort.
 * @returns {Object[]} The sorted array.
 */
const sortUsersByName = (users) => {
    if (typeof(users) === 'object' && Array.isArray(users)) {
        return users.sort((a, b) => {
            if (typeof(a.firstName) === 'string' && typeof(a.lastName) === 'string'
                && typeof(b.firstName) === 'string' && typeof(b.lastName) === 'string') {
                let aName = `${a.firstName} ${a.lastName}`;
                let bName = `${b.firstName} ${b.lastName}`;
                if (aName < bName) return -1;
                if (aName > bName) return 1;
            }
            return 0;
        });
    }
    return [];
};


export {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter,
    updateParams,
    validatePassword,
    normalizeURL,
    sortUsersByName
};
