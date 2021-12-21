//
// LibreTexts Conductor
// AccountRequestOptions.js
//

const purposeOptions = [
    { key: 'oer',   text: 'Create, contribute, or customize OER content on the LibreTexts Libraries',   value: 'oer' },
    { key: 'h5p',   text: 'Create, contribute, or customize H5P assessments on the LibreStudio',        value: 'h5p' },
    { key: 'adapt', text: 'Create, contribute, or customize homework assignments on ADAPT',             value: 'adapt' }
];


/**
 * Returns a UI presentation string of a provided Account Request 'Purpose'.
 * @param {String} purpose - the purpose identifier to validate.
 * @returns {String} the UI-ready purpose text.
 */
const getPurposeText = (purpose) => {
    if (typeof(purpose) === 'string') {
        let foundPurpose = purposeOptions.find(item => item.value === purpose);
        if (foundPurpose !== undefined) return foundPurpose.text;
    }
    return 'Unknown';
};


module.exports = {
    purposeOptions,
    getPurposeText
}
