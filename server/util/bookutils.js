//
// LibreTexts Conductor
// bookutils.js
//
import Promise from 'bluebird';
import axios from 'axios';
import express from 'express';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import base64 from 'base-64';
import { libraryNameKeys } from './librariesmap.js';
import Book from '../models/book.js';
import { getProductionURL, isEmptyString, removeTrailingSlash, assembleUrl } from './helpers.js';
import { debugError } from '../debug.js';

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

export const MATERIALS_S3_CLIENT_CONFIG = {
  credentials: {
    accessKeyId: process.env.AWS_MATERIALS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_MATERIALS_SECRET_KEY,
  },
  region: process.env.AWS_MATERIALS_REGION,
};

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
    if (checkBookIDFormat(bookID)) return `https://libretexts.org/bookstore/single.html?${bookID}`;
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

/**
 * Retrieves all Ancillary Materials for a Book stored in the database as a flat array.
 * Generally reserved for internal use.
 *
 * @param {string} bookID - LibreTexts standard book identifier.
 * @returns {Promise<object[]|null>} All Materials listings, or null if error encountered.
 */
export async function retrieveAllBookMaterials(bookID) {
  try {
    const bookResults = await Book.aggregate([
      {
        $match: { bookID },
      }, {
        $unwind: {
          path: '$materials',
          preserveNullAndEmptyArrays: true,
        },
      }, {
        $addFields: {
          materials: {
            createdDate: { $dateToString: { date: '$materials._id' } },
          },
        },
      }, {
        $lookup: {
          from: 'users',
          let: { createdBy: "$materials.createdBy" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$uuid', '$$createdBy' ] },
              }
            }, {
              $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
              }
            }
          ],
          as: 'materials.uploader',
        },
      }, {
        $addFields: {
          'materials.uploader': {
            $arrayElemAt: ['$materials.uploader', 0],
          },
        },
      }, {
        $group: {
          _id: '$_id',
          materials: { $push: '$materials' },
        },
      },
    ]);
    if (bookResults.length < 1) {
      throw (new Error('Book not found.'));
    }
    const book = bookResults[0];
    if (!Array.isArray(book.materials)) {
      return [];
    }
    const sorted = book.materials.sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });
    return sorted;
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Retrieves a list of Ancillary Materials for a Book in hierarchical format.
 *
 * @param {string} bookID - The LibreTexts standard book identifier.
 * @param {string} [materialsKey=''] - The folder identifier to restrict the search to, if desired.
 * @param {boolean} [details=false] - Include additional details about each file, such as uploader.
 * @returns {Promise<[object[], object[]]|[null, null]>} A 2-tuple containing the list of materials and the path
 * leading to the results, or nulls if error encountered.
 */
export async function retrieveBookMaterials(bookID, materialsKey = '', details = false) {
  try {
    let path = [{
      materialID: '',
      name: '',
    }];

    const allMaterials = await retrieveAllBookMaterials(bookID);
    if (!allMaterials) {
      throw (new Error('retrieveerror'));
    }
    if (allMaterials.length === 0) {
      return [[], path];
    }

    let foundFolder = null;    
    if (materialsKey !== '') {
      foundFolder = allMaterials.find((obj) => obj.materialID === materialsKey);
      if (!foundFolder) {
        return [null, null]
      }
    }
    const foundEntries = allMaterials.filter((obj) => obj.parent === materialsKey);

    const buildParentPath = (obj) => {
      let pathNodes = [];
      pathNodes.push({
        materialID: obj.materialID,
        name: obj.name,
      });
      if (obj.parent !== '') {
        const parent = allMaterials.find((pParent) => pParent.materialID === obj.parent);
        if (parent) {
          pathNodes = [...buildParentPath(parent), ...pathNodes];
        }
      }
      return pathNodes;
    };

    if (foundFolder) {
      path.push(...buildParentPath(foundFolder));
    }

    const buildChildList = (obj) => {
      const currObj = obj;
      let children = [];
      if (!details) {
        ['_id', 'createdby', 'downloadCount', 'uploader'].forEach((key) => delete currObj[key]);
      }
      if (obj.storageType !== 'folder') {
        return currObj;
      }
      const foundChildren = allMaterials.filter((childObj) => childObj.parent === currObj.materialID);
      if (foundChildren.length > 0) {
        children = foundChildren.map((childObj) => buildChildList(childObj));
        children = sortBookMaterials(children);
      }
      return {
        ...currObj,
        children,
      }
    };

    const results = sortBookMaterials(foundEntries.map((obj) => buildChildList(obj)));
    return [results, path];
  } catch (e) {
    debugError(e);
    return [null, null];
  }
}

/**
 * Generates a pre-signed download URL for a Book Material, if access settings allow.
 *
 * @param {string} bookID - Identifier of the book to search in.
 * @param {string} materialID - Identifier of the file in the Book's materials list.
 * @param {express.Request} req - Original network request object, for determining file access.
 * @returns {Promise<string|null|false>} The pre-signed url or null if not found,
 *  or false if unauthorized.
 */
export async function downloadBookMaterial(bookID, materialID, req) {
  try {
    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) { // error encountered 
      throw (new Error('retrieveerror'));
    }

    const foundFile = materials.find((obj) => (
      obj.materialID === materialID && obj.storageType === 'file'
    ));
    if (!foundFile) {
      return null;
    }
    if (foundFile.access === 'users') {
      if (!req.user?.decoded?.uuid) {
        return false;
      }
    }

    const fileURL = assembleUrl([
      'https://',
      process.env.AWS_MATERIALS_DOMAIN,
      bookID,
      foundFile.materialID,
    ]);
    const exprDate = new Date();
    exprDate.setDate(exprDate.getDate() + 7); // 1-week expiration time
    const privKey = base64.decode(process.env.AWS_MATERIALS_CLOUDFRONT_PRIVKEY);

    const signedURL = getSignedUrl({
      url: fileURL,
      keyPairId: process.env.AWS_MATERIALS_KEYPAIR_ID,
      dateLessThan: exprDate,
      privateKey: privKey,
    });

    /* Update download count */
    let downloadCount = 1;
    if (typeof (foundFile.downloadCount) === 'number') {
      downloadCount = foundFile.downloadCount + 1;
    }
    const updated = materials.map((obj) => {
      if (obj.materialID === foundFile.materialID) {
        return {
          ...obj,
          downloadCount,
        };
      }
      return obj;
    });
    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      debugError(`Error occurred updating ${bookID}/${materialID} download count.`);
    }

    return signedURL;
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Computes the access settings of folder within a Materials file system.
 * Does not update the database.
 *
 * @param {object[]} materials - The full array of materials, with any access updates applied.
 * @returns {object[]} The array of materials with folder access settings fully computed.
 */
export function computeStructureAccessSettings(materials) {
  let toUpdate = [];

  const computeFolderAccess = (folder) => {
    const uniqueSettings = new Set();
    const children = materials.filter((obj) => obj.parent === folder.materialID);
    children.forEach((child) => {
      if (child.storageType === 'file') {
        uniqueSettings.add(child.access);
      }
      if (child.storageType === 'folder') {
        uniqueSettings.add(computeFolderAccess(child));
      }
    });
    const foundSettings = Array.from(uniqueSettings);
    let newSetting = null;
    if (foundSettings.length > 1) {
      newSetting = 'mixed';
    }
    if (foundSettings.length === 1) {
      newSetting = foundSettings[0];
    }
    if (newSetting !== folder.access) {
      toUpdate.push({
        ...folder,
        access: newSetting,
      });
      return newSetting;
    }
    return folder.access;
  };

  const topLevel = materials.filter((obj) => obj.storageType === 'folder' && obj.parent === '');
  topLevel.forEach((obj) => computeFolderAccess(obj));

  return materials.map((obj) => {
    const foundUpdate = toUpdate.find((upd) => upd.materialID === obj.materialID);
    if (foundUpdate) {
      return foundUpdate;
    }
    return obj;
  });
}

/**
 * Stores an update to a Book's Materials array in the database.
 *
 * @param {string} bookID - Identifier of the book to update.
 * @param {object[]} updatedMaterials - The full array of materials, with updated entries.
 * @return {Promise<boolean>} True if successful, false otherwise.
 */
export async function updateBookMaterials(bookID, updatedMaterials) {
  try {
    await Book.updateOne(
      { bookID },
      { materials: updatedMaterials },
    );
    return true;
  } catch (e) {
    debugError(e);
    return false;
  }
}

/**
 * Sorts an array of Book Materials based on the name of each entry, in natural alphanumeric order.
 *
 * @param {object[]} arr - Array of Materials entries.
 * @returns {object[]} The sorted array.
 */
export function sortBookMaterials(arr) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  const collator = new Intl.Collator();
  return arr.sort((a, b) => collator.compare(a.name, b.name));
}
