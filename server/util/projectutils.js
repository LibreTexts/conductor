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
    'adoptionrequest',
    'miscellaneous'
];

const constrRoadmapSteps = [
    '1', '2', '3', '4', '5a', '5b', '5c', '6', '7', '8', '9', '10', '11', '12'
];


/**
 * Validates that a given classification string is one of the
 * pre-defined, acceptable classifications.
 * @param {String} classification  - the classification string to test
 * @returns {Boolean} true if valid classification, false otherwise
 */
const validateProjectClassification = (classification) => {
    return projectClassifications.includes(classification);
};


/**
 * Validates that a given Construction Roadmap step name is one of the
 * pre-defined, acceptable step names.
 * @param {String} step  - the step name to test
 * @returns {Boolean} true if valid step, false otherwise.
 */
const validateRoadmapStep = (step) => {
    return constrRoadmapSteps.includes(step);
};


const textUseOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'primary', text: 'As the primary textbook', value: 'primary' },
    { key: 'supplement', text: 'As supplementary material', value: 'supplement' },
    { key: 'remix', text: 'As part of a remix that I am creating for my class', value: 'remix' },
    { key: 'other', text: 'Other (please explain in comments)', value: 'other' },
];

const getTextUse = (use) => {
    if (use !== '') {
        let foundUse = textUseOptions.find((item) => {
            return item.value === use;
        });
        return foundUse.text;
    } else {
        return '';
    }
};

module.exports = {
    projectClassifications,
    constrRoadmapSteps,
    validateProjectClassification,
    validateRoadmapStep,
    textUseOptions,
    getTextUse
}
