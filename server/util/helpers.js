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

module.exports = {
    isEmptyString,
    buildOrgArray,
    validateUUIDArray
};
