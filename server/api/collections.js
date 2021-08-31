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
        collID: b62(8),
        title: req.body.title,
        enabled: true
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
                collID: newDoc.collID
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
 * Updates the Collection identified
 * by the colID in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'editCollection'
 */
const editCollection = (req, res) => {
    var updateData = {};
    if (req.body.title) {
        updateData.title = req.body.title;
    }
    if (req.body.coverPhoto) {
        updateData.coverPhoto = req.body.coverPhoto;
    }
    Collection.findOneAndUpdate({ collID: req.body.collID }, updateData).then((updatedDoc) => {
        if (updatedDoc) {
            return res.send({
                err: false,
                msg: "Collection successfully updated."
            });
        } else {
            throw(new Error('updatefailed'));
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
    Collection.deleteOne({ collID: req.body.collID }).then((deleteRes) => {
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
 * Toggles the 'enabled' boolean of the
 * Collection identified by the colID
 * in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'toggleCollectionStatus'
 */
const toggleCollectionStatus = (req, res) => {
    Collection.findOne({ collID: req.body.collID }).then((coll) => {
        if (coll) {
            return Collection.updateOne({ collID: req.body.collID }, {
                enabled: !coll.enabled
            });
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.nModified === 1) {
            return res.send({
                err: false,
                msg: "Collection status successfully modified."
            });
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
}

/**
 * Returns all collections for the
 * organization handled by the
 * current server instance.
 * Requests are safe to be anonymous/
 * public.
 */
const getCollections = (_req, res) => {
    Collection.aggregate([
        {
            $match: {
                orgID: process.env.ORG_ID
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: {
                _id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }, {
            $project: {
                orgID: 1,
                collID: 1,
                title: 1,
                coverPhoto: 1,
                enabled: 1,
                resources: {
                    $size: "$resources"
                }
            }
        }
    ]).then((colls) => {
        return res.send({
            err: false,
            colls: colls
        });
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Returns all books for the
 * collection specified by
 * the @collID parameter.
 * Requests are safe to be anonymous/
 * public.
 */
const getCollection = (req, res) => {
    Collection.aggregate([
        {
            $match: {
                collID: req.query.collID
            }
        }, {
            $lookup: {
                from: 'books',
                let: { book_id: "$resources" },
                pipeline: [
                    {
                        $match: {
                            bookID: '$$book_id'
                        }
                    }
                ]
            }
        }
    ]).then((books) => {
        console.log(books);
        return res.send({
            err: false,
            books: books
        });
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
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
        case 'createCollection':
            return [
                body('title', conductorErrors.err1).exists().isLength({ min: 3 }),
                body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isURL()
            ]
        case 'editCollection':
            return [
                body('collID', conductorErrors.err1).exists().isLength({ min: 8, max: 8 }),
                body('title', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 3 }),
                body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isURL()
            ]
        case 'deleteCollection':
            return [
                body('collID', conductorErrors.err1).exists().isLength({ min: 8, max: 8})
            ]
        case 'toggleCollectionStatus':
            return [
                body('collID', conductorErrors.err1).exists().isLength({ min: 8, max: 8})
            ]
        case 'getCollection':
            return [
                query('collID', conductorErrors.err1).exists().isLength({ min: 8, max: 8})
            ]
    }
};

module.exports = {
    createCollection,
    editCollection,
    deleteCollection,
    toggleCollectionStatus,
    getCollections,
    getCollection,
    validate
};
