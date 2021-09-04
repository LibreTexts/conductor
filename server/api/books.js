//
// LibreTexts Conductor
// collections.js
//

'use strict';
const Book = require('../models/book.js');
const Collection = require('../models/collection.js');
const Organization = require('../models/organization.js');
const CustomCatalog = require('../models/customcatalog.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError, debugCommonsSync, debugObject } = require('../debug.js');
const b62 = require('base62-random');
const axios = require('axios');
const {
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
    genLMSFileLink,
} = require('../util/bookutils.js');


/**
 * Accepts a string, @lib, and returns
 * the LibreTexts API URL for the current
 * Bookshelves listings in that library.
 */
const generateBookshelvesURL = (lib) => {
    if (lib !== 'espanol') {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/Bookshelves.json`;
    } else {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/home.json`;
    }
};

/**
 * Accepts a string, @lib, and returns
 * the LibreTexts API URL for the current
 * Courses listings in that library.
 */
const generateCoursesURL = (lib) => {
    return `https://api.libretexts.org/DownloadsCenter/${lib}/Courses.json`;
};

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
 * Accepts an array of Books (@books) and
 * a string with the @sortChoice and
 * returns the sorted array.
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
 * Accepts a @book object and checks
 * it has the required fields to be
 * imported. Returns a boolean:
 *  TRUE: if book is ready for import
 *  FALSE: book is missing required
 *         fields (logged)
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


const autoGenerateCollections = (res, programListings, programDetails, nInserted) => {
    return new Promise((resolve, _reject) => {
        var collOps = [];
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
            resolve(Collection.bulkWrite(collOps, {
                ordered: false
            }));
        } else {
            resolve({});
        }
    }).then((collsRes) => {
        var msg = `Imported ${nInserted} books from the Libraries.`;
        if (collsRes.modifiedCount) {
            msg += ` ${collsRes.modifiedCount} auto-generated collections updated.`;
        }
        return res.send({
            err: false,
            msg: msg
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
 * Retrieve prepared books from the
 * LibreTexts API and process &
 * import them to the Conductor
 * database for use in Commons.
 */
const syncWithLibraries = (_req, res) => {
    var shelvesRequests = [];
    var coursesRequests = [];
    var allRequests = [];
    var allBooks = [];
    var commonsBooks = [];
    var bookIDs = [];
    var approvedPrograms = ['openrn', 'openstax' , 'mitocw', 'opensuny', 'oeri'];
    var programDetails = {
        openrn: 'OpenRN',
        openstax: 'OpenStax',
        mitocw: 'MIT OpenCourseWare',
        opensuny: 'OpenSUNY',
        oeri: 'ASCCC OERI'
    };
    var programListings = {};
    if (approvedPrograms && Array.isArray(approvedPrograms) && approvedPrograms.length > 0) {
        approvedPrograms.forEach((program) => {
            if (!Object.keys(programListings).includes(program)) {
                programListings[program] = [];
            }
        });
    }
    // Build list(s) of HTTP requests to be performed
    libraries.forEach((lib) => {
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
            if (checkValidImport(book) && !bookIDs.includes(book.zipFilename)) {
                bookIDs.push(book.zipFilename); // duplicate mitigation
                var link = ''
                var author = '';
                var affiliation = '';
                var license = '';
                var subject = '';
                var course = '';
                var location = '';
                var program = '';
                if (book.link) {
                    link = book.link;
                    if (String(book.link).includes('/Bookshelves/')) {
                        location = 'central';
                        var baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Bookshelves/`;
                        var isolated = String(book.link).replace(baseURL, '');
                        var splitURL = isolated.split('/');
                        if (splitURL.length > 0) {
                            var shelfRaw = splitURL[0];
                            subject = shelfRaw.replace(/_/g, ' ');
                        }
                    }
                    if (String(book.link).includes('/Courses/')) {
                        location = 'campus';
                        var baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Courses/`;
                        var isolated = String(book.link).replace(baseURL, '');
                        var splitURL = isolated.split('/');
                        if (splitURL.length > 0) {
                            var courseRaw = splitURL[0];
                            course = courseRaw.replace(/_/g, ' ');
                        }
                    }
                }
                if (book.author) author = book.author;
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
                var newCommonsBook = {
                    bookID: book.zipFilename,
                    title: book.title,
                    author: author,
                    affiliation: affiliation,
                    library: extractLibFromID(book.zipFilename),
                    subject: subject, // TODO: Improve algorithm
                    location: location,
                    course: course, // TODO: Improve algorithm
                    program: program,
                    license: license,
                    thumbnail: genThumbnailLink(extractLibFromID(book.zipFilename), book.id),
                    links: {
                        online: link,
                        pdf: genPDFLink(book.zipFilename),
                        buy: genBookstoreLink(book.zipFilename),
                        zip: genZIPLink(book.zipFilename),
                        files: genPubFilesLink(book.zipFilename),
                        lms: genLMSFileLink(book.zipFilename)
                    }
                };
                commonsBooks.push(newCommonsBook);
            }
        });
        // Clear the current list of Books
        return Book.deleteMany({});
    }).then((deleteRes) => {
        if (deleteRes.ok === 1) {
            // Import books, ignore failures
            return Book.insertMany(commonsBooks, {
                ordered: false,
                rawResult: true
            });
        } else {
            throw(new Error('delete'));
        }
    }).then((insertedDocs) => {
        // All imports succeeded, continue to auto-generate Program Collections
        return autoGenerateCollections(res, programListings, programDetails, insertedDocs.result.n);
    }).catch((err) => {
        debugError(err);
        if (err.result) { // insertMany error(s)
            if (err.result.nInserted > 0) { // Some imports failed (silent)
                debugCommonsSync(`Inserted only ${err.result.nInserted} books when ${commonsBooks.length} books were expected.`);
                // Continue to auto-generate Program Collections
                return autoGenerateCollections(res, programListings, programDetails, err.result.nInserted);
            } else { // All imports failed
                return res.send({
                    err: true,
                    msg: conductorErrors.err13
                });
            }
        } else if (err.code && err.code === 'ENOTFOUND') { // issues connecting to LT API
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


const buildOrganizationNamesList = (orgData) => {
    if (orgData) {
        var campusNames = []; // stores all variations of the organization name
        var normNames = []; // temporarily stores the normalized variations
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
            var normed = String(name).replaceAll(',', '').replaceAll('-', '').replaceAll(':', '');
            if (!normNames.includes(normed) && !campusNames.includes(normed)) {
                normNames.push(normed);
            }
        });
        if (normNames.length > 0) {
            campusNames = campusNames.concat(normNames);
        }
        return campusNames;
    } else {
        return [];
    }
}

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
        console.log("ORGDATA: ", orgData.toString());
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
                $search: req.query.search
            }
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
                }]
            } else {
                matchObj.course = {
                    $in: campusNames
                };
            }
        }
        debugObject(matchObj);
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
        console.log(err);
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
        if (Object.keys(customCatalogRes).length > 0) {
            if (customCatalogRes.resources && Array.isArray(customCatalogRes.resources)) {
                sortedBooks.forEach((book) => {
                    if (customCatalogRes.resources.includes(book.bookID)) {
                        book.isCustomEnabled = true;
                    }
                    console.log(book);
                });
            }
        }
        // Check if book originated from the Organization
        if (Object.keys(orgData).length > 0) {
            var campusNames = buildOrganizationNamesList(orgData);
            sortedBooks.forEach((book) => {
                if (book.course && !isEmptyString(book.course)) {
                    var isCampusBook = campusNames.some((item) => {
                        return (String(book.course).includes(item) || String(book.course) === item);
                    });
                    if (isCampusBook) book.isCampusBook = true;
                }
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
            }];
        } else if (process.env.ORG_ID !== 'libretexts') {
            matchObj.course = {
                $in: campusNames
            }
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
                    course: 1
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
        });
        authors.sort(normalizedSort);
        subjects.sort(normalizedSort);
        affiliations.sort(normalizedSort);
        courses.sort(normalizedSort);
        return res.send({
            err: false,
            authors: authors,
            subjects: subjects,
            affiliations: affiliations,
            courses: courses
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
 * Returns the Book object given a book ID.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getBookDetail'
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
        if ((catalogRes.n === 1) && (catalogRes.ok === 1)) {
            return res.send({
                err: false,
                msg: "Resource successfully added to Catalog."
            });
        } else if (catalogRes.n === 0) {
            throw(new Error('notfound'));
        } else {
            throw(new Error('updatefailed'));
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
        if ((catalogRes.n === 1) && (catalogRes.ok === 1)) {
            return res.send({
                err: false,
                msg: "Resource successfully removed from Catalog."
            });
        } else if (catalogRes.n === 0) {
            throw(new Error('notfound'));
        } else {
            throw(new Error('updatefailed'));
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
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
    switch (method) {
        case 'getCommonsCatalog':
            return [
                query('sort', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidSort),
                query('library', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLibrary),
                query('subject', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1}),
                query('author', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
                query('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
                query('affiliation', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
                query('course', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
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
        case 'addBookToCustomCatalog':
            return [
                body('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
        case 'removeBookFromCustomCatalog':
            return [
                body('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
    }
};

module.exports = {
    syncWithLibraries,
    getCommonsCatalog,
    getMasterCatalog,
    getBookDetail,
    getCatalogFilterOptions,
    addBookToCustomCatalog,
    removeBookFromCustomCatalog,
    validate
};
