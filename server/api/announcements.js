//
// LibreTexts Conductor
// announcements.js
//

'use strict';
const Announcement = require('../models/announcement.js');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');
const authAPI = require('./auth.js');
const { body, query } = require('express-validator');

/**
 * Checks that a user has the property authority
 * to post either a campus-wide or global
 * announcement, then creates and saves a new
 * Announcement model with the data in the
 * request body.
 */
const postAnnouncement = (req, res) => {
    var hasProperRole = false;
    if (req.body.global !== true) {
        hasProperRole = authAPI.checkHasRole(req.user, process.env.ORG_ID, 'campusadmin');
    } else {
        hasProperRole = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
    }
    if (hasProperRole) {
        var targetOrg = '';
        if (req.body.global !== true) {
            targetOrg = process.env.ORG_ID;
        } else {
            targetOrg = 'global';
        }
        var newAnnouncement = new Announcement({
            author: req.user.decoded.uuid,
            title: req.body.title,
            message: req.body.message,
            org: targetOrg
        });
        newAnnouncement.save().then((newDoc) => {
            if (newDoc) {
                return res.send({
                    err: false,
                    msg: "Announcement successfully posted."
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
    } else {
        return res.status(401).send({
            err: true,
            errMsg: conductorErrors.err8
        });
    }
};

/**
 * Returns the 50 most recent Announcements
 * from either the global pool or from the user's
 * organization(s)
 */
const getAllAnnouncements = (_req, res) => {
    const orgs = [process.env.ORG_ID, 'global'];
    Announcement.aggregate([
        {
            $match: {
                org: {
                    $in: orgs
                }
            }
        }, {
            $sort: {
                createdAt: -1
            }
        }, {
            $limit: 50
        }, {
            $project: {
                _id: 0,
                __v: 0,
                updatedAt: 0
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    author: '$author'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$uuid', '$$author']
                            }
                        }
                    }, {
                        $limit: 1
                    }, {
                        $project: {
                            _id: 0,
                            uuid: 1,
                            firstName: 1,
                            lastName: 1,
                            avatar: 1
                        }
                    }
                ],
                as: 'authorInfo'
            }
        }, {
            $addFields: {
                authorInfo: {
                    $arrayElemAt: ['$authorInfo', 0]
                }
            }
        }
    ]).then((results) => {
        if (results.length > 0) {
            results.forEach((announcement) => {
                if (announcement.authorInfo) {
                    announcement.author = announcement.authorInfo;
                    delete announcement.authorInfo;
                } else {
                    announcement.author = {
                        uuid: "",
                        firstName: "Unknown",
                        lastName: "User",
                    }
                }
            });
        }
        return res.send({
            err: false,
            announcements: results
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
 * Returns the most recent Announcement
 * from either the global pool or from the user's
 * organization(s)
 */
const getRecentAnnouncement = (_req, res) => {
    const orgs = [process.env.ORG_ID, 'global'];
    Announcement.aggregate([
        {
            $match: {
                org: {
                    $in: orgs
                }
            }
        }, {
            $sort: {
                createdAt: -1
            }
        }, {
            $limit: 1
        }, {
            $project: {
                _id: 0,
                __v: 0,
                updatedAt: 0
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    author: '$author'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$uuid', '$$author']
                            }
                        }
                    }, {
                        $limit: 1
                    }, {
                        $project: {
                            _id: 0,
                            uuid: 1,
                            firstName: 1,
                            lastName: 1,
                            avatar: 1
                        }
                    }
                ],
                as: 'authorInfo'
            }
        }, {
            $addFields: {
                authorInfo: {
                    $arrayElemAt: ['$authorInfo', 0]
                }
            }
        }
    ]).then((results) => {
        var announcement = null;
        if (results.length > 0) {
            announcement = results[0];
            if (announcement.authorInfo) {
                announcement.author = announcement.authorInfo;
                delete announcement.authorInfo;
            } else {
                announcement.author = {
                    uuid: "",
                    firstName: "Unknown",
                    lastName: "User",
                }
            }
        }
        return res.send({
            err: false,
            announcement: announcement
        });
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
}

/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
    switch (method) {
        case 'postAnnouncement':
            return [
                body('title', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('message', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('global', conductorErrors.err1).exists().isBoolean().toBoolean()
            ]
    }
};


module.exports = {
    postAnnouncement,
    getAllAnnouncements,
    getRecentAnnouncement,
    validate
};
