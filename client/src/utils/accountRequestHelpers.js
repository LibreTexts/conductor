const purposeOptions = [
  {
    key: 'oer',
    text: 'Create, contribute, or customize OER content on the LibreTexts Libraries',
    shortText: 'Libraries',
    value: 'oer',
  },
  {
    key: 'h5p',
    text: 'Create, contribute, or customize H5P assessments on the LibreStudio',
    shortText: 'Studio',
    value: 'h5p',
  },
  {
    key: 'adapt',
    text: 'Create, contribute, or customize homework assignments on ADAPT',
    shortText: 'ADAPT',
    value: 'adapt',
  },
];

/**
 * Returns a UI-ready string of a provided Account Request 'Purpose'.
 *
 * @param {string} purpose - The purpose identifier.
 * @param {boolean} [short=false] - Return the shortened purpose text.
 * @returns {string} The UI-ready purpose text.
*/
function getPurposeText(purpose, short = false) {
  if (typeof (purpose) === 'string') {
    const foundPurpose = purposeOptions.find(item => item.value === purpose);
    if (foundPurpose) {
      if (short) {
        return foundPurpose.shortText;
      }
      return foundPurpose.text;
    }
  }
  return 'Unknown';
};

export {
  purposeOptions,
  getPurposeText,
}
