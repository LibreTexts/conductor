//
// LibreTexts Conductor
// directory.js
//

'use strict';
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError } = require('../debug.js');
const b62 = require('base62-random');

const LibrariesMap = require('../util/librariesmap.js');

const getDirectory = (_req, res) => {
    return res.send({
        err: false,
        directory: LibrariesMap
    });
};


const getMainLibraries = (_req, res) => {
    var libs = [];
    LibrariesMap.forEach((item) => {
        libs.push({
            key: item.key,
            name: item.name
        });
    });
    return res.send({
        err: false,
        libs: libs
    });
};


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
 * Sets up the validation chain(s) for methods in this file.
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
    getDirectory,
    getMainLibraries,
    getLibraryShelves,
    validate
};
