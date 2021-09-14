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

const createProject = (req, res) => {
    var newProject = new Project({
        ...req.body,
        orgID: req.user.org,
        projectID: b62(10),
        status: 'available',
        currentProgress: 0,
        assignees: [],
        createdBy: req.decoded.uuid
    });
    newProject.save.then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "New project created.",
                id: newDoc.projectID
            });
        } else {
            return res.send(500).send({
                err: true,
                errMsg: conductorErrors.err3
            });
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
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
        case 'create':
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
