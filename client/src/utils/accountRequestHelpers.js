const purposeOptions = [
  { key: 'oer', text: 'Create, contribute, or customize OER content on the LibreTexts Libraries', value: 'oer' },
  { key: 'h5p', text: 'Create, contribute, or customize H5P assessments on the LibreStudio', value: 'h5p' },
  { key: 'adapt', text: 'Create, contribute, or customize homework assignments on ADAPT', value: 'adapt' }
];


/**
 * Returns a UI-ready string of a provided Account Request 'Purpose'.
 *
 * @param {string} purpose - The purpose identifier.
 * @returns {string} The UI-ready purpose text.
*/
function getPurposeText(purpose) {
  if (typeof (purpose) === 'string') {
    const foundPurpose = purposeOptions.find(item => item.value === purpose);
    if (foundPurpose) {
      return foundPurpose.text;
    }
  }
  return 'Unknown';
};

export {
  purposeOptions,
  getPurposeText
}
