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
 * Checks that a user has the property authority to post either a campus-wide or global
 * announcement, then creates and saves a new Announcement model with the data in the
 * request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'postAnnouncement'
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
 * Checks that a user has the property authority to post delete an announcement
 * identified by the ID in the request body, then deletes the Announcement from
 * the database.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteAnnouncement'
 */
const deleteAnnouncement = (req, res) => {
    Announcement.findOne({
        _id: req.body.announcementID
    }).then((announcement) => {
        var hasProperRole = false;
        if (req.user?.decoded?.uuid === announcement.author) {
            hasProperRole = true;
        } else {
            hasProperRole = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
        }
        if (hasProperRole) {
            return Announcement.deleteOne({
                _id: req.body.announcementID
            });
        } else {
            throw(new Error('unauth'));
        }
    }).then((deleteRes) => {
        if (deleteRes.deletedCount == 1) {
            return res.send({
                err: false,
                msg: 'Announcement succesfully deleted.'
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
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
                        $project: {
                            _id: 0,
                            uuid: 1,
                            firstName: 1,
                            lastName: 1,
                            avatar: 1
                        }
                    }
                ],
                as: 'author'
            }
        }, {
            $lookup: {
                from: 'organizations',
                let: {
                    org: '$org'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$orgID', '$$org']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            orgID: 1,
                            name: 1,
                            shortName: 1,
                            abbreviation: 1
                        }
                    }
                ],
                as: 'orgInfo'
            }
        }, {
            $addFields: {
                author: {
                    $arrayElemAt: ['$author', 0]
                },
            }
        }
    ]).then((announcements) => {
        if (announcements.length > 0) {
            announcements = announcements.map((announcement) => {
                if (!announcement.hasOwnProperty('author') || !announcement.author.hasOwnProperty('uuid')) {
                    announcement.author = {
                        uuid: "",
                        firstName: "Unknown",
                        lastName: "User",
                    };
                }
                if (announcement.hasOwnProperty('orgInfo') && Array.isArray(announcement.orgInfo)
                    && announcement.orgInfo.length > 0) {
                    // replace orgID with info
                    announcement.org = announcement.orgInfo[0];
                }
                if (announcement.org === 'global') {
                    // pseudo-org info
                    announcement.org = {
                        name: 'global',
                        shortName: 'global'
                    };
                }
                delete announcement.orgInfo; // prune lookup
                return announcement;
            });
        }
        return res.send({
            err: false,
            announcements: announcements
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
                as: 'author'
            }
        }, {
            $lookup: {
                from: 'organizations',
                let: {
                    org: '$org'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$orgID', '$$org']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            orgID: 1,
                            name: 1,
                            shortName: 1,
                            abbreviation: 1
                        }
                    }
                ],
                as: 'org'
            }
        }, {
            $addFields: {
                author: {
                    $arrayElemAt: ['$author', 0]
                },
                org: {
                    $arrayElemAt: ['$org', 0]
                }
            }
        }
    ]).then((results) => {
        var announcement = null;
        if (results.length > 0) {
            announcement = results[0];
            if (!announcement.hasOwnProperty('author') || !announcement.author.hasOwnProperty('uuid')) {
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
        case 'deleteAnnouncement':
            return [
                body('announcementID', conductorErrors.err1).exists().isString().isMongoId()
            ]
    }
};


module.exports = {
    postAnnouncement,
    deleteAnnouncement,
    getAllAnnouncements,
    getRecentAnnouncement,
    validate
};
