//
// LibreTexts Conductor
// HelperFunctions.js
//

/**
 * Accepts a string, @str, and
 * returns a Boolean:
 *  TRUE:  the string is empty
 *  FALSE: the string is not
 *         empty, OR the
 *         variable provided is
 *         not of type 'string'
 */
const isEmptyString = (str) => {
    if (typeof str === 'string') {
        return (!str || str.trim().length === 0 );
    } else {
        return false;
    }
};

/**
 * Accepts a string, @str, and returns
 * a new string truncated to the length
 * given in @len. If @str is already
 * shorter than @len, the original
 * string is returned.
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
 * Accepts a string, @str, and returns
 * a new string with the first letter
 * of @str capitalized.
 */
const capitalizeFirstLetter = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Accepts a URL or URL search string
 * (@url, e.g. '?items=10&page=1') and updates
 * or inserts the @param with the new @value.
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
 * Accepts a password string, @passInput, and
 * validates it against Conductor password
 * standards. Returns a boolean:
 *  TRUE: Password meets standards
 *  FALSE: Password does not meet standards
 *         or is not a string
 */
const validatePassword = (passInput) => {
    if (typeof(passInput) === 'string') {
        if ((passInput.length > 9) && (/\d/.test(passInput))) {
            return true;
        }
    }
    return false;
};

module.exports = {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter,
    updateParams,
    validatePassword
};
