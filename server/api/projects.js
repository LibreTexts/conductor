//
// LibreTexts Conductor
// projects.js
//

'use strict';
const User = require('../models/user.js');

const HarvestingProject = require('../models/harvestingproject.js');

const Project = require('../models/project.js');
const { body, validationResult } = require('express-validator');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');


/**
 * Creates a new Project within
 * the current Organization using
 * the values specified in the
 * request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'createProject'
 */
const createProject = (req, res) => {
    var newProjData = {
        ...req.body,
        orgID: process.env.ORG_ID,
        projectID: b62(10),
        collaborators: [],
        createdBy: req.decoded.uuid
    };
    if (!newProjData.hasOwnProperty('currentProgress')) newProjData.currentProgress = 0;
    if (!newProjData.hasOwnProperty('status')) newProjData.status = 'data';
    var newProject = new Project(newProjData);
    newProject.save().then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "New project created.",
                id: newDoc.projectID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        if (err.message === 'createfail') {
            return res.send({
                err: true,
                errMsg: conductorErrors.err3
            });
        } else {
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};

/* TODO: Outmoded */
const getAllUserProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        HarvestingProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: {
                        $in: ['ready', 'ip']
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    projectID: 1,
                    title: 1,
                    updatedAt: 1
                }
            }, {
                $lookup: {
                    from: 'harvestingprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                createdAt: 1
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((harvestResults) => {
            if (harvestResults.length > 0) {
                harvestResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
            }
            response.err = false;
            response.harvesting = harvestResults;
            return res.send(response);
        }).catch((err) => {
            console.log(err);
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

/* TODO: Outmoded */
const getRecentUserProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        var harvestingProject;
        HarvestingProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: {
                        $in: ['ready', 'ip']
                    }
                }
            }, {
                $limit: 1
            },
            {
                $project: {
                    _id: 0,
                    projectID: 1,
                    title: 1,
                    updatedAt: 1
                }
            }, {
                $lookup: {
                    from: 'harvestingprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                createdAt: 1
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((harvestResults) => {
            if (harvestResults.length > 0) {
                const recentHarvesting = harvestResults[0];
                if (recentHarvesting.lastUpdate === undefined) {
                    const lastUpdate = {
                        createdAt: recentHarvesting.updatedAt
                    };
                    recentHarvesting.lastUpdate = lastUpdate;
                }
                harvestingProject = recentHarvesting;
            }
            response.err = false;
            if (harvestingProject !== undefined) {
                response.harvesting = harvestingProject;
            }
            return res.send(response);
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const validate = (method) => {
    switch (method) {
        case 'createProject':
            return [
                body('title', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('tags').optional({ checkFalsy: true }).isArray()
            ]
    }
};

module.exports = {
    createProject,
    getAllUserProjects,
    getRecentUserProjects,
    validate
};
