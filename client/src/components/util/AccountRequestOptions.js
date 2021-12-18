//
// LibreTexts Conductor
// AccountRequestOptions.js
//

const purposeOptions = [
    { key: 'contribute',    text: 'Create, contribute, or customize content on LibreTexts', value: 'contribute' },
    { key: 'else',          text: 'Something else',                                         value: 'else' }
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
