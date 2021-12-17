//
// LibreTexts Conductor
// BookHelpers.js
//

import { isEmptyString } from './HelperFunctions.js';


/**
 * Validates that @lib and @pageID are not
 * empty and returns a Boolean:
 *  TRUE: @lib and @pageID are valid,
 *  FALSE: @lib or @pageID has errors.
 */
export const validateLinkGenArguments = (lib, pageID) => {
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
export const genThumbnailLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://${lib}.libretexts.org/@api/deki/pages/${pageID}/files/=mindtouch.page%2523thumbnail`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * PDF download given a @lib (standard LibreTexts
 * shortened-format string) and @pageID
 * (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
export const genPDFLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://batch.libretexts.org/print/Letter/Finished/${lib}-${pageID}/Full.pdf`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * in the LibreTexts bookstore given a @lib
 * (standard LibreTexts shortened-format
 * string) and @pageID (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
export const genBookstoreLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://libretexts.org/bookstore/single.html?${lib}-${pageID}`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * ZIP download given a @lib (standard
 * LibreTexts shortened-format string)
 * and @pageID (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
export const genZIPLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://batch.libretexts.org/print/Letter/Finished/${lib}-${pageID}/Individual.zip`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * print files download given a @lib
 * (standard LibreTexts shortened-format
 * string) and @pageID (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
export const genPubFilesLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://batch.libretexts.org/print/Letter/Finished/${lib}-${pageID}/Publication.zip`;
    } else {
        return '';
    }
};

/**
 * Generates the URL for the resource
 * LMS import file given a @lib (standard
 * LibreTexts shortened-format string)
 * and @pageID (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
export const genLMSFileLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://batch.libretexts.org/print/Letter/Finished/${lib}-${pageID}/LibreText.imscc`;
    } else {
        return '';
    }
};

/**
 * Generates an Object containing the
 * standard set of URLs for the resource
 * given a @lib (standard LibreTexts
 * shortened-format string) and @pageID
 * (integer or string). Accepts the standard
 * live-library link as an optional
 * parameter, @onlineLink.
 */
export const genLinkSet = (lib, pageID, onlineLink) => {
    var linkSet = {};
    if ((onlineLink !== undefined) && (onlineLink !== null)) {
        linkSet.online = onlineLink;
    }
    linkSet = {
        ...linkSet,
        pdf: genPDFLink(lib, pageID),
        buy: genBookstoreLink(lib, pageID),
        zip: genZIPLink(lib, pageID),
        files: genPubFilesLink(lib, pageID),
        lms: genLMSFileLink(lib, pageID)
    }
    return linkSet;
};

/**
 * Returns the hex color code for a given content license.
 * @param {String} license - the license to lookup
 * @returns {String} the license's hex color code
 */
 export const getLicenseColor = (license) => {
    let licenseColors = {
        arr:          '#981b1e',
        ccbyncnd:     '#e31c3d',
        ccbynd:       '#001F3F',
        ccbyncsa:     '#205493',
        ccbync:       '#4773aa',
        ccbysa:       '#0066B2',
        ccby:         '#2E2787',
        gnu:          '#4B0082',
        gnufdl:       '#6F00FF',
        gnudsl:       '#85144B',
        publicdomain: '#2e8540',
        notset:       '#134f5c'
    };
    if (typeof(license) === 'string') {
        if (licenseColors.hasOwnProperty(license)) {
            return licenseColors[license];
        }
    }
    return '';
};