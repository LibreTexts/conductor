//
// LibreTexts Conductor
// libraries.js
//

'use strict';
const { query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');

const LibrariesMap = require('../util/librariesmap.js').default;

/**
 * Returns the full map of Libraries.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getLibraries = (_req, res) => {
    return res.send({
        err: false,
        libraries: LibrariesMap
    });
};

/**
 * Returns basic information about the Libraries.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getMainLibraries = (_req, res) => {
    var libs = [];
    LibrariesMap.forEach((item) => {
        libs.push({
            key: item.key,
            name: item.name,
            thumbnail: item.thumbnail
        });
    });
    return res.send({
        err: false,
        libs: libs
    });
};

/**
 * Returns a listing of the bookshelves for a specified Library.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getLibraryShelves = (req, res) => {
    const foundLib = LibrariesMap.find((item) => {
        if (item.key === req.query.libname || item.name === req.query.libname) {
            return item;
        }
        return null;
    });
    if (foundLib !== undefined) {
        return res.send({
            err: false,
            lib: foundLib.key,
            libName: foundLib.name,
            libLink: foundLib.link,
            shelves: foundLib.shelves
        });
    } else {
        return res.send({
            err: true,
            errMsg: conductorErrors.err11
        });
    }
};


/**
 * Defines the validation chains for methods/routes in this file.
 * @param {String} method - the method name to validate for.
 * @returns {Boolean} true if the validation checks passed, false otherwise.
 */
const validate = (method) => {
    switch (method) {
        case 'getLibraryShelves':
            return [
                query('libname', conductorErrors.err1).exists().isString().isLength({ min: 3 })
            ]
    }
};

module.exports = {
    getLibraries,
    getMainLibraries,
    getLibraryShelves,
    validate
};
