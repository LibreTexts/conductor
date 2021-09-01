//
// LibreTexts Conductor
// collections.js
//

'use strict';
const Book = require('../models/book.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError, debugCommonsSync } = require('../debug.js');
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
        validationFails.push('ID');
    }
    if (!isValidImport && validationFails.length > 0) {
        var debugString = "Not importing 1 book — missing fields: " + validationFails.join(',');
        debugCommonsSync(debugString);
    }
    return isValidImport;
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
            if (checkValidImport(book)) {
                var link = ''
                var author = '';
                var institution = '';
                var license = '';
                var subject = '';
                var course = '';
                if (book.link) {
                    link = book.link;
                    if (String(book.link).includes('/Bookshelves/')) {
                        var baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Bookshelves/`;
                        var isolated = String(book.link).replace(baseURL, '');
                        var splitURL = isolated.split('/');
                        if (splitURL.length > 0) {
                            var shelfRaw = splitURL[0];
                            subject = shelfRaw.replace(/_/g, ' ');
                        }
                    }
                    if (String(book.link).includes('/Courses/')) {
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
                if (book.institution) institution = book.institution;
                if (book.tags && Array.isArray(book.tags)) {
                    var foundLic = book.tags.find((tag) => {
                        if (tag.includes('license:')) {
                            return tag;
                        }
                    });
                    if (foundLic !== undefined) {
                        license = foundLic.replace('license:', '');
                    }
                }
                var newCommonsBook = {
                    bookID: book.zipFilename,
                    title: book.title,
                    author: author,
                    library: extractLibFromID(book.zipFilename),
                    subject: subject, // TODO: Improve algorithm
                    course: course, // TODO: Improve algorithm
                    license: license,
                    thumbnail: genThumbnailLink(extractLibFromID(book.zipFilename), book.id),
                    links: {
                        online: link,
                        pdf: genPDFLink(book.zipFilename),
                        buy: genBookstoreLink(book.zipFilename),
                        zip: genZIPLink(book.zipFilename),
                        files: genPubFilesLink(book.zipFilename),
                        lms: genLMSFileLink(book.zipFilename)
                    },
                    institution: institution
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
                ordered: false
            });
        } else {
            throw(new Error('delete'));
        }
    }).then((insertedDocs) => {
        // All imports succeeded
        if (insertedDocs.length === commonsBooks.length) {
            return res.send({
                err: false,
                msg: "Succesfully synced Commons with Libraries."
            });
        } else { // Some imports failed (silent)
            debugCommonsSync(`Inserted only ${insertedDocs.length} books when ${commonsBooks.length} books were expected.`);
            return res.send({
                err: false,
                msg: `Imported ${insertedDocs.length} books from the Libraries.`
            });
        }
    }).catch((err) => {
        if (err.result) { // insertMany error(s)
            if (err.result.nInserted > 0) { // Some imports failed (silent)
                debugCommonsSync(`Inserted only ${err.result.nInserted} books when ${commonsBooks.length} books were expected.`);
                return res.send({
                    err: false,
                    msg: `Imported ${err.result.nInserted} books from the Libraries.`
                });
            } else { // All imports failed
                return res.send({
                    err: true,
                    msg: conductorErrors.err13
                });
            }
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
 * Returns the Commons Catalog results according
 * to the requested filters and sort option.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getCommonsCatalog'
 */
const getCommonsCatalog = (req, res) => {
    var sortChoice = 'title'; // default to Sort by Title
    const matchObj = {};
    var hasSearchParams = false;
    if (req.query.library && !isEmptyString(req.query.library)) {
        matchObj.library = req.query.library;
        hasSearchParams = true;
    }
    if (req.query.subject && !isEmptyString(req.query.subject)) {
        matchObj.subject = req.query.subject;
        hasSearchParams = true;
    }
    if (req.query.author && !isEmptyString(req.query.author)) {
        matchObj.author = req.query.author;
        hasSearchParams = true;
    }
    if (req.query.license && !isEmptyString(req.query.license)) {
        matchObj.license = req.query.license;
        hasSearchParams = true;
    }
    if (req.query.institution && !isEmptyString(req.query.institution)) {
        matchObj.institution = req.query.institution;
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
    if (!hasSearchParams) { // Remove Campus/Course texts on default search
        matchObj.course = {
            $in: ['', null, false]
        };
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
 * Returns the current options for dynamic
 * filters in Commons Catalog(s).
 */
const getCatalogFilterOptions = (_req, res) => {
    var authors = [];
    var subjects = [];
    var institutions = [];
    var courses = [];
    Book.aggregate([
        {
            $match: {}
        }, {
            $project: {
                _id: 0,
                author: 1,
                subject: 1,
                institution: 1,
                course: 1
            }
        }
    ]).then((books) => {
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
            if (book.institution && !isEmptyString(book.institution)) {
                if (!institutions.includes(book.institution)) {
                    institutions.push(book.institution);
                }
            }
            if (book.course && !isEmptyString(book.course)) {
                if (!courses.includes(book.course)) {
                    courses.push(book.course);
                }
            }
        });
        authors.sort((a, b) => {
            var normalizedA = String(a).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            var normalizedB = String(b).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            if (normalizedA < normalizedB) {
                return -1;
            }
            if (normalizedA > normalizedB) {
                return 1;
            }
            return 0;
        });
        subjects.sort((a, b) => {
            var normalizedA = String(a).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            var normalizedB = String(b).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            if (normalizedA < normalizedB) {
                return -1;
            }
            if (normalizedA > normalizedB) {
                return 1;
            }
            return 0;
        });
        institutions.sort((a, b) => {
            var normalizedA = String(a).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            var normalizedB = String(b).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            if (normalizedA < normalizedB) {
                return -1;
            }
            if (normalizedA > normalizedB) {
                return 1;
            }
            return 0;
        });
        courses.sort((a, b) => {
            var normalizedA = String(a).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            var normalizedB = String(b).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            if (normalizedA < normalizedB) {
                return -1;
            }
            if (normalizedA > normalizedB) {
                return 1;
            }
            return 0;
        });
        return res.send({
            err: false,
            authors: authors,
            subjects: subjects,
            institutions: institutions,
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
                query('institution', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1 }),
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
    }
};

module.exports = {
    syncWithLibraries,
    getCommonsCatalog,
    getMasterCatalog,
    getBookDetail,
    getCatalogFilterOptions,
    validate
};
