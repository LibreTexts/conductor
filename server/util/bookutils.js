//
// LibreTexts Conductor
// bookutils.js
//
import Promise from 'bluebird';
import axios from 'axios';
import express from 'express';
import base64 from 'base-64';
import { getLibraryNameKeys } from '../api/libraries.js';
import Book from '../models/book.js';
import { getProductionURL, isEmptyString, removeTrailingSlash, assembleUrl } from './helpers.js';
import { CXOneFetch } from './librariesclient.js';
import MindTouch from "../util/CXOne/index.js"
import Fuse from 'fuse.js';

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
  let foundLib = false;
  getLibraryNameKeys().then((libs) => {
    libs.forEach((item) => {
      if (item === lib) {
        foundLib = true;
      }
    })
  })
  return true;
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
export const getBookTOCFromAPI = async (bookID, bookURL) => {
    let bookAddr = bookURL;
    if(!checkBookIDFormat(bookID)) throw new Error('bookid');

    const book = await Book.findOne({ bookID: bookID }).lean();
    if(book?.links?.online){
        bookAddr = book.links?.online;
    }

    if (!bookAddr) throw new Error('tocretrieve');

    const tocRes = await axios.get(`https://api.libretexts.org/endpoint/getTOC/${encodeURIComponent(bookAddr)}`, {
        headers: { 'Origin': getProductionURL() }
    });
    if (!tocRes?.data?.toc?.structured) throw (new Error('tocretrieve'));

    const buildStructure = (page) => ({
        children: Array.isArray(page.subpages) ? page.subpages.map((s) => buildStructure(s)) : [],
        id: page['@id'],
        title: page.title,
        url: page.url,
    });
    return buildStructure(tocRes.data.toc.structured);
};

export const deleteBookFromAPI = async (bookID) => {
    if (!process.env.LIBRE_API_ENDPOINT_ACCESS) {
        throw new Error('missing API key');
    }
    if (!checkBookIDFormat(bookID)) {
        throw new Error('bookID format incorrect');
    }
    const book = await Book.findOne({ bookID }).lean();
    const bookAddr = book.links?.online;
    if (!bookAddr) {
        throw new Error('no link');
    }

    const [subdomain, id] = getLibraryAndPageFromBookID(bookID);
    const url = new URL(bookAddr);
    if (!url.pathname) {
        throw new Error('link parsing failed');
    }
    const pathParts = url.pathname.match(/(Courses|Bookshelves|home)/);
    if (pathParts?.length < 1) {
        throw new Error('invalid path');
    }
    const path = pathParts[0];

    await axios.put(
        `https://api.libretexts.org/endpoint/refreshListRemove`,
        {
            id,
            path,
            subdomain,
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.LIBRE_API_ENDPOINT_ACCESS}`,
                Origin: getProductionURL(),
            }
        }
    );
}

/**
 * Uses fuzzy searching to determine if a book is associated with any of the provided campus names
 * based on its `course`, `program`, or `affiliation` fields.
 * @param {object} book - The book object to check.
 * @param {string[]} campusNames - Array of campus names to check against.
 * @returns {boolean} True if the book matches closely with any campus name, false otherwise.
 */
export const checkIsCampusBook = (book, campusNames) => {
    const fields = ['course', 'program', 'affiliation'];

    if (!book || typeof(book) !== 'object') {
        return false;
    }

    if (!Array.isArray(campusNames) || campusNames.length === 0) {
        return false;
    }

    const valsToCheck = fields.map(field => book[field]).filter(value => typeof(value) === 'string' && value.trim() !== '');
    if (valsToCheck.length === 0) {
        return false;
    }

    const loweredBookVals = valsToCheck.map(value => value.toLowerCase());
    const loweredCampusNames = campusNames.map(name => name.toLowerCase());

    const fuse = new Fuse(loweredCampusNames, { includeScore: true, threshold: 0.2, minMatchCharLength: 3 });

    const isCampusBook = loweredBookVals.some(bookVal => {
        return fuse.search(bookVal).length > 0;
    });

    return isCampusBook;
}