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
    genThumbnailLink,
    genPDFLink,
    genBookstoreLink,
    genZIPLink,
    genPubFilesLink,
    genLMSFileLink,
} = require('../util/bookutils.js');


const generateBookshelvesURL = (lib) => {
    if (lib !== 'espanol') {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/Bookshelves.json`;
    } else {
        return `https://api.libretexts.org/DownloadsCenter/${lib}/home.json`;
    }
};

const generateCoursesURL = (lib) => {
    return `https://api.libretexts.org/DownloadsCenter/${lib}/Courses.json`;
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
                if (book.link) {
                    link = book.link;
                    if (String(book.link).includes('/Bookshelves/')) {
                        var baseURL = `https://${extractLibFromID(book.zipFilename)}.libretexts.org/Bookshelves/`;
                        var isolated = String(book.link).replace(baseURL, '');
                        var splitURL = isolated.split('/');
                        if (splitURL.length == 2) {
                            var shelfRaw = splitURL[0];
                            subject = shelfRaw.replace(/_/g, ' ');
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
                    subject: subject, // TODO: Improve algorithm,
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

const getCommonsBooks = (_req, res) => {
    Book.aggregate([
        {
            $match: {

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
        books.forEach((b) => {
            if (b.links) {
                if (b.links.online) {

                }
            }
        })
        return res.send({
            err: false,
            books: books
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
        case 'getBookDetail':
            return [
                query('bookID', conductorErrors.err1).exists().custom(checkBookIDFormat)
            ]
    }
};

module.exports = {
    syncWithLibraries,
    getCommonsBooks,
    getBookDetail,
    validate
};
