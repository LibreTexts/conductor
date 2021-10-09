//
// LibreTexts Conductor
// projectutils.js
//
const { isEmptyString } = require('./helpers.js');

const projectClassifications = [
    'harvesting',
    'curation',
    'construction',
    'technology',
    'librefest',
    'coursereport',
    'adoptionrequest'
];


/**
 * Validates that a given classification string is one of the
 * pre-defined, acceptable classifications.
 * @param {String} classification  - the classification string to test
 * @returns {Boolean} true if valid classification, false otherwise
 *
 */
const validateProjectClassification = (classification) => {
    if (typeof(classification) === 'string') {
        return projectClassifications.includes(classification);
    }
    return false;
};


module.exports = {
    projectClassifications,
    validateProjectClassification
}
