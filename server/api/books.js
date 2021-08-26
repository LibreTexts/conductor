//
// LibreTexts Conductor
// collections.js
//

'use strict';
const Book = require('../models/collection.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError } = require('../debug.js');
const b62 = require('base62-random');
const axios = require('axios');
const {
    libraries,
    extractLibFromID
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
}


const syncWithLibraries = (req, res) => {
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
        // Process books
        allBooks.forEach((book) => {
            var newCommonsBook = {
                bookID: book.zipFilename,
                title: book.title,
                library: extractLibFromID(book.zipFilename),
                link: book.link
            };
            if (book.author) newCommonsBook.author = book.author;
            if (book.institution) newCommonsBook.institution = book.institution;
            if (book.tags && Array.isArray(book.tags)) {
                var licToSet = "";
                book.tags.forEach((tag) => {
                    if (tag.includes('license:')) {
                        licToSet = tag.replace('license:', '');
                    }
                });
                if (!isEmptyString(licToSet)) {
                    newCommonsBook.license = licToSet;
                }
            }
            commonsBooks.push(newCommonsBook);
        });
        console.log(commonsBooks);
        return res.status(200);
    }).catch((booksErr) => {
        console.log(booksErr);
        return res.status(200);
    });
};

/**
 * Sets up the validation chain(s) for methods in this file.
 */
/*
const validate = (method) => {
    switch (method) {
    }
};
*/

module.exports = {
    syncWithLibraries
};
