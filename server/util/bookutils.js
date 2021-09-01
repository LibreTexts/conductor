//
// LibreTexts Conductor
// bookutils.js
//
const { isEmptyString } = require('./helpers.js');

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

const licenses = [
    'arr',
    'ccby',
    'ccbync',
    'ccbyncnd',
    'ccbyncsa',
    'ccbynd',
    'ccbysa',
    'gnu',
    'gnudsl',
    'gnufdl',
    'gnugpl',
    'publicdomain'
];

const sortChoices = [
    'title',
    'author'
];

const checkBookIDFormat = (bookID) => {
    if (typeof(bookID) === 'string') {
        const match = bookID.match(/[a-z1-2]{3,9}[-][0-9]{2,10}/g);
        if (match.length === 1) {
            if (match[0] == bookID) {
                return true;
            }
        }
    }
    return false;
}

const extractLibFromID = (resID) => {
    if ((resID !== undefined) && (resID !== null) && (typeof(resID) === 'string')) {
        const splitID = resID.split('-');
        if (splitID.length === 2) {
            return splitID[0];
        }
    }
    return '';
};

const isValidLibrary = (lib) => {
    var foundLib = libraries.find((item) => {
        if (item === lib) {
            return item;
        }
        return null;
    });
    if (foundLib !== undefined) {
        return true;
    } else {
        return false;
    }
};

const isValidLicense = (lic) => {
    var foundLic = licenses.find((item) => {
        if (item === lic) {
            return item;
        }
        return null;
    });
    if (foundLic !== undefined) {
        return true;
    } else {
        return false;
    }
};

const isValidSort = (sort) => {
    var foundSort = sortChoices.find((item) => {
        if (item === sort) {
            return item;
        }
        return null;
    });
    if (foundSort !== undefined) {
        return true;
    } else {
        return false;
    }
};


/**
 * Validates that @lib and @pageID are not
 * empty and returns a Boolean:
 *  TRUE: @lib and @pageID are valid,
 *  FALSE: @lib or @pageID has errors.
 */
const validateLinkGenArguments = (lib, pageID) => {
    if ((lib === undefined) || (lib === null) || (isEmptyString(lib)) || (pageID === undefined) ||
        (pageID === null) || (isEmptyString(pageID))) {
        return false;
    }
    return true;
};

/**
 * Generates the URL for the resource
 * thumbnail given a @lib (standard LibreTexts
 * shortened-format string) and @pageID
 * (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
const genThumbnailLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://${lib}.libretexts.org/@api/deki/pages/${pageID}/files/=mindtouch.page%2523thumbnail`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * PDF download given a standard LibreTexts
 * `lib-pageID` format @bookID.
 * If argument validation fails, an empty
 * string is returned.
 */
const genPDFLink = (bookID) => {
    if ((bookID !== null) && (bookID !== undefined) && (!isEmptyString(bookID))) {
        return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Full.pdf`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * in the LibreTexts bookstore given
 * a standard LibreTexts `lib-pageID`
 * format @bookID.
 * If argument validation fails, an empty
 * string is returned.
 */
const genBookstoreLink = (bookID) => {
    if ((bookID !== null) && (bookID !== undefined) && (!isEmptyString(bookID))) {
        return `https://libretexts.org/bookstore/single.html?${bookID}`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * ZIP download given a standard LibreTexts
 * `lib-pageID` format @bookID.
 * If argument validation fails, an empty
 * string is returned.
 */
const genZIPLink = (bookID) => {
    if ((bookID !== null) && (bookID !== undefined) && (!isEmptyString(bookID))) {
        return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Individual.zip`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * print files download given a standard
 * LibreTexts `lib-pageID` format @bookID.
 * If argument validation fails, an empty
 * string is returned.
 */
const genPubFilesLink = (bookID) => {
    if ((bookID !== null) && (bookID !== undefined) && (!isEmptyString(bookID))) {
        return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Publication.zip`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * LMS import file given a standard
 * LibreTexts `lib-pageID` format @bookID.
 * If argument validation fails, an empty
 * string is returned.
 */
const genLMSFileLink = (bookID) => {
    if ((bookID !== null) && (bookID !== undefined) && (!isEmptyString(bookID))) {
        return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/LibreText.imscc`;
    } else {
        return '';
    }
};

module.exports = {
    libraries,
    checkBookIDFormat,
    extractLibFromID,
    isValidLibrary,
    isValidLicense,
    isValidSort,
    genThumbnailLink,
    genPDFLink,
    genBookstoreLink,
    genZIPLink,
    genPubFilesLink,
    genLMSFileLink
}
