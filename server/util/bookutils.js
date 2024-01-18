//
// LibreTexts Conductor
// bookutils.js
//
import Promise from 'bluebird';
import axios from 'axios';
import express from 'express';
import base64 from 'base-64';
import { libraryNameKeys } from './librariesmap.js';
import Book from '../models/book.js';
import { getProductionURL, isEmptyString, removeTrailingSlash, assembleUrl } from './helpers.js';

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
    'ck12',
    'publicdomain',
];

const sortChoices = [
  'random',
  'title',
  'author',
];

/**
 * Validates a string follows the internal LibreTexts `lib-coverID` Book ID format.
 *
 * @param {string} bookID - The string to validate as a Book ID.
 * @returns {boolean} True if valid, false otherwise.
 */
export const checkBookIDFormat = (bookID) => {
    if (typeof(bookID) === 'string') {
        const match = bookID.match(/[a-z1-2]{3,9}[-][0-9]{2,10}/ig);
        if (match && match[0] === bookID) {
          return true;
        }
    }
    return false;
}


/**
 * Extracts the internal LibreTexts library shortname from a `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The library shortname, or an empty string if not found.
 */
export const extractLibFromID = (bookID) => {
    if (typeof(bookID) === 'string' && bookID !== '') {
        const splitID = bookID.split('-');
        if (splitID.length === 2) return splitID[0];
    }
    return '';
};


/**
 * Returns a 2-tuple of the internal LibreTexts library shortname and the coverpage ID from `lib-coverID`
 * format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String[]} A pair of strings in the order [lib, coverID].
 */
export const getLibraryAndPageFromBookID = (bookID) => {
    if (typeof(bookID) === 'string') {
        const splitID = String(bookID).split('-');
        if (splitID.length > 1) return [splitID[0], splitID[1]];
    }
    return ['', ''];
};

/**
 * Parses a LibreTexts URL into the library subdomain name and page path.
 *
 * @param {string} orig - URL of a LibreTexts book.
 * @returns {string[]|null[]} The subdomain and page path, or null if invalid.
 */
export function parseLibreTextsURL(orig) {
  const url = new URL(orig);
  const splitHost = url.hostname.split('.');
  if (splitHost.length === 3) {
    return [splitHost[0], url.pathname];
  }
  return [null, null];
};


/**
 * Verifies that a provided library shortname is a valid LibreTexts library identifier.
 * @param {String} lib - The library shortname to validate. 
 * @returns {Boolean} True if valid identifier, false otherwise.
 */
export const isValidLibrary = (lib) => {
    let foundLib = libraryNameKeys.find(item => item === lib);
    if (foundLib !== undefined) return true;
    return false;
};


/**
 * Verifies that a provided license identifier is valid and LibreTexts-recognized.
 * @param {String} lic - The license identifier to validate. 
 * @returns {Boolean} True if valid identifier, false otherwise.
 */
export const isValidLicense = (lic) => {
    let foundLic = licenses.find(item => item === lic);
    if (foundLic !== undefined) return true;
    return false;
};


/**
 * Verifies that a requested sorting method is valid and implemented.
 * @param {String} sort - The sorting method name to validate. 
 * @returns {Boolean} True if valid method, false otherwise.
 */
export const isValidSort = (sort) => {
    let foundSort = sortChoices.find(item => item === sort);
    if (foundSort !== undefined) return true;
    return false;
};


/**
 * Validates that a provided LibreTexts library shortname and pageID are not empty in order to generate
 * links for a resource's properties/supplements.
 * @param {String} lib - The internal LibreTexts library shortname to check.
 * @param {String} pageID - The pageID of the resource to check.
 * @returns {Boolean} True if both are valid, false otherwise.
 */
const validateLinkGenArguments = (lib, pageID) => {
    return (typeof(lib) === 'string' && typeof(pageID) === 'string' && !isEmptyString(lib) && !isEmptyString(pageID));
};


/**
 * Generates the URL for the thumbnail a LibreTexts library resource.
 * @param {String} lib - The internal LibreTexts library shortname.
 * @param {String} pageID - The pageID of the resource on the library.
 * @returns {String} The link to the the thumbnail, or an empty string if invalid arguments provided.
 */
export const genThumbnailLink = (lib, pageID) => {
    if (validateLinkGenArguments(lib, pageID)) {
        return `https://${lib}.libretexts.org/@api/deki/pages/${pageID}/files/=mindtouch.page%2523thumbnail`;
    }
    return '';
};


/**
 * Generates the URL for the PDF download of a resource given its LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The link to the PDF download, or an empty string if invalid arguments provided.
 */
export const genPDFLink = (bookID) => {
    if (checkBookIDFormat(bookID)) return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Full.pdf`;
    return '';
};


/**
 * Generates the URL for the LibreTexts Bookstore page of a resource given its LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The link to the Bookstore page, or an empty string if invalid arguments provided.
 */
export const genBookstoreLink = (bookID) => {
    if (checkBookIDFormat(bookID)) return `https://libretexts.org/bookstore/order?${bookID}`;
    return '';
};


/**
 * Generates the URL for the ZIP download of a resource given its LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The link to the ZIP download, or an empty string if invalid arguments provided.
 */
export const genZIPLink = (bookID) => {
    if (checkBookIDFormat(bookID)) return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Individual.zip`;
    return '';
};


/**
 * Generates the URL for the publication files download of a resource given its LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The link to the publication files download, or an empty string if invalid arguments provided.
 */
export const genPubFilesLink = (bookID) => {
    if (checkBookIDFormat(bookID)) return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/Publication.zip`;
    return '';
};


/**
 * Generates the URL for the LMS import file download of a resource given its LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The link to the LMS import file download, or an empty string if invalid arguments provided.
 */
export const genLMSFileLink = (bookID) => {
    if (checkBookIDFormat(bookID)) return `https://batch.libretexts.org/print/Letter/Finished/${bookID}/LibreText.imscc`;
    return '';
};


/**
 * Generates the permalink to a LibreTexts library page given a LibreTexts `lib-coverID` format Book ID.
 * @param {String} bookID - The resource/Book ID to work on.
 * @returns {String} The permalink to the resource, or an empty string if invalid arguments provided.
 */
export const genPermalink = (bookID) => {
    if (checkBookIDFormat(bookID)) {
        let [lib, pageID] = getLibraryAndPageFromBookID(bookID);
        if (!isEmptyString(lib) && !isEmptyString(pageID)) return `https://${lib}.libretexts.org/@go/page/${pageID}`;
    }
    return '';
}

/**
 * Makes a request to the LibreTexts API server to build an object consisting of the
 * Book's Table of Contents.
 * INTERNAL USE ONLY.
 * NOTE: This function should NOT be called directly from an API route.
 * @param {String} [bookID] - A standard `lib-coverID` LibreTexts identifier.
 * @param {String} [bookURL] - The URL of the LibreText to lookup.
 * @returns {Promise<Object|Error>} The Book's TOC object, or throws an error.
 */
export const getBookTOCFromAPI = (bookID, bookURL) => {
    let bookLookup = false;
    return Promise.try(() => {
        if (typeof (bookID) === 'string' && !isEmptyString(bookID) && checkBookIDFormat(bookID)) {
            bookLookup = true;
            return Book.findOne({ bookID: bookID }).lean();
        } else if (typeof (bookURL) === 'string' && !isEmptyString(bookURL)) {
            return {};
        }
        throw (new Error('tocretrieve'));
    }).then((commonsBook) => {
        let bookAddr = '';
        if (bookLookup && typeof (commonsBook) === 'object' && typeof (commonsBook.links?.online) === 'string') {
            bookAddr = commonsBook.links.online;
        } else if (!bookLookup && typeof (bookURL) === 'string') {
            bookAddr = bookURL;
        } else {
            throw (new Error('tocretrieve'));
        }
        return axios.get(`https://api.libretexts.org/endpoint/getTOC/${bookAddr}`, {
            headers: { 'Origin': getProductionURL() }
        });
    }).then((tocRes) => {
        if (tocRes.data && tocRes.data.toc) return tocRes.data.toc;
        else throw (new Error('tocretrieve'));
    });
};
