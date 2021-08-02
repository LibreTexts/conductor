//
// LibreTexts Conductor
// helpers.js
//

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

module.exports = {
    isEmptyString
};
