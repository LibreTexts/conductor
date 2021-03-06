//
// LibreTexts Conductor
// collections.js
//

'use strict';
import Promise from 'bluebird';
import express from 'express';
import axios from 'axios';
import fs from 'fs-extra';
import { query, param } from 'express-validator';
import {
  debugError,
  debugCommonsSync,
  debugServer
} from '../debug.js';
import Book from '../models/book.js';
import Collection from '../models/collection.js';
import Organization from '../models/organization.js';
import CustomCatalog from '../models/customcatalog.js';
import Project from '../models/project.js';
import PeerReview from '../models/peerreview.js';
import conductorErrors from '../conductor-errors.js';
import { isEmptyString, isValidDateObject } from '../util/helpers.js';
import {
    checkBookIDFormat,
    extractLibFromID,
    getLibraryAndPageFromBookID,
    isValidLibrary,
    isValidLicense,
    isValidSort,
    genThumbnailLink,
    genPDFLink,
    genBookstoreLink,
    genZIPLink,
    genPubFilesLink,
    genLMSFileLink,
    genPermalink,
    getBookTOCFromAPI,
    retrieveBookMaterials,
    downloadBookMaterial,
} from '../util/bookutils.js';
import { buildPeerReviewAggregation } from '../util/peerreviewutils.js';
import { libraryNameKeys } from '../util/librariesmap.js';
import { getBrowserKeyForLib } from '../util/mtkeys.js';
import projectsAPI from './projects.js';
import alertsAPI from './alerts.js';

/**
 * Accepts a library shortname and returns the LibreTexts API URL for the current
 * Bookshelves listings in that library.
 * @param {String} lib - the standard shortened library identifier
 * @returns {String} the URL of the library's Bookshelves listings
 */
const generateBookshelvesURL = (lib) => {
    if (lib !== 'espanol') {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/Bookshelves.json`;
    } else {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/home.json`;
    }
};

/**
 * Accepts a library shortname and returns the LibreTexts API URL for the current
 * Courses listings in that library.
 * @param {String} lib - the standard shortened library identifier
 * @returns {String} the URL of the library's Courses listings
 */
const generateCoursesURL = (lib) => {
    return `https://api.libretexts.org/DownloadsCenter/${lib}/Courses.json`;
};

/**
 * Sorts two strings after normalizing them to contain only letters.
 * @param {String} a 
 * @param {String} b 
 * @returns {Number} the sort order of the two strings
 */
const normalizedSort = (a, b) => {
    var normalizedA = String(a).toLowerCase().replace(/[^a-zA-Z]/gm, '');
    var normalizedB = String(b).toLowerCase().replace(/[^a-zA-Z]/gm, '');
    if (normalizedA < normalizedB) {
        return -1;
    }
    if (normalizedA > normalizedB) {
        return 1;
    }
    return 0;
};

/**
 * Accepts an array of Books and the sorting choice and returns the sorted array.
 *
 * @param {object[]} books - The array of Book objects to sort
 * @param {string} [sortChoice] - The sort choice, either 'random', 'author', or 'title' (default).
 * @returns {object[]} The sorted array of Books.
 */
function sortBooks(books, sortChoice) {
  if (Array.isArray(books) && !isEmptyString(sortChoice)) {
    if (sortChoice === 'random') {
      let shuffleArr = [...books];
      for (let i = shuffleArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleArr[i], shuffleArr[j]] = [shuffleArr[j], shuffleArr[i]];
      }
      return shuffleArr;
    }
    return books.sort((a, b) => {
      let baseA = '';
      let baseB = '';
      if (sortChoice === 'author') {
        baseA = String(a.author);
        baseB = String(b.author);
      } else { // default Sort by Title
        baseA = String(a.title);
        baseB = String(b.title);
      }
      const normalA = baseA.toLowerCase().replace(/[^A-Za-z]+/g, "");
      const normalB = baseB.toLowerCase().replace(/[^A-Za-z]+/g, "");
      if (normalA < normalB) {
        return -1;
      }
      if (normalA > normalB) {
        return 1;
      }
      return 0;
    });
  }
  return [];
};


/**
 * Checks that a new book object has the required fields to be imported.
 * @param {Object} book - The information about the book to be imported.
 * @returns {Boolean} True if ready for import, false otherwise (logged).
 */
const checkValidImport = (book) => {
    var isValidImport = true;
    var validationFails = [];
    var expectedLib = extractLibFromID(book.zipFilename);
    if (book.zipFilename === undefined || book.zipFilename === null || isEmptyString(book.zipFilename)) {
        isValidImport = false;
        validationFails.push('bookID');
    }
    if (book.title === undefined || book.title === null || isEmptyString(book.title)) {
        isValidImport = false;
        validationFails.push('title');
    }
    if (isEmptyString(expectedLib)) {
        isValidImport = false;
        validationFails.push('library');
    }
    if (book.id === undefined || book.id === null || isEmptyString(book.id)) {
        isValidImport = false;
        validationFails.push('coverPageID');
    }
    if (!isValidImport && validationFails.length > 0) {
        var debugString = "Not importing 1 book ??? missing fields: " + validationFails.join(',');
        debugCommonsSync(debugString);
    }
    return isValidImport;
};


/**
 * Updates system-managed Collections for specified OER programs.
 *
 * @returns {Promise<number|boolean>} The number of collections updated, or
 *  false if error encountered.
 */
const autoGenerateCollections = () => {
  const bookQueries = [];
  const collOps = [];
  let collections = [];
  return Collection.find(({ autoManage: true })).lean().then((autoColls) => {
    collections = autoColls;
    /* Find books for auto-managed program collections */
    for (let i = 0, n = autoColls.length; i < n; i += 1) {
      const currColl = autoColls[i];
      if (typeof (currColl.program) === 'string' && currColl.program.length > 0) {
        bookQueries.push(Book.aggregate([
          {
            $match: {
              program: currColl.program,
              location: {
                $in: currColl.locations
              },
            }
          }, {
            $project: {
              _id: 0,
              bookID: 1,
              location: 1,
              program: 1,
            }
          },
        ]));
      }
    }
    return Promise.all(bookQueries);
  }).then((bookQueryRes) => {
    /* Sort books into their auto-managed collection */
    let allBooksFound = [];
    for (let i = 0, n = bookQueryRes.length; i < n; i += 1) {
      allBooksFound = [...allBooksFound, ...bookQueryRes[i]];
    }
    for (let i = 0, n = allBooksFound.length; i < n; i += 1) {
      const currBook = allBooksFound[i];
      const collIdx = collections.findIndex((coll) => coll.program === currBook.program);
      if (collIdx > -1) {
        if (!Array.isArray(collections[collIdx].newListings)) {
          collections[collIdx].newListings = [];
        }
        if (!collections[collIdx].resources?.includes(currBook.bookID)) {
          collections[collIdx].newListings.push(currBook.bookID);
        }
      }
    }
    /* Assembles updates for collections (if necessary) */
    for (let i = 0, n = collections.length; i < n; i += 1) {
      const currColl = collections[i];
      if (Array.isArray(currColl.newListings) && currColl.newListings.length > 0) {
        collOps.push({
          updateOne: {
            filter: {
              collID: currColl.collID,
            },
            update: {
              $addToSet: {
                resources: {
                  $each: currColl.newListings,
                }
              }
            }
          }
        });
      }
    }
    return Collection.bulkWrite(collOps, { ordered: false });
  }).then((updateRes) => {
    if (typeof (updateRes.nModified) === 'number') {
      return updateRes.nModified;
    }
    return 0;
  }).catch((err) => {
    console.error(err);
    return false;
  });
};


/**
 * Retrieve prepared books from the LibreTexts API and process &
 * import them to the Conductor database for use in Commons.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const syncWithLibraries = (_req, res) => {
    let importCount = 0;        // final count of imported books
    let didGenExports = false;  // If KB Export files were generated
    let shelvesRequests = [];   // requests from Bookshelves
    let coursesRequests = [];   // requests from Campus Bookshelves
    let allRequests = [];       // all requests to be made
    let allBooks = [];          // all books returned from LT API
    let processedBooks = [];    // all books processed for DB save
    let bookOps = [];           // update/insert operations to perform with Mongoose
    let existingBooks = [];     // existing books in the DB
    let existingProjects = [];  // existing projects (tied to books) in the DB
    let bookIDs = [];           // all (unique) bookIDs returned from LT API
    let projectsToCreate = [];  // projects to be created to track books from LT API
    let newBookDBIds = [];      // upserted MongoDb id's
    let generatedProjects = false; // did create new projects
    let updatedCollections = false; // did update auto-managed Collections
    // Build list(s) of HTTP requests to be performed
    libraryNameKeys.forEach((lib) => {
        shelvesRequests.push(axios.get(generateBookshelvesURL(lib)));
        coursesRequests.push(axios.get(generateCoursesURL(lib)));
    });
    allRequests = shelvesRequests.concat(coursesRequests);
    // Execute requests
    Promise.all(allRequests).then((booksRes) => {
        // Extract books from responses
        booksRes.forEach((axiosRes) => {
            allBooks = allBooks.concat(axiosRes.data.items);
        });
        // Process books and prepare for DB save
        allBooks.forEach((book) => {
            // check if book is valid & unique, otherwise ignore
            if (checkValidImport(book) && !bookIDs.includes(book.zipFilename)) {
                bookIDs.push(book.zipFilename); // duplicate mitigation
                let link = ''
                let author = '';
                let affiliation = '';
                let license = '';
                let summary = '';
                let subject = '';
                let course = '';
                let location = '';
                let program = '';
                let lastUpdated = '';
                if (book.link) {
                    link = book.link;
                    if (String(book.link).includes('/Bookshelves/')) {
                        location = 'central';
                        let baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Bookshelves/`;
                        let isolated = String(book.link).replace(baseURL, '');
                        let splitURL = isolated.split('/');
                        if (splitURL.length > 0) {
                            let shelfRaw = splitURL[0];
                            subject = shelfRaw.replace(/_/g, ' ');
                        }
                    }
                    if (String(book.link).includes('/Courses/')) {
                        location = 'campus';
                        let baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Courses/`;
                        let isolated = String(book.link).replace(baseURL, '');
                        let splitURL = isolated.split('/');
                        if (splitURL.length > 0) {
                            let courseRaw = splitURL[0];
                            course = courseRaw.replace(/_/g, ' ');
                        }
                    }
                }
                if (book.author) author = book.author;
                if (typeof (book.summary) === 'string') summary = book.summary;
                if (book.institution) affiliation = book.institution; // Affiliation is referred to as "Institution" in LT API
                if (book.tags && Array.isArray(book.tags)) {
                    book.tags.forEach((tag) => {
                        if (tag.includes('license:')) {
                            license = tag.replace('license:', '');
                        }
                        if (tag.includes('program:')) {
                            program = tag.replace('program:', '');
                        }
                    });
                }
                if (typeof (book.lastModified) === 'string') lastUpdated = book.lastModified;
                processedBooks.push({
                    author,
                    affiliation,
                    subject,        // TODO: Improve algorithm
                    location,
                    course,         // TODO: Improve algorithm
                    program,
                    license,
                    summary,
                    bookID: book.zipFilename,
                    title: book.title,
                    library: extractLibFromID(book.zipFilename),
                    thumbnail: genThumbnailLink(extractLibFromID(book.zipFilename), book.id),
                    links: {
                        online: link,
                        pdf: genPDFLink(book.zipFilename),
                        buy: genBookstoreLink(book.zipFilename),
                        zip: genZIPLink(book.zipFilename),
                        files: genPubFilesLink(book.zipFilename),
                        lms: genLMSFileLink(book.zipFilename)
                    },
                    lastUpdated,
                });
            }
        });
        let booksQuery = Book.aggregate([
            {
                $project: {
                    _id: 0,
                    bookID: 1
                }
            }
        ]);
        let projsQuery = Project.aggregate([
            {
                $match: {
                    $and: [
                        { projectURL: { $ne: null } },
                        { libreLibrary: { $ne: null } },
                        { libreCoverID: { $ne: null } }
                    ]
                }
            }, {
                $project: {
                    _id: 0,
                    projectID: 1,
                    projectURL: 1,
                    libreLibrary: 1,
                    libreCoverID: 1
                }
            }
        ]);
        return Promise.all([booksQuery, projsQuery]);
    }).then((queryResults) => {
        if (queryResults.length === 2) {
            if (Array.isArray(queryResults[0])) {
                existingBooks = queryResults[0].map((existBook) => {
                    if (typeof (existBook).bookID === 'string') return existBook.bookID;
                    return null;
                }).filter((item) => item !== null);
            }
            if (Array.isArray(queryResults[1])) existingProjects = queryResults[1];
        }
        processedBooks.forEach((book) => {
            /* check if project needs to be created */
            let [bookLib, bookCoverID] = getLibraryAndPageFromBookID(book.bookID);
            if (typeof (bookLib) === 'string' && typeof (bookCoverID) === 'string') {
                let foundProject = existingProjects.find((project) => {
                    if (project.libreLibrary === bookLib && project.libreCoverID === bookCoverID) {
                        return project;
                    }
                    return null;
                });
                if (foundProject === undefined) {
                    projectsToCreate.push({
                        title: book.title,
                        library: bookLib,
                        coverID: bookCoverID,
                        url: book.links?.online,
                        author: book.author
                    });
                }
            }
            /* insert or update books */
            bookOps.push({
                updateOne: {
                    filter: {
                        bookID: book.bookID
                    },
                    update: {
                        $setOnInsert: {
                            bookID: book.bookID
                        },
                        $set: {
                            title: book.title,
                            author: book.author,
                            affiliation: book.affiliation,
                            library: book.library,
                            subject: book.subject,
                            location: book.location,
                            course: book.course,
                            program: book.program,
                            license: book.license,
                            thumbnail: book.thumbnail,
                            summary: book.summary,
                            links: book.links,
                            lastUpdated: book.lastUpdated
                        }
                    },
                    upsert: true
                }
            })
        });
        existingBooks.forEach((book) => {
            /* check if book needs to be deleted */
            let foundProcessed = processedBooks.find((processed) => book === processed.bookID);
            if (foundProcessed === undefined) {
                // book not found in new batch, needs to be deleted
                bookOps.push({
                    deleteOne: {
                        filter: {
                            bookID: book
                        }
                    }
                });
            }
        });
        return Book.bulkWrite(bookOps, {
            ordered: false
        });
    }).catch((writeErr) => {
        /* Catch intermediate errors with bulkWrite, try to recover */
        if (writeErr.result?.nMatched > 0) {
            // Some imports failed (silent)
            debugCommonsSync(`Updated only ${writeErr.result.nMatched} books when ${allBooks.length} books were expected.`);
            return null; // Continue to auto-generate Program Collections
        } else { // All imports failed
            throw (new Error('bulkwrite'));
        }
    }).then((writeRes) => {
        if (typeof (writeRes.result?.nMatched) === 'number') {
          importCount = writeRes.result.nMatched;
        }
        if (typeof (writeRes.upsertedIds) === 'object') {
            Object.keys(writeRes.upsertedIds).forEach((key) => {
                newBookDBIds.push(writeRes.upsertedIds[key]);
            });
        }
        // All imports succeeded, continue to update auto-managed Collections
        return autoGenerateCollections();
    }).then((autoCollsRes) => {
        updatedCollections = autoCollsRes;
        // Program Collections updated, continue to generate KB Export files
        return generateKBExport();
    }).then((generated) => {
        if (generated === true) {
          didGenExports = true;
        }
        if (projectsToCreate.length > 0) {
            // Continue to autogenerate new Projects
            return projectsAPI.autoGenerateProjects(projectsToCreate);
        }
        debugCommonsSync('No new projects to create.');
        return 0;
    }).then((projectsGen) => {
        generatedProjects = projectsGen;
        if (newBookDBIds.length > 0) {
          return alertsAPI.processInstantBookAlerts(newBookDBIds);
        }
        return true;
    }).then(() => {
        // ignore return value of processing Alerts
        let msg = `Imported ${importCount} books from the Libraries.`;
        if (typeof (updatedCollections) == 'number') {
          msg += ` ${updatedCollections} system-managed Collections updated.`
        } else if (typeof (updatedCollections) === 'boolean' && !updatedCollections) {
          msg += ` FAILED to update system-managed collections. Check server logs.`;
        }
        if (didGenExports) {
            msg += ` Successfully generated export files for 3rd-party content services.`;
        } else {
            msg += ` FAILED to generate export files for 3rd-party content services. Check server logs.`;
        }
        if (typeof (generatedProjects) === 'number') {
            msg += ` ${generatedProjects} new Projects were autogenerated.`;   
        } else if (typeof (generatedProjects) === 'boolean' && !generatedProjects) {
            msg += ` FAILED to autogenerate new Projects. Check server logs.`;
        }
        debugCommonsSync(msg);
        return res.send({
            err: false,
            msg: msg
        });
    }).catch((err) => {
        debugError(err);
        if (err.message === 'bulkwrite') {
            // all imports failed
            return res.send({
                err: true,
                msg: conductorErrors.err13
            });
        } else if (err.code === 'ENOTFOUND') { // issues connecting to LT API
            return res.send({
                err: true,
                errMsg: conductorErrors.err16
            });
        } else { // other errors
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Runs the Sync with Libraries job via on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const runAutomatedSyncWithLibraries = (req, res) => {
    debugServer(`Received automated request to sync Commons with Libraries ${new Date().toLocaleString()}`);
    return syncWithLibraries(req, res);
};


/**
 * Accepts a standard Organization-model object and generates an array of strings of all
 * known variations of the Organization's name, including full, short, abbreviation, and
 * possible aliases.
 * INTERNAL USE ONLY.
 * @param {Object} orgData - An Organization information object.
 * @returns {String[]} An array of known Organization names.
 */
const buildOrganizationNamesList = (orgData) => {
    if (orgData) {
        let campusNames = []; // stores all variations of the organization name
        let normNames = []; // temporarily stores the normalized variations
        if (orgData.name && !isEmptyString(orgData.name)) {
            if (!campusNames.includes(orgData.name)) {
                campusNames.push(orgData.name);
            }
        }
        if (orgData.shortName && !isEmptyString(orgData.shortName)) {
            if (!campusNames.includes(orgData.shortName)) {
                campusNames.push(orgData.shortName);
            }
        }
        if (orgData.abbreviation && !isEmptyString(orgData.abbreviation)) {
            if (!campusNames.includes(orgData.abbreviation)) {
                campusNames.push(orgData.abbreviation);
            }
        }
        if (orgData.aliases && Array.isArray(orgData.aliases) && orgData.aliases.length > 0) {
            campusNames = campusNames.concat(orgData.aliases);
        }
        // Normalize the names to remove common punctuation, then add to campusNames list
        campusNames.forEach((name) => {
            let normed = String(name).replace(/,/g, '').replace(/-/g, '').replace(/:/g, '').replace(/'/g, '');
            if (!normNames.includes(normed) && !campusNames.includes(normed)) {
                normNames.push(normed);
            }
            let lowerNormed = String(normed).toLowerCase();
            if (!normNames.includes(lowerNormed) && !campusNames.includes(lowerNormed)) {
                normNames.push(lowerNormed);
            }
        });
        if (normNames.length > 0) {
            campusNames = campusNames.concat(normNames);
        }
        return campusNames;
    } else {
        return [];
    }
};


/**
 * Returns the Commons Catalog results according
 * to the requested filters and sort option.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getCommonsCatalog'
 */
const getCommonsCatalog = (req, res) => {
    var orgData = {};
    var sortChoice = 'title'; // default to Sort by Title
    const matchObj = {};
    var hasSearchParams = false;
    return new Promise((resolve, _reject) => {
        if (process.env.ORG_ID === 'libretexts') {
            // LibreCommons ??? no need to lookup Organization info
            resolve({});
        } else {
            // Campus Commons ??? need Organization info
            resolve(Organization.findOne({
                orgID: process.env.ORG_ID
            }, {
                _id: 0,
                orgID: 1,
                name: 1,
                shortName: 1,
                abbreviation: 1,
                aliases: 1
            }));
        }
    }).then((orgDataRes) => {
        if (orgDataRes && Object.keys(orgDataRes).length > 0) {
            orgData = orgDataRes;
        }
        if (process.env.ORG_ID === 'libretexts') {
            // LibreCommons - no need to lookup Custom Catalog
            return {};
        } else {
            // Campus Commons - look up Custom Catalog
            return CustomCatalog.findOne({
                orgID: process.env.ORG_ID
            }, {
                _id: 0,
                orgID: 1,
                resources: 1
            });
        }
    }).then((customCatalogRes) => {
        var hasCustomEntries = false;
        if (req.query.library && !isEmptyString(req.query.library)) {
            matchObj.library = req.query.library;
            hasSearchParams = true;
        }
        if (req.query.subject && !isEmptyString(req.query.subject)) {
            matchObj.subject = req.query.subject;
            hasSearchParams = true;
        }
        if (req.query.location && !isEmptyString(req.query.location)) {
            matchObj.location = req.query.location;
            hasSearchParams = true;
        } else {
            if (process.env.ORG_ID === 'libretexts') {
                matchObj.location = 'central'; // LibreCommons ??? default to Central Bookshelves
            } else {
                matchObj.location = 'campus'; // Campus Commons ??? search Campus Bookshelves
            }
        }
        if (req.query.author && !isEmptyString(req.query.author)) {
            matchObj.author = req.query.author;
            hasSearchParams = true;
        }
        if (req.query.license && !isEmptyString(req.query.license)) {
            matchObj.license = req.query.license;
            hasSearchParams = true;
        }
        if (req.query.affiliation && !isEmptyString(req.query.affiliation)) {
            matchObj.affiliation = req.query.affiliation;
            hasSearchParams = true;
        }
        if (req.query.sort && !isEmptyString(req.query.sort)) {
            sortChoice = req.query.sort;
        }
        if (req.query.search && !isEmptyString(req.query.search)) {
            matchObj['$text'] = {
                $search: `\"${req.query.search}\"`
            };
            hasSearchParams = true;
        }
        if (req.query.course && !isEmptyString(req.query.course)) {
            matchObj.course = req.query.course;
            hasSearchParams = true;
        }
        if ((process.env.ORG_ID !== 'libretexts')) {
            var campusNames = buildOrganizationNamesList(orgData);
            if (req.query.course && !isEmptyString(req.query.course)) {
                campusNames.unshift(req.query.course);
            }
            if (req.query.publisher && !isEmptyString(req.query.publisher)) {
                campusNames.unshift(req.query.publisher)
            }
            if (customCatalogRes && Object.keys(customCatalogRes).length > 0) {
                if (customCatalogRes.resources && Array.isArray(customCatalogRes.resources) &&
                    customCatalogRes.resources.length > 0) {
                    hasCustomEntries = true;
                }
            }
            if (hasCustomEntries) {
                if (matchObj.location) {
                    delete matchObj.location; // prune matchObj to allow custom entries
                }
                matchObj['$or'] = [{
                    bookID: {
                        $in: customCatalogRes.resources
                    }
                }, {
                    course: {
                        $in: campusNames
                    }
                }, {
                    program: {
                        $in: campusNames
                    }
                }]
            } else {
                matchObj['$or'] = [{
                    course: {
                        $in: campusNames
                    }
                }, {
                    program: {
                        $in: campusNames
                    }
                }];
            }
        }
        return Book.aggregate([
            {
                $match: matchObj
            }, {
                $project: {
                    _id: 0,
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            }
        ]);
    }).then((books) => {
        const sortedBooks = sortBooks(books, sortChoice);
        return res.send({
            err: false,
            books: sortedBooks
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};


/**
 * Returns the master list of Commons Catalog
 * items with limited filtering and sorting.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getMasterCatalog'
 */
const getMasterCatalog = (req, res) => {
    var sortedBooks = [];
    var orgData = {};
    var sortChoice = 'title'; // default to Sort by Title
    var matchObj = {};
    if (req.query.sort && !isEmptyString(req.query.sort)) {
        sortChoice = req.query.sort;
    }
    if (req.query.search && !isEmptyString(req.query.search)) {
        matchObj['$text'] = {
            $search: req.query.search
        }
    }
    Book.aggregate([
        {
            $match: matchObj
        }, {
            $project: {
                _id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((books) => {
        sortedBooks = sortBooks(books, sortChoice);
        if (process.env.ORG_ID !== 'libretexts') {
            return Organization.findOne({
                orgID: process.env.ORG_ID
            });
        } else {
            return {}; // LibreCommons ??? don't need to lookup Organization
        }
    }).then((orgDataRes) => {
        if (Object.keys(orgDataRes).length > 0) {
            orgData = orgDataRes;
        }
        if (process.env.ORG_ID !== 'libretexts') {
            return CustomCatalog.findOne({
                orgID: process.env.ORG_ID
            }, {
                _id: 0,
                orgID: 1,
                resources: 1
            });
        } else {
            return {}; // LibreCommons ??? don't need to lookup Custom Catalog
        }
    }).then((customCatalogRes) => {
        // Check if book has been enabled via Custom Catalog
        if ((customCatalogRes !== null) && (Object.keys(customCatalogRes).length > 0)) {
            if (customCatalogRes.resources && Array.isArray(customCatalogRes.resources)) {
                sortedBooks.forEach((book) => {
                    if (customCatalogRes.resources.includes(book.bookID)) {
                        book.isCustomEnabled = true;
                    }
                });
            }
        }
        // Check if book originated from the Organization
        if (Object.keys(orgData).length > 0) {
            var campusNames = buildOrganizationNamesList(orgData);
            sortedBooks.forEach((book) => {
                var isCampusBook = campusNames.some((item) => {
                    if (book.course && !isEmptyString(book.course)) {
                        return (String(book.course).includes(item) || String(book.course) === item);
                    } else if (book.program && !isEmptyString(book.program)) {
                        return (String(book.program).includes(item) || String(book.program) === item);
                    } else if (book.affiliation && !isEmptyString(book.affiliation)) {
                        return (String(book.affiliation).includes(item) || String(book.affiliation) === item);
                    } else {
                        return false;
                    }
                });
                if (isCampusBook) book.isCampusBook = true;
            });
        }
        return res.send({
            err: false,
            books: sortedBooks
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};


/**
 * Returns the current options for dynamic
 * filters in Commons Catalog(s).
 */
const getCatalogFilterOptions = (_req, res) => {
    var orgData = {};
    var authors = [];
    var subjects = [];
    var affiliations = [];
    var courses = [];
    var programs = [];
    var matchObj = {};
    new Promise((resolve, _reject) => {
        if (process.env.ORG_ID === 'libretexts') {
            // LibreCommons ??? don't need to lookup Organization
            resolve({});
        } else {
            resolve(Organization.findOne({
                orgID: process.env.ORG_ID
            }, {
                _id: 0,
                orgID: 1,
                name: 1,
                shortName: 1,
                abbreviation: 1,
                aliases: 1
            }));
        }
    }).then((orgDataRes) => {
        if (orgDataRes && Object.keys(orgDataRes).length > 0) {
            orgData = orgDataRes;
        }
        if (process.env.ORG_ID === 'libretexts') {
            // LibreCommons ??? don't need to lookup Custom Catalog
            return {};
        } else {
            return CustomCatalog.findOne({
                orgID: process.env.ORG_ID
            }, {
                _id: 0,
                orgID: 1,
                resources: 1
            });
        }
    }).then((customCatalogRes) => {
        var hasCustomEntries = false;
        var campusNames = [];
        if (customCatalogRes && Object.keys(customCatalogRes).length > 0) {
            if (customCatalogRes.resources && Array.isArray(customCatalogRes.resources) &&
                customCatalogRes.resources.length > 0) {
                hasCustomEntries = true;
            }
        }
        if (process.env.ORG_ID !== 'libretexts') {
            campusNames = buildOrganizationNamesList(orgData);
        }
        if ((process.env.ORG_ID !== 'libretexts') && (hasCustomEntries)) {
            matchObj['$or'] = [{
                bookID: {
                    $in: customCatalogRes.resources
                }
            }, {
                course: {
                    $in: campusNames
                }
            }, {
                program: {
                    $in: campusNames
                }
            }];
        } else if (process.env.ORG_ID !== 'libretexts') {
            matchObj['$or'] = [{
                course: {
                    $in: campusNames
                }
            }, {
                program: {
                    $in: campusNames
                }
            }];
        }
        return Book.aggregate([
            {
                $match: matchObj
            }, {
                $project: {
                    _id: 0,
                    author: 1,
                    subject: 1,
                    affiliation: 1,
                    course: 1,
                    program: 1
                }
            }
        ]);
    }).then((books) => {
        books.forEach((book) => {
            if (book.author && !isEmptyString(book.author)) {
                if (!authors.includes(book.author)) {
                    authors.push(book.author);
                }
            }
            if (book.subject && !isEmptyString(book.subject)) {
                if (!subjects.includes(book.subject)) {
                    subjects.push(book.subject);
                }
            }
            if (book.affiliation && !isEmptyString(book.affiliation)) {
                if (!affiliations.includes(book.affiliation)) {
                    affiliations.push(book.affiliation);
                }
            }
            if (book.course && !isEmptyString(book.course)) {
                if (!courses.includes(book.course)) {
                    courses.push(book.course);
                }
            }
            if (book.program && !isEmptyString(book.program)) {
                if (!programs.includes(book.program)) {
                    programs.push(book.program);
                }
            }
        });
        authors.sort(normalizedSort);
        subjects.sort(normalizedSort);
        affiliations.sort(normalizedSort);
        courses.sort(normalizedSort);
        programs.sort(normalizedSort);
        return res.send({
            err: false,
            authors: authors,
            subjects: subjects,
            affiliations: affiliations,
            courses: courses,
            publishers: programs // referred to as 'Publishers' on front-end
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Returns a Book object given a book ID.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookDetail'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookDetail(req, res) {
  try {
    const { bookID } = req.params;
    const bookRes = await Book.aggregate([
      {
        $match: { bookID },
      }, {
        $addFields: {
          coverID: {
            $arrayElemAt: [
              { $split: ['$bookID', '-'] },
              1,
            ],
          },
        },
      }, {
        $lookup: {
          from: 'projects',
          let: {
            lib: '$library',
            coverID: '$coverID',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$lib', '$libreLibrary'] },
                    { $eq: ['$$coverID', '$libreCoverID'] },
                    { $eq: ['$visibility', 'public'] },
                  ],
                },
              },
            },
          ],
          as: 'project',
        },
      }, {
        $addFields: {
          project: {
            $arrayElemAt: ['$project', 0],
          },
        },
      }, {
        $lookup: {
          from: 'peerreviews',
          let: {
            projectID: '$project.projectID',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$projectID', '$$projectID'],
                },
              },
            },
          ],
          as: 'peerReviews',
        },
      }, {
        $addFields: {
          hasMaterials: {
            $and: [
              { $ifNull: ['$materials', false] },
              { $gt: [{ $size: '$materials' }, 0] },
            ],
          },
          allowAnonPR: {
            $and: [
              { $ne: [{ $type: '$project.allowAnonPR' }, 'missing'] },
              { $ne: ['$project.allowAnonPR', false] },
            ],
          },
          hasPeerReviews: {
            $and: [
              { $ifNull: ['$peerReviews', false] },
              { $gt: [{ $size: '$peerReviews' }, 0] },
            ],
          },
          hasAdaptCourse: {
            $and: [
              { $ifNull: ['$project.adaptCourseID', false] },
              { $gt: [{ $strLenBytes: '$project.adaptCourseID' }, 0] },
            ],
          },
          adaptCourseID: {
            $cond: [
              {
                $and: [
                  { $ifNull: ['$project.adaptCourseID', false] },
                  { $gt: [{ $strLenBytes: '$project.adaptCourseID' }, 0] },
                ]
              },
              '$project.adaptCourseID',
              '$adaptCourseID', // undefined
            ],
          },
        },
      }, {
        $project: {
          _id: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
          materials: 0,
          project: 0,
          peerReviews: 0,
        },
      },
    ]);
    if (bookRes.length < 1) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    return res.send({
      err: false,
      book: bookRes[0],
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Checks if a Book has an associated Project, if it allows anonymous Peer Reviews,
 *  and the current Peer Reviews available.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookPeerReviews'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookPeerReviews(req, res) {
  try {
    let allowsAnon = true;
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    if (isEmptyString(lib) || isEmptyString(coverID)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const project = await Project.findOne({
      $and: [
        { libreLibrary: lib },
        { libreCoverID: coverID },
        { visibility: 'public' },
      ],
    }).lean();
    if (!project) {
      return res.send({
        err: false,
        msg: 'No Projects associated with this resource.',
      });
    }
    
    if (project.allowAnonPR === false) {
      allowsAnon = false; // true by default
    }
    const peerReviews = await PeerReview.aggregate(buildPeerReviewAggregation(project.projectID));
    return res.send({
      err: false,
      projectID: project.projectID,
      reviews: peerReviews,
      allowsAnon,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Adds the Book specified by @bookID in the request
 * body to the Custom Catalog for the organization
 * handled by the current server instance.
 * If the Book is already in the Custom Catalog,
 * no change is made (unique entries).
 * If the Custom Catalog record does not already
 * exists, it is created.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'addBookToCustomCatalog'
 */
const addBookToCustomCatalog = (req, res) => {
    CustomCatalog.updateOne({ orgID: process.env.ORG_ID }, {
        $setOnInsert: {
            orgID: process.env.ORG_ID
        },
        $addToSet: {
            resources: req.body.bookID
        }
    }, {
        upsert: true
    }).then((catalogRes) => {
        if ((catalogRes.matchedCount === 1) && (catalogRes.modifiedCount === 1)) {
            return res.send({
                err: false,
                msg: "Resource successfully added to Catalog."
            });
        } else if (catalogRes.n === 0) {
            throw (new Error('notfound'));
        } else {
            throw (new Error('updatefailed'));
        }
    }).catch((err) => {
        if (err.message === 'notfound') {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err11
            });
        } else {
            debugError(err);
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Removes the Book specified by @bookID in the request
 * body from the Custom Catalog for the organization
 * handled by the current server instance. If the
 * book is not in the Custom Catalog, no change is
 * made. All instances of the @bookID are removed from
 * the Custom Catalog to combat duplicate entries.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'removeBookFromCustomCatalog'
 */
const removeBookFromCustomCatalog = (req, res) => {
    CustomCatalog.updateOne({ orgID: process.env.ORG_ID }, {
        $pullAll: {
            resources: [req.body.bookID]
        }
    }).then((catalogRes) => {
        if ((catalogRes.matchedCount === 1) && (catalogRes.modifiedCount === 1)) {
            return res.send({
                err: false,
                msg: "Resource successfully removed from Catalog."
            });
        } else if (catalogRes.n === 0) {
            throw (new Error('notfound'));
        } else {
            throw (new Error('updatefailed'));
        }
    }).catch((err) => {
        if (err.message === 'notfound') {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err11
            });
        } else {
            debugError(err);
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Makes a request to a Book's respective library to retrieve the Book summary. If no summary has
 * been set, an empty string is returned.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookSummary'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookSummary(req, res) {
  try {
    const { bookID } = req.params;
    const book = await Book.findOne({ bookID }).lean();
    if (!book) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    return res.send({
      err: false,
      summary: book.summary || '',
      bookID,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Retrieves a Book's Table of Contents via an internal call to the LibreTexts API.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookTOC'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookTOC(req, res) {
  try {
    const toc = await getBookTOCFromAPI(req.params.bookID);
    return res.send({
      err: false,
      toc,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Retrieves a Book's Content Licensing Report from the LibreTexts API
 * Server and returns the data, if it exists.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getLicenseReport(req, res) {
  const notFoundResponse = {
    err: false,
    found: false,
    msg: "Couldn't find a Content Licensing Report for that resource.",
  };
  try {
    const { bookID } = req.params;
    let notFound = false;
    const licRep = await axios.get(
      `https://api.libretexts.org/licensereports/${bookID}.json`,
    ).catch((err) => {
      if (err.response?.status === 404) {
        notFound = true;
      } else {
        throw (err);
      }
    })
    if (notFound || !licRep.data?.id) {
      return res.send(notFoundResponse);
    }

    return res.send({
      err: false,
      found: true,
      msg: `Found Content Licensing Report for ${bookID}.`,
      data: licRep.data,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Retrieves a download URL for a single Book Ancillary Material.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookMaterial(req, res) {
  try {
    const { bookID, materialID } = req.params;

    const downloadURL = await downloadBookMaterial(bookID, materialID, req);

    if (downloadURL === null) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    } else if (downloadURL === false) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    return res.send({
      err: false,
      msg: 'Successfuly generated download link!',
      url: downloadURL,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of Book Materials from S3.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookMaterials(req, res) {
  try {
    const bookID = req.params.bookID;
    const materialID = req.params.materialID || '';
    
    const [materials, path] = await retrieveBookMaterials(bookID, materialID);

    if (!materials) { // error encountered
      throw (new Error('retrieveerror'));
    }

    return res.send({
      err: false,
      msg: 'Successfully retrieved materials!',
      path,
      materials,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Generates a JSON file containing Commons Books listings for use by 3rd parties.
 * @returns {boolean} True if export creation succeeded, false otherwise.
 */
const generateKBExport = () => {
    let kbExport = {
        date: new Date().toISOString(),
        titles: []
    };
    return new Promise((resolve, _reject) => {
        resolve(Book.aggregate([
            {
                $project: {
                    _id: 0,
                    bookID: 1,
                    title: 1,
                    author: 1,
                    library: 1,
                    license: 1,
                    summary: 1,
                    thumbnail: 1,
                    lastUpdated: 1
                }
            }
        ]));
    }).then((commonsBooks) => {
        if (Array.isArray(commonsBooks)) {
            kbExport.expected = commonsBooks.length;
            commonsBooks.forEach((item) => {
                let bookOut = {
                    publication_title: String(item.title).trim().replace(/\\n/ig, ' ').replace('Book: ', ''),
                    title_id: item.bookID,
                    title_url: genPermalink(item.bookID),
                    coverage_depth: 'fulltext',
                    access_type: 'F',
                    publisher_name: 'LibreTexts'
                };
                if (typeof (item.thumbnail) === 'string' && !isEmptyString(item.thumbnail)) {
                    bookOut.thumbnail_url = item.thumbnail;
                }
                if (typeof (item.license) === 'string' && !isEmptyString(item.license)) {
                    bookOut.license = item.license;
                }
                if (typeof (item.lastUpdated) === 'string') {
                    const lastUpdateDate = new Date(item.lastUpdated);
                    if (isValidDateObject(lastUpdateDate)) {
                        bookOut.date_last_updated = item.lastUpdated;
                    }
                }
                if (typeof (item.summary) === 'string' && !isEmptyString(item.summary)) {
                    bookOut.description = item.summary;
                }
                if (item.library === 'espanol') {
                    bookOut.language = 'spanish';
                } else {
                    bookOut.language = 'english';
                }
                if (typeof (item.author) === 'string' && !isEmptyString(item.author)) {
                    let itemAuthors = [];
                    let textmapMatch = item.author.match(/textmap/ig);
                    if (textmapMatch === null) { // not a textmap, try to parse authors
                        let authorsString = item.author.replace(/(&|\band\b)/ig, ',');
                        let authors = authorsString.split(/,/ig);
                        if (authors.length > 0) {
                            authors.forEach((author) => {
                                let authorProcess = author.trim();
                                if (authorProcess.toLowerCase() !== 'no attribution by request' && authorProcess.length > 0) {
                                    itemAuthors.push(authorProcess);
                                }
                            });
                        }
                    } else { // textmap, mark author as LibreTexts
                        itemAuthors.push('LibreTexts');
                    }
                    if (itemAuthors.length > 0) bookOut.authors = itemAuthors;
                }
                kbExport.titles.push(bookOut);
            });
            return fs.ensureDir('./public');
        } else throw (new Error('notarray'));
    })
    .then(() => fs.writeJson('./public/kbexport.json', kbExport))
    .then(() => true)
    .catch((err) => {
        debugError(err);
        return false;
    });
};


/**
 * Attempts to retrieve the Knowledge Base export file(s) if available or generate them
 * immediately if not found.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const retrieveKBExport = (_req, res) => {
    fs.pathExists('./public/kbexport.json').then((exists) => {
        if (exists === true) return true;
        return generateKBExport(); // generate on-the-fly
    }).then((generated) => {
        if (generated === true) {
            return res.status(200).sendFile('./public/kbexport.json', { root: '.' });
        }
        throw (new Error('kbexport-notfound'));
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            msg: conductorErrors.err45
        });
    });
};


/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
  switch (method) {
    case 'getCommonsCatalog':
      return [
        query('sort', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidSort),
        query('library', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLibrary),
        query('subject', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
        query('author', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
        query('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
        query('affiliation', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
        query('course', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
        query('publisher', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
        query('search', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 })
      ]
    case 'getMasterCatalog':
      return [
        query('sort', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidSort),
        query('search', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 })
      ]
    case 'getBookDetail':
    case 'getBookPeerReviews':
    case 'getBookSummary':
    case 'getBookTOC':
    case 'getLicenseReport':
      return [
        param('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat),
      ]
    case 'addBookToCustomCatalog':
    case 'removeBookFromCustomCatalog':
      return [
        query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
      ]
    case 'getBookMaterial':
      return [
        param('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat),
        param('materialID', conductorErrors.err1).exists().isUUID(),
      ]
    case 'getBookMaterials':
      return [
        param('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat),
        param('materialID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
      ]
  }
};

export default {
    syncWithLibraries,
    runAutomatedSyncWithLibraries,
    getCommonsCatalog,
    getMasterCatalog,
    getBookDetail,
    getBookPeerReviews,
    getCatalogFilterOptions,
    addBookToCustomCatalog,
    removeBookFromCustomCatalog,
    getBookSummary,
    getBookTOC,
    getLicenseReport,
    getBookMaterials,
    getBookMaterial,
    retrieveKBExport,
    validate
}
