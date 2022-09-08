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

/**
 * Performs a test to check that two arrays contain the same items
 * and are of the same length. Use only when array members can be compared using
 * basic equality operators.
 * 
 * @param {any[]} a - First array to compare. 
 * @param {any[]} b - Second array to compare. 
 * @returns {boolean} True if "equal", false otherwise.
 */
const basicArraysEqual = (a, b) => {
  return (
    Array.isArray(a)
    && Array.isArray(b)
    && a.every((item) => b.includes(item))
    && a.length === b.length
  );
};

/**
 * Checks if a user is a Campus Administrator in an Organization given their
 * roles and the Organization identifier.
 *
 * @param {object[]} roles - Array of user roles in associated Organizations.
 * @param {string} orgID - The Organization identifier to validate against.
 * @returns {boolean} True if Campus Administrator, false otherwise.
 */
const checkCampusAdmin = (roles, orgID) => {
  if (Array.isArray(roles) && typeof (orgID) === 'string') {
    const foundCampusAdmin = roles.find((item) => (
      item.org === orgID && item.role === 'campusadmin'
    ));
    if (foundCampusAdmin) {
      return true;
    }
  }
  return false;
};

/**
 * Checks if a user is a Super Administrator in Conductor.
 *
 * @param {object[]} roles - Array of user roles in associated Organizations.
 * @returns {boolean} True if Super Administrator, false otherwise.
 */
const checkSuperAdmin = (roles) => {
  if (Array.isArray(roles)) {
    const foundSuperAdmin = roles.find((item) => (
      item.org === 'libretexts' && item.role === 'superadmin'
    ));
    if (foundSuperAdmin) {
      return true;
    }
  }
  return false;
};

/**
 * Formats a number of bytes as a UI-ready/human-readable string.
 *
 * @param {number} bytes - The file size in bytes.
 * @param {number} [dp=1] - Number of decimal points to round to.
 */
function fileSizePresentable(bytes, dp = 1) {
  let fileBytes = bytes;
  const metric = 1000;
  if (Math.abs(fileBytes) < metric) {
    return `${fileBytes} B`;
  }

  const UNITS = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  const r = 10**dp;

  do {
    fileBytes /= metric;
    ++u;
  } while (Math.round(Math.abs(fileBytes) * r) / r >= metric && u < UNITS.length - 1);

  return `${fileBytes.toFixed(dp)} ${UNITS[u]}`;
}

/**
 * Checks if two Sets are equal.
 *
 * @param {Set} set1 - The first set to examine.
 * @param {Set} set2 - The second set to examine.
 * @returns {boolean} True if sets are equal, false otherwise.
 */
function setsEqual(set1, set2) {
  if (set1 instanceof Set && set2 instanceof Set) {
    return set1.size === set2.size && Array.from(set1).every((item) => set2.has(item));
  }
  return false;
}

export {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter,
    updateParams,
    validatePassword,
    normalizeURL,
    sortUsersByName,
    basicArraysEqual,
    checkCampusAdmin,
    checkSuperAdmin,
    fileSizePresentable,
    setsEqual,
};
