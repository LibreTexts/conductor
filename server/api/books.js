//
// LibreTexts Conductor
// collections.js
//

'use strict';
var Promise = require('bluebird');
const Book = require('../models/book.js');
const Collection = require('../models/collection.js');
const Organization = require('../models/organization.js');
const CustomCatalog = require('../models/customcatalog.js');
const Project = require('../models/project.js');
const PeerReview = require('../models/peerreview.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString, getProductionURL } = require('../util/helpers.js');
const { debugError, debugCommonsSync, debugObject } = require('../debug.js');
const b62 = require('base62-random');
const axios = require('axios');
const fs = require('fs-extra');
const {
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
} = require('../util/bookutils.js');
const {
    buildPeerReviewAggregation,
} = require('../util/peerreviewutils.js');
const { libraryNameKeys } = require('../util/librariesmap.js');
const { getBrowserKeyForLib } = require('../util/mtkeys.js');

const projectAPI = require('./projects.js');


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
 * Accepts an array of Books and the sorting choice and
 * returns the sorted array.
 * @param {Object[]} books - the array of Book objects to sort
 * @param {String}   sortChoice - the sort choice, either 'author' or 'title'
 * @returns {Object[]} the sorted array of Books
 */
const sortBooks = (books, sortChoice) => {
    if (Array.isArray(books) && !isEmptyString(sortChoice)) {
        return books.sort((a, b) => {
            var baseA = '';
            var baseB = '';
            if (sortChoice === 'author') {
                baseA = String(a.author);
                baseB = String(b.author);
            } else { // default Sort by Title
                baseA = String(a.title);
                baseB = String(b.title);
            }
            var normalA = baseA.toLowerCase().toLowerCase().replace(/[^A-Za-z]+/g, "");
            var normalB = baseB.toLowerCase().toLowerCase().replace(/[^A-Za-z]+/g, "");
            if (normalA < normalB) {
                return -1;
            }
            if (normalA > normalB) {
                return 1;
            }
            return 0;
        });
    } else {
        return [];
    }
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
        var debugString = "Not importing 1 book — missing fields: " + validationFails.join(',');
        debugCommonsSync(debugString);
    }
    return isValidImport;
};


/**
 * Generates or updates Collections for pre-specified OER programs given listings of each Program's
 * books and information about each program.
 * NOTE: Method should be used in a wrapper Promise chain. No error handler is included.
 * @param {Object} programListings - An object containing each Program's book listings.
 * @param {Object} programDetails - An object containing information about each Program.
 * @returns {Number} The number of Collections updated.
 */
const autoGenerateCollections = (programListings, programDetails) => {
    return Promise.try(() => {
        let collOps = [];
        if (Object.keys(programListings).length > 0) {
            Object.entries(programListings).forEach(([progName, progList]) => {
                collOps.push({
                    updateOne: {
                        filter: {
                            orgID: 'libretexts',
                            program: progName
                        },
                        update: {
                            $setOnInsert: {
                                orgID: 'libretexts',
                                collID: b62(8),
                                title: programDetails[progName],
                                program: progName,
                                privacy: 'public'
                            },
                            $addToSet: {
                                resources: {
                                    $each: progList
                                }
                            }
                        },
                        upsert: true
                    }
                });
            });
            return Collection.bulkWrite(collOps, {
                ordered: false
            });
        }
        return {};
    }).then((collsRes) => {
        if (typeof (collsRes.nModified) === 'number') return collsRes.nModified;
        return 0;
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
    let collsCount = 0;         // number of updated Program Collections
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
    let approvedPrograms = ['openrn', 'openstax', 'mitocw', 'opensuny', 'oeri'];
    let programDetails = {
        openrn: 'OpenRN',
        openstax: 'OpenStax',
        mitocw: 'MIT OpenCourseWare',
        opensuny: 'OpenSUNY',
        oeri: 'ASCCC OERI'
    };
    let programListings = {};
    if (approvedPrograms && Array.isArray(approvedPrograms) && approvedPrograms.length > 0) {
        approvedPrograms.forEach((program) => {
            if (!Object.keys(programListings).includes(program)) {
                programListings[program] = [];
            }
        });
    }
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
                            if (approvedPrograms.length > 0 && approvedPrograms.includes(program)) {
                                if (Object.keys(programListings).includes(program)) {
                                    if (location === 'central') { // don't add from both locations — duplicates
                                        if (!programListings[program].includes(book.zipFilename)) {
                                            programListings[program].push(book.zipFilename);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
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
                    }
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
                        url: book.links?.online
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
                            links: book.links
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
        if (typeof (writeRes.result?.nMatched) === 'number') importCount = writeRes.result.nMatched;
        // All imports succeeded, continue to autogenerate Program Collections
        return autoGenerateCollections(programListings, programDetails);
    }).then((collectionsUpdate) => {
        if (typeof (collectionsUpdate) === 'number') collsCount = collectionsUpdate;
        // Program Collections updated, continue to generate KB Export files
        return generateKBExport();
    }).then((generated) => {
        if (generated === true) didGenExports = true;
        if (projectsToCreate.length > 0) {
            // Continue to autogenerate new Projects
            return projectAPI.autoGenerateProjects(projectsToCreate);
        }
        debugCommonsSync('No new projects to create.');
        return 0;
    }).then((projectsGen) => {
        let msg = `Imported ${importCount} books from the Libraries. ${collsCount} autogenerated Collections updated.`;
        if (didGenExports) {
            msg += ` Successfully generated export files for 3rd-party content services.`;
        } else {
            msg += ` FAILED to generate export files for 3rd-party content services. Check server logs.`;
        }
        if (typeof (projectsGen) === 'number') {
            msg += ` ${projectsGen} new Projects were autogenerated.`;   
        } else if (typeof (projectsGen) === 'boolean' && !projectsGen) {
            msg += ` FAILED to autogenerate new Projects. Check server logs.`;
        }
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
    new Promise((resolve, _reject) => {
        if (process.env.ORG_ID === 'libretexts') {
            // LibreCommons — no need to lookup Organization info
            resolve({});
        } else {
            // Campus Commons — need Organization info
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
                matchObj.location = 'central'; // LibreCommons — default to Central Bookshelves
            } else {
                matchObj.location = 'campus'; // Campus Commons — search Campus Bookshelves
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
            return {}; // LibreCommons — don't need to lookup Organization
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
            return {}; // LibreCommons — don't need to lookup Custom Catalog
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
            // LibreCommons — don't need to lookup Organization
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
            // LibreCommons — don't need to lookup Custom Catalog
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
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getBookDetail = (req, res) => {
    Book.aggregate([
        {
            $match: {
                bookID: req.query.bookID
            }
        }, {
            $project: {
                _id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((books) => {
        if (books.length > 0) {
            return res.send({
                err: false,
                book: books[0]
            });
        } else {
            return res.send({
                err: true,
                errMsg: conductorErrors.err11
            });
        }
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};



/**
 * Checks if a Book has an associated Project, if it allows anonymous Peer Reviews, and the current Peer Reviews available.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookPeerReviews'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getBookPeerReviews = (req, res) => {
    let allowsAnon = true;
    let projectID = '';
    return new Promise((resolve, reject) => {
        const [lib, coverID] = getLibraryAndPageFromBookID(req.query.bookID);
        if (!isEmptyString(lib) && !isEmptyString(coverID)) {
            resolve(Project.findOne({
                $and: [
                    { libreLibrary: lib },
                    { libreCoverID: coverID },
                    { visibility: 'public' }
                ]
            }).lean());
        }
        reject(new Error('notfound'));
    }).then((project) => {
        if (project) {
            projectID = project.projectID;
            if (project.allowAnonPR === false) allowsAnon = false; // true by default
            return PeerReview.aggregate(buildPeerReviewAggregation(project.projectID));
        }
        throw (new Error('noproject'));
    }).then((peerReviews) => {
        return res.send({
            err: false,
            projectID: projectID,
            allowsAnon: allowsAnon,
            reviews: peerReviews
        });
    }).catch((err) => {
        if (err.message === 'noproject') {
            return res.send({
                err: false,
                msg: 'No Projects associated with this resource.'
            });
        } else {
            debugError(err);
            let errMsg = conductorErrors.err6;
            if (err.message === 'notfound') errMsg = conductorErrors.err11;
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
    });
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
 * Makes a request to a Book's respective library
 * to retrieve the Book summary. If no summary has
 * been set, an empty string is returned.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getBookSummary'
 */
const getBookSummary = (req, res) => {
    var summary = '';
    const [lib, pageID] = getLibraryAndPageFromBookID(req.query.bookID);
    const browserKey = getBrowserKeyForLib(lib);
    if ((browserKey !== '') && (browserKey !== 'err')) {
        axios.get(`https://${lib}.libretexts.org/@api/deki/pages/${pageID}/properties?dream.out.format=json`, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "x-deki-token": getBrowserKeyForLib(lib)
            }
        }).then((axiosRes) => {
            if (axiosRes.data) {
                const pageData = axiosRes.data;
                // search for Overview in MindTouch page properties
                if (pageData.property && Array.isArray(pageData.property)) {
                    const overviewData = pageData.property.find((item) => {
                        if (item['@name'] === 'mindtouch.page#overview') {
                            return item;
                        }
                    });
                    if ((overviewData !== undefined) && (overviewData.contents)) {
                        if (overviewData.contents['#text']) {
                            summary = overviewData.contents['#text'];
                        }
                    }
                }
            }
            return res.send({
                err: false,
                bookID: req.query.bookID,
                summary: summary
            });
        }).catch((_axiosErr) => {
            // error requesting data from MindTouch
            debugError(new Error('Book Summary — axiosErr'))
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        });
    } else {
        // missing browserkey — can't authorize request to MindTouch
        debugError(new Error('Book Summary — browserkey'));
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    }
};


/**
 * Retrieves a Book's Table of Contents via an internal
 * call to the LibreTexts API.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getBookTOC'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getBookTOC = (req, res) => {
    getBookTOCFromAPI(req.query.bookID).then((toc) => {
        return res.send({
            err: false,
            toc: toc
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        })
    });
};


/**
 * Makes a request to the LibreTexts API server to build
 * an object consisting of the Book's Table of Contents.
 * INTERNAL USE ONLY
 * NOTE: This function should NOT be called directly from
 * an API route.
 * @param {String} [bookID] - A standard `lib-coverID` LibreTexts identifier.
 * @param {String} [bookURL] - The URL of the LibreText to lookup.
 * @returns {Promise<Object|Error>}
 */
const getBookTOCFromAPI = (bookID, bookURL) => {
    let bookLookup = false;
    return new Promise((resolve, reject) => {
        if (typeof (bookID) === 'string' && !isEmptyString(bookID) && checkBookIDFormat(bookID)) {
            bookLookup = true;
            resolve(Book.findOne({ bookID: bookID }).lean());
        } else if (typeof (bookURL) === 'string' && !isEmptyString(bookURL)) {
            resolve({});
        }
        reject(new Error('tocretrieve'));
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
 * Retrieves a Book's Content Licensing Report from the LibreTexts API
 * Server and returns the data, if it exists.
 * @param {Object} req - the Express.js request object
 * @param {Object} res - the Express.js response object
 */
const getLicenseReport = (req, res) => {
    let notFoundResponse = {
        err: false,
        found: false,
        msg: "Couldn't find a Content Licensing Report for that resource."
    };
    axios.get(`https://api.libretexts.org/licensereports/${req.query.bookID}.json`).then((axiosRes) => {
        if (axiosRes.data?.id) {
            return res.send({
                err: false,
                found: true,
                msg: `Found Content Licensing Report for ${req.query.bookID}.`,
                data: axiosRes.data
            });
        } else return res.send(notFoundResponse);
    }).catch((err) => {
        if (err.response?.status === 404) return res.send(notFoundResponse);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};


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
                    thumbnail: 1
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
        else return generateKBExport(); // try to generate on-the-fly
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
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'getBookPeerReviews':
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'addBookToCustomCatalog':
            return [
                body('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'removeBookFromCustomCatalog':
            return [
                body('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'getBookSummary':
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'getBookTOC':
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'getLicenseReport':
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
    }
};

module.exports = {
    syncWithLibraries,
    getCommonsCatalog,
    getMasterCatalog,
    getBookDetail,
    getBookPeerReviews,
    getCatalogFilterOptions,
    addBookToCustomCatalog,
    removeBookFromCustomCatalog,
    getBookSummary,
    getBookTOC,
    getBookTOCFromAPI,
    getLicenseReport,
    retrieveKBExport,
    validate
};
