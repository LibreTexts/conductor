//
// LibreTexts Conductor
// collections.js
//

'use strict';
const Collection = require('../models/collection.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError } = require('../debug.js');
const b62 = require('base62-random');

/**
 * Creates and saves a new Collection with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'createCollection'
 */
const createCollection = (req, res) => {
    var collectionData = {
        orgID: process.env.ORG_ID,
        colID: b62(10),
        title: req.body.title,
    };
    if ((req.body.coverPhoto !== undefined) && (req.body.coverPhoto !== null) && (!isEmptyString(req.body.coverPhoto))) {
        collectionData.coverPhoto = req.body.coverPhoto;
    }
    var newCollection = new Collection(collectionData);
    newCollection.save().then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "Collection successfully created.",
                colID: newDoc.colID
            });
        } else {
            throw(conductorErrors.err3);
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Deletes the Collection identified by
 * the colID in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteCollection'
 */
const deleteCollection = (req, res) => {
    Collection.deleteOne({ colID: req.body.colID }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: "Collection successfully deleted.",
            });
        } else {
            throw(conductorErrors.err3);
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    })
};

/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
    switch (method) {
        case 'createCollection':
            return [
                body('title', conductorErrors.err1).exists().isLength({ min: 3 }),
                body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isURL()
            ]
        case 'deleteCollection':
            return [
                body('colID', conductorErrors.err1).exists().isLength({ min: 8, max: 8})
            ]
    }
};

module.exports = {
    createCollection,
    deleteCollection,
    validate
};
