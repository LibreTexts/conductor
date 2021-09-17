//
// LibreTexts Conductor
// projects.js
//

'use strict';
const User = require('../models/user.js');

const HarvestingProject = require('../models/harvestingproject.js');

const Project = require('../models/project.js');
const Tag = require('../models/tag.js');
const { body, query } = require('express-validator');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const { isValidLicense } = require('../util/bookutils.js');

const mailAPI = require('./mail.js');


/**
 * Creates a new Project within the current Organization using the values specified in the
 * request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createProject'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createProject = (req, res) => {
    var hasTags = false;
    // Setup project with defaults
    var newProjData = {
        orgID: process.env.ORG_ID,
        projectID: b62(10),
        title: req.body.title,
        status: 'open',
        visibility: 'private',
        currentProgress: 0,
        author: '',
        license: '',
        resourceURL: '',
        projectURL: '',
        collaborators: [],
        tags: [],
        notes: '',
        owner: req.decoded.uuid,
        flaggedUser: ''
    };
    // Apply user values if present
    if (req.body.hasOwnProperty('visibility')) newProjData.visibility = req.body.visibility;
    if (req.body.hasOwnProperty('status')) newProjData.status = req.body.status;
    if (req.body.hasOwnProperty('progress')) newProjData.currentProgress = req.body.progress;
    if (req.body.hasOwnProperty('projectURL')) newProjData.projectURL = req.body.projectURL;
    if (req.body.hasOwnProperty('author')) newProjData.author = req.body.author;
    if (req.body.hasOwnProperty('license')) newProjData.license = req.body.license;
    if (req.body.hasOwnProperty('resourceURL')) newProjData.resourceURL = req.body.resourceURL;
    if (req.body.hasOwnProperty('notes')) newProjData.notes = req.body.notes;
    new Promise((resolve, _reject) => {
        // lookup all organization tags if new project has tags
        if (req.body.hasOwnProperty('tags')) {
            hasTags = true;
            resolve(Tag.aggregate([
                {
                    $match: {
                        $and: [
                            { orgID: process.env.ORG_ID },
                            { title: { $in: req.body.tags } }
                        ]
                    }
                }
            ]));
        } else {
            // no tags specified, no need to resolve them
            resolve([]);
        }
    }).then((allOrgTags) => {
        var tagBulkOps = [];
        var projTagIDs = [];
        if (hasTags) {
            // build new array of existing tagIDs,
            // otherwise generate a new tagID and prepare to insert in DB
            req.body.tags.forEach((tagItem) => {
                var foundTag = allOrgTags.find((orgTag) => {
                    return orgTag.title === tagItem;
                });
                if (foundTag !== undefined) {
                    projTagIDs.push(foundTag.tagID);
                } else {
                    var newID = b62(12);
                    tagBulkOps.push({
                        insertOne: {
                            document: {
                                orgID: process.env.ORG_ID,
                                tagID: newID,
                                title: tagItem
                            }
                        }
                    });
                    projTagIDs.push(newID);
                }
            });
            // set project tags with resolved array
            newProjData.tags = projTagIDs;
            if (tagBulkOps.length > 0) {
                // insert new tags
                return Tag.bulkWrite(tagBulkOps, {
                    ordered: false
                });
            }
        }
        // no new tags to insert
        return {};
    }).then((_bulkRes) => {
        // save formatted project to DB
        var newProject = new Project(newProjData);
        return newProject.save();
    }).then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: 'New project created.',
                projectID: newDoc.projectID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'createfail') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteProject'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteProject = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner)) {
                return Project.deleteOne({
                    projectID: req.body.projectID
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully deleted project.'
            });
        } else {
            throw(new Error('deletefail')); // handle as generic error below
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves information about the Project identified by the projectID in
 * the request query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProject'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getProject = (req, res) => {
    Project.aggregate([
        {
            $match: {
                projectID: req.query.projectID
            }
        }, {
            $lookup: {
                from: 'tags',
                let: {
                    projTags: '$tags'
                },
                pipeline: [
                    {
                        $match: {
                            $and: [
                                {
                                    $expr: {
                                        $in: ['$tagID', '$$projTags']
                                    }
                                },
                                {
                                    $expr: {
                                        $eq: ['$orgID', process.env.ORG_ID]
                                    }
                                }
                            ]
                        }
                    }, {
                        $project: {
                            _id: 0,
                            title: 1
                        }
                    }
                ],
                as: 'tagResults'
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    collabs: '$collaborators'
                },
                pipeline: [
                    {
                        $match: {
                            $and: [
                                {
                                    $expr: {
                                        $in: ['$uuid', '$$collabs']
                                    }
                                }
                            ]
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
                as: 'collaborators'
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    owner: '$owner'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$uuid', '$$owner']
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
                as: 'owner'
            }
        }, {
            $project: {
                _id: 0,
                __v: 0
            }
        }, {
            $set: {
                owner: {
                    $arrayElemAt: ['$owner', 0]
                }
            }
        }
    ]).then((projects) => {
        if (projects.length > 0) {
            var projResult = projects[0];
            projResult.tags = projResult.tagResults.map((tagResult) => {
                return tagResult.title;
            });
            delete projResult.tagResults; // prune lookup results
            // resolve owner's uuid
            var ownerUUID;
            if (typeof(projResult.owner) === 'object') ownerUUID = projResult.owner.uuid;
            else if (typeof(projResult.owner) === 'string') ownerUUID = projResult.owner;
            // check user has permission to view project
            if ((req.decoded.uuid === ownerUUID)
                || (projResult.collaborators.includes(req.decoded.uuid))
                || (projResult.visibility === 'public')) {
                return res.send({
                    err: false,
                    project: projResult
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Updates the visibility setting of the Project identified by the projectID in
 * the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'changeProjectVisibility'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const changeProjectVisibility = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner) || (project.collaborators.includes(req.decoded.uuid))) {
                return Project.updateOne({
                    projectID: req.body.projectID
                }, {
                    visibility: req.body.visibility
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully updated project visibility.'
            });
        } else {
            throw(new Error('updatefailed'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'updatefailed') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Marks the Project identified by the projectID in the request body as
 * completed.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'completeProject'
 * @param  {object} req  - the express.js request object
 * @param  {[object} res - the express.js response object
 */
const completeProject = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner)) {
                return Project.updateOne({
                    projectID: req.body.projectID
                }, {
                    status: 'completed'
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully marked project as completed.'
            });
        } else {
            throw(new Error('updatefail')); // handle as generic error below
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Updates the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProject'
 * @param  {object} req  - the express.js request object
 * @param  {[object} res - the express.js response object
 */
const updateProject = (req, res) => {
    var updateObj = {};
    var checkTags = false;
    var newTagTitles = []; // titles of the project's tags to be returned with the updated document
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner) || (project.collaborators.includes(req.decoded.uuid))) {
                // determine if there are changes to save
                if (req.body.hasOwnProperty('title') && req.body.title !== project.title) {
                    updateObj.title = req.body.title;
                }
                if (req.body.hasOwnProperty('progress') && req.body.progress !== project.currentProgress) {
                    updateObj.currentProgress = req.body.progress;
                }
                if (req.body.hasOwnProperty('projectURL') && req.body.projectURL !== project.projectURL) {
                    updateObj.projectURL = req.body.projectURL;
                }
                if (req.body.hasOwnProperty('author') && req.body.author !== project.author) {
                    updateObj.author = req.body.author;
                }
                if (req.body.hasOwnProperty('license') && req.body.author !== project.license) {
                    updateObj.license = req.body.license;
                }
                if (req.body.hasOwnProperty('resourceURL') && req.body.resourceURL !== project.resourceURL) {
                    updateObj.resourceURL = req.body.resourceURL;
                }
                if (req.body.hasOwnProperty('notes') && req.body.notes !== project.notes) {
                    updateObj.notes = req.body.notes;
                }
                if (req.body.hasOwnProperty('tags') && Array.isArray(req.body.tags)) {
                    checkTags = true;
                }
                if (checkTags) {
                    if (req.body.tags.length > 0) {
                        // need to resolve tags
                        return Tag.aggregate([
                            {
                                $match: {
                                    $and: [
                                        { orgID: process.env.ORG_ID },
                                        { title: { $in: req.body.tags } }
                                    ]
                                }
                            }
                        ])
                    } else {
                        updateObj.tags = []; // tags removed
                    }
                }
                // don't need to modify or resolve tags
                return [];
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((allOrgTags) => {
        var tagBulkOps = [];
        var projTagIDs = [];
        // build new array of existing tagIDs,
        // otherwise generate a new tagID and prepare to insert in DB
        if (checkTags) {
            req.body.tags.forEach((tagItem) => {
                var foundTag = allOrgTags.find((orgTag) => {
                    return orgTag.title === tagItem;
                });
                if (foundTag !== undefined) {
                    projTagIDs.push(foundTag.tagID);
                    newTagTitles.push(foundTag.title);
                } else {
                    var newID = b62(12);
                    tagBulkOps.push({
                        insertOne: {
                            document: {
                                orgID: process.env.ORG_ID,
                                tagID: newID,
                                title: tagItem
                            }
                        }
                    });
                    projTagIDs.push(newID);
                    newTagTitles.push(tagItem);
                }
            });
            if (projTagIDs.length > 0) {
                // set project tags with resolved array
                updateObj.tags = projTagIDs;
                if (tagBulkOps.length > 0) {
                    // insert new tags
                    return Tag.bulkWrite(tagBulkOps, {
                        ordered: false
                    });
                }
            }
        }
        // no new tags to insert
        return {};
    }).then((_bulkRes) => {
        return Project.updateOne({
            projectID: req.body.projectID
        }, updateObj);
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully updated project.'
            });
        } else {
            throw(new Error('updatefailed'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves a list of the requesting User's currently open projects.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getUserProjects = (req, res) => {
    Project.aggregate([
        {
            $match: {
                $and: [
                    {
                        $or: [
                            { owner: req.decoded.uuid },
                            { collaborators: req.decoded.uuid }
                        ]
                    }, {
                        status: 'open'
                    }
                ]
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: {
                _id: 0,
            }
        }
    ]).then((projects) => {
        return res.send({
            err: false,
            projects: projects
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: false,
            errMsg: conductorErrors.err6
        });
    })
};


/**
 * Retrieves a list of the Users that can be added to the collaborators list
 * of the project identified by the projectID in the request query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getAddableCollaborators'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getAddableCollaborators = (req, res) => {
    Project.findOne({
        uuid: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner) || (project.collaborators.includes(req.decoded.uuid))) {
                var unadd = [project.owner, ...project.collaborators]
                return User.aggregate([
                    {
                        $match: {
                            uuid: {
                                $nin: unadd
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
                    }, {
                        $sort: {
                            firstName: -1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'))
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((users) => {
        return res.send({
            err: false,
            users: users
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Adds a User to the collaborators list of the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'addCollaboratorToProject'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const addCollaboratorToProject = (req, res) => {
    var userData = {};
    var projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            projectData = project;
            // check user has permission to add collaborators
            if (project.owner === req.decoded.uuid) {
                // check user is not attempting to add themself
                if (req.body.uuid !== project.owner) {
                    // lookup user being added
                    return User.findOne({ uuid: req.body.uuid }).lean();
                } else {
                    throw(new Error('invalid'));
                }
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((user) => {
        if (user) {
            userData = user;
            // update the project's collaborators list
            return Project.updateOne({
                projectID: projectData.projectID
            }, {
                $addToSet: {
                    collaborators: userData.uuid
                }
            });
        } else {
            throw(new Error('usernotfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return mailAPI.sendAddedAsCollaboratorNotification(userData.email, userData.firstName,
                projectData.projectID, projectData.title);
        } else {
            throw(new Error('updatefailed')); // handle as generic error below
        }
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Successfully added user as collaborator.'
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'invalid') errMsg = conductorErrors.err2;
        else if (err.message === 'usernotfound') errMsg = conductorErrors.err7;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Adds a User to the collaborators list of the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'removeCollaboratorFromProject'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const removeCollaboratorFromProject = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).then((project) => {
        if (project) {
            // check user has permission to remove collaborators
            if (project.owner === req.decoded.uuid) {
                // update the project's collaborators list
                return Project.updateOne({
                    projectID: project.projectID
                }, {
                    $pull: {
                        collaborators: req.body.uuid
                    }
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully removed user as collaborator.'
            });
        } else {
            throw(new Error('updatefailed')); // handle as generic error below
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves a list of all Project Tags within the current Organization.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getOrgTags = (_req, res) => {
    Tag.aggregate([
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
                _id: 0
            }
        }
    ]).then((tags) => {
        return res.send({
            err: false,
            tags: tags
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
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


/**
 * Validate a provided Project Visibility option.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateVisibility = (visibility) => {
    if ((visibility === 'public') || (visibility === 'private')) return true;
    return false;
}


/**
 * Validate a provided Project Status option during creation.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateCreateStatus = (status) => {
    if ((status === 'available') || (status === 'open')) return true;
    return false
};


/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'createProject':
            return [
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
                body('tags', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
                body('visibility', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateVisibility),
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateCreateStatus),
                body('progress', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 0, max: 100, allow_leading_zeroes: false }),
                body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
                body('resourceURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString()
            ]
        case 'deleteProject':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'updateProject':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('title', conductorErrors.err1).optional().isString().isLength({ min: 1 }),
                body('tags', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
                body('progress', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 0, max: 100, allow_leading_zeroes: false }),
                body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
                body('resourceURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString()
            ]
        case 'getProject':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'changeProjectVisibility':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('visibility', conductorErrors.err1).exists().isString().custom(validateVisibility)
            ]
        case 'completeProject':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
            ]
        case 'getAddableCollaborators':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'addCollaboratorToProject':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('uuid', conductorErrors.err1).exists().isString().isUUID()
            ]
        case 'removeCollaboratorFromProject':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('uuid', conductorErrors.err1).exists().isString().isUUID()
            ]
    }
};

module.exports = {
    createProject,
    deleteProject,
    getProject,
    changeProjectVisibility,
    completeProject,
    updateProject,
    getUserProjects,
    getAddableCollaborators,
    addCollaboratorToProject,
    removeCollaboratorFromProject,
    getOrgTags,
    getAllUserProjects,
    getRecentUserProjects,
    validate
};
