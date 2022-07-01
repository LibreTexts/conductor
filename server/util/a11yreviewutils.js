//
// LibreTexts Conductor
// a11yutils.js
//
export const a11ySectionReviewSchema = {
    sectionTitle: String,
    sectionURL: String,
    navKeyboard: Boolean,
    imgAltText: Boolean,
    imgDecorative: Boolean,
    imgShortAlt: Boolean,
    linkNoneEmpty: Boolean,
    linkSuspicious: Boolean,
    linkExtLabeled: Boolean,
    contrastSmall: Boolean,
    contrastLarge: Boolean,
    contrastButtons: Boolean,
    textSize: Boolean,
    textLineHeight: Boolean,
    textParSpacing: Boolean,
    textLetterSpacing: Boolean,
    textWordSpacing: Boolean,
    headingNoneEmpty: Boolean,
    headingOutline: Boolean,
    formFieldLabels: Boolean,
    formNavRadio: Boolean,
    tableHeaders: Boolean,
    tableLabel: Boolean,
    tableNotImage: Boolean,
    listOlLabel: Boolean,
    listUlLabel: Boolean,
    docLinkFile: Boolean,
    docAccess: Boolean,
    multiCaption: Boolean,
    multiNavControls: Boolean,
    multiAudioTrans: Boolean,
    multiAudioDescrip: Boolean,
    divSection: Boolean,
    senseInstruction: Boolean,
    timingCriteria: Boolean,
    codeAltText: Boolean
};


const a11ySectionReviewItems = [
    'sectionTitle',
    'sectionURL',
    'navKeyboard',
    'imgAltText',
    'imgDecorative',
    'imgShortAlt',
    'linkNoneEmpty',
    'linkSuspicious',
    'linkExtLabeled',
    'contrastSmall',
    'contrastLarge',
    'contrastButtons',
    'textSize',
    'textLineHeight',
    'textParSpacing',
    'textLetterSpacing',
    'textWordSpacing',
    'headingNoneEmpty',
    'headingOutline',
    'formFieldLabels',
    'formNavRadio',
    'tableHeaders',
    'tableLabel',
    'tableNotImage',
    'listOlLabel',
    'listUlLabel',
    'docLinkFile',
    'docAccess',
    'multiCaption',
    'multiNavControls',
    'multiAudioTrans',
    'multiAudioDescrip',
    'divSection',
    'senseInstruction',
    'timingCriteria',
    'codeAltText'
];


/**
 * Validates that a given Accessibility Review Section item name is one of the
 * pre-defined, acceptable item names.
 * @param {String} item  - the item name to test
 * @returns {Boolean} true if valid item, false otherwise.
 */
export const validateA11YReviewSectionItem = (item) => {
    return a11ySectionReviewItems.includes(item);
}
