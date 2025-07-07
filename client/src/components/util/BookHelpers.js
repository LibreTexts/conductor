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
 * PDF download given a @lib (standard LibreTexts
 * shortened-format string) and @pageID
 * (integer or string).
 * If argument validation fails, an empty
 * string is returned.
 */
const genPDFLink = (lib, pageID) => {
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
const genBookstoreLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://commons.libretexts.org/store/product/${lib}-${pageID}`;
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
const genZIPLink = (lib, pageID) => {
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
const genPubFilesLink = (lib, pageID) => {
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
const genLMSFileLink = (lib, pageID) => {
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
const genLinkSet = (lib, pageID, onlineLink) => {
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
 * Returns the hex color code for UI presentation of a given content license.
 * @param {String} license - the license identifier to lookup
 * @returns {String} the license's hex color code
 */
const getLicenseColor = (license) => {
    // Colors are (at least) WCAG AA compliant on a pure white background
    let licenseColors = {
        arr:            '#e52107',
        ccbyncnd:       '#92348c',
        ccbynd:         '#d82d79',
        ccbyncsa:       '#0a7fa0',
        ccbync:         '#b21e38',
        ccbysa:         '#0051d8',
        ccby:           '#9255de',
        gnu:            '#6a7d00',
        gnufdl:         '#008480',
        gnudsl:         '#4865ff',
        ck12:           '#a4684d',
        publicdomain:   '#018715',
        fairuse:        '#CF4900',
        notset:         '#001F3F'
    };
    if (typeof(license) === 'string' && licenseColors.hasOwnProperty(license)) {
        return licenseColors[license];
    }
    return '';
};

/**
 * Returns the UI-ready name of a library shelving area.
 *
 * @param {string} shelves - The internal shelving area identifier. 
 * @returns {string} The UI-ready shelves name.
 */
const getShelvesNameText = (shelves) => {
  if (typeof (shelves) === 'string') {
    if (shelves === 'central') {
      return 'Central Bookshelves';
    }
    return 'Campus Bookshelves';
  }
  return 'Unknown';
};

export {
    validateLinkGenArguments,
    genThumbnailLink,
    genPDFLink,
    genBookstoreLink,
    genZIPLink,
    genPubFilesLink,
    genLMSFileLink,
    genLinkSet,
    getLicenseColor,
    getShelvesNameText
}