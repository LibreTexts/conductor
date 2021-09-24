//
// LibreTexts Conductor
// LibraryOptions.js
//

const libraries = [
    { key: 'bio',       text: 'Biology',        value: 'bio' },
    { key: 'biz',       text: 'Business',       value: 'biz' },
    { key: 'chem',      text: 'Chemistry',      value: 'chem' },
    { key: 'eng',       text: 'Engineering',    value: 'eng' },
    { key: 'espanol',   text: 'Español',        value: 'espanol' },
    { key: 'geo',       text: 'Geosciences',    value: 'geo' },
    { key: 'human',     text: 'Humanities',     value: 'human' },
    { key: 'k12',       text: 'K12 Education',  value: 'k12'},
    { key: 'math',      text: 'Mathematics',    value: 'math' },
    { key: 'med',       text: 'Medicine',       value: 'med' },
    { key: 'phys',      text: 'Physics',        value: 'phys' },
    { key: 'socialsci', text: 'Social Science', value: 'socialsci' },
    { key: 'stats',     text: 'Statistics',     value: 'stats' },
    { key: 'workforce', text: 'Workforce',      value: 'workforce' }
];

const libraryOptions = [
    { key: 'empty',     text: 'Clear...',       value: "" },
    ...libraries
];

const getLibGlyphURL = (library) => {
    switch (library) {
        case 'bio':
            return '/glyphs/bio.png';
        case 'biz':
            return '/glyphs/biz.png';
        case 'chem':
            return '/glyphs/chem.png';
        case 'eng':
            return '/glyphs/eng.png';
        case 'espanol':
            return '/glyphs/espanol.png';
        case 'geo':
            return '/glyphs/geo.png';
        case 'human':
            return '/glyphs/human.png';
        case 'k12':
            return '/glyphs/k12.png';
        case 'math':
            return '/glyphs/math.png';
        case 'med':
            return '/glyphs/med.png';
        case 'phys':
            return '/glyphs/phys.png';
        case 'socialsci':
            return '/glyphs/socialsci.png';
        case 'stats':
            return '/glyphs/stats.png';
        case 'workforce':
            return '/glyphs/workforce.png';
        default:
            return '/favicon-32x32.png';
    }
};

const getLibGlyphAltText = (library) => {
    switch (library) {
        case 'bio':
            return 'Biology';
        case 'biz':
            return 'Business';
        case 'chem':
            return 'Chemistry';
        case 'eng':
            return 'Engineering';
        case 'espanol':
            return 'Español';
        case 'geo':
            return 'Geosciences';
        case 'human':
            return 'Humanities';
        case 'k12':
            return 'K12 Education';
        case 'math':
            return 'Mathematics';
        case 'med':
            return 'Medicine';
        case 'phys':
            return 'Physics';
        case 'socialsci':
            return 'Social Sciences';
        case 'stats':
            return 'Statistics';
        case 'workforce':
            return 'Workforce';
        default:
            return 'LibreTexts Library';
    }
};

const getLibraryName = (lib) => {
    const foundLib = libraries.find((libEntry) => {
        if ((libEntry.key === lib) || (libEntry.value === lib)) {
            return libEntry;
        }
        return null;
    });
    if (foundLib !== undefined) {
        return foundLib.text;
    } else {
        return 'Unknown';
    }
}

module.exports = {
    libraries,
    libraryOptions,
    getLibGlyphURL,
    getLibGlyphAltText,
    getLibraryName
}
