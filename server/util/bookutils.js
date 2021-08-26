//
// LibreTexts Conductor
// bookutils.js
//

const libraries = [
    'bio',
    'biz',
    'chem',
    'eng',
    'espanol',
    'geo',
    'human',
    'k12',
    'math',
    'med',
    'phys',
    'socialsci',
    'stats',
    'workforce'
];

const extractLibFromID = (resID) => {
    if ((resID !== undefined) && (resID !== null) && (typeof(resID) === 'string')) {
        const splitID = resID.split('-');
        if (splitID.length === 2) {
            return splitID[0];
        }
    }
    return '';
};

module.exports = {
    libraries,
    extractLibFromID
}
