//
// LibreTexts Conductor
// projects.js
//

'use strict';
const User = require('../models/user.js');
const Project = require('../models/project.js');
const Tag = require('../models/tag.js');
const Thread = require('../models/thread.js');
const Message = require('../models/message.js');
const { body, query } = require('express-validator');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const { isValidLicense } = require('../util/bookutils.js');
const { validateProjectClassification } = require('../util/projectutils.js');

const authAPI = require('./auth.js');
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
        classification: '',
        author: '',
        authorEmail: '',
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
    if (req.body.hasOwnProperty('classification')) newProjData.classification = req.body.classification;
    if (req.body.hasOwnProperty('projectURL')) newProjData.projectURL = req.body.projectURL;
    if (req.body.hasOwnProperty('author')) newProjData.author = req.body.author;
    if (req.body.hasOwnProperty('authorEmail')) newProjData.authorEmail = req.body.authorEmail;
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
            if ((req.user?.decoded?.uuid === project.owner)) {
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
            // TODO: Delete threads, messages, and tasks
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
                as: 'collaboratorsData'
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
            // check user has permission to view project
            if (checkProjectGeneralPermission(projResult, req.user)) {
                if (projResult.collaboratorsData) {
                    projResult.collaborators = projResult.collaboratorsData;
                    delete projResult.collaboratorsData;
                }
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
            if (checkProjectMemberPermission(project, req.user)) {
                // determine if there are changes to save
                if (req.body.hasOwnProperty('title') && req.body.title !== project.title) {
                    updateObj.title = req.body.title;
                }
                if (req.body.hasOwnProperty('progress') && req.body.progress !== project.currentProgress) {
                    updateObj.currentProgress = req.body.progress;
                }
                if (req.body.hasOwnProperty('status') && req.body.status !== project.status) {
                    updateObj.status = req.body.status;
                }
                if (req.body.hasOwnProperty('visibility') && req.body.visibility !== project.visibility) {
                    updateObj.visibility = req.body.visibility;
                }
                if (req.body.hasOwnProperty('classification') && req.body.classification !== project.classification) {
                    updateObj.classification = req.body.classification;
                }
                if (req.body.hasOwnProperty('projectURL') && req.body.projectURL !== project.projectURL) {
                    updateObj.projectURL = req.body.projectURL;
                }
                if (req.body.hasOwnProperty('author') && req.body.author !== project.author) {
                    updateObj.author = req.body.author;
                }
                if (req.body.hasOwnProperty('authorEmail') && req.body.authorEmail !== project.authorEmail) {
                    updateObj.authorEmail = req.body.authorEmail;
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
        if (Object.keys(updateObj).length > 0) {
            // check if an update needs to be submitted
            return Project.updateOne({
                projectID: req.body.projectID
            }, updateObj);
        } else {
            return {};
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully updated project.'
            });
        } else if (Object.keys(updateRes).length === 0 && Object.keys(updateObj).length === 0) {
            return res.send({
                err: false,
                msg: 'No changes to save.'
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
            err: true,
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
            $set: {
                owner: {
                    $arrayElemAt: ['$owner', 0]
                }
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
 * Retrieves a list of the requesting User's most recent open projects.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getRecentProjects = (req, res) => {
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
                updatedAt: -1,
                title: -1
            }
        }, {
            $limit: 3
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
 * Retrieves a list of the available projects within the current Organization.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getAvailableProjects = (req, res) => {
    Project.aggregate([
        {
            $match: {
                $and: [
                    {
                        orgID: process.env.ORG_ID
                    }, {
                        status: 'available'
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
 * Retrieves a list of a User's completed projects within the current Organization.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getCompletedProjects = (req, res) => {
    Project.aggregate([
        {
            $match: {
                $and: [
                    {
                        orgID: process.env.ORG_ID
                    }, {
                        status: 'completed'
                    }, {
                        $or: [
                            {
                                owner: req.decoded.uuid
                            }, {
                                collaborators: req.decoded.uuid
                            }
                        ]
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
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
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
            if (project.owner === req.user?.decoded?.uuid) {
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
            if (project.owner === req.user?.decoded?.uuid) {
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


/**
 * Creates a new Discussion Thread within a Project.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createThread'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createDiscussionThread = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                const thread = new Thread({
                    threadID: b62(14),
                    project: project.projectID,
                    title: req.body.title
                });
                return thread.save();
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((newThread) => {
        if (newThread) {
            return res.send({
                err: false,
                msg: 'New thread created successfully.',
                threadID: newThread.threadID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'createfail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes a Discussion Thread and its messages within a Project.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteThread'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteDiscussionThread = (req, res) => {
    Thread.findOne({
        threadID: req.body.threadID
    }).lean().then((thread) => {
        if (thread) {
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                return Thread.deleteOne({
                    threadID: req.body.threadID
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((threadDeleteRes) => {
        if (threadDeleteRes.deletedCount === 1) {
            return Message.deleteMany({
                thread: req.body.threadID
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).then((_msgDeleteRes) => {
        return res.send({
            err: false,
            msg: 'Thread and messages successfully deleted.'
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrives all Discussion Threads within a Project and their most recent message.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getThreads'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getProjectThreads = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                return Thread.aggregate([
                    {
                        $match: {
                            project: req.query.projectID
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $lookup: {
                            from: 'messages',
                            let: {
                                threadID: '$threadID'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$thread', '$$threadID']
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
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'lastMessage'
                        }
                    }, {
                        $addFields: {
                            lastMessage: {
                                $arrayElemAt: ['$lastMessage', 0]
                            }
                        }
                    }, {
                        $lookup: {
                            from: 'users',
                            let: {
                                author: '$lastMessage.author'
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
                                        lastName: 1
                                    }
                                }
                            ],
                            as: 'lastMessage.author'
                        }
                    }, {
                        $addFields: {
                            'lastMessage.author': {
                                $arrayElemAt: ['$lastMessage.author', 0]
                            }
                        }
                    }, {
                        $sort: {
                            'lastMessage.createdAt': -1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((threads) => {
        return res.send({
            err: false,
            projectID: req.query.projectID,
            threads: threads
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
 * Creates a new Message within a Project Thread.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createThreadMessage = (req, res) => {
    Thread.findOne({
        threadID: req.body.threadID
    }).lean().then((thread) => {
        if (thread) {
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                const message = new Message({
                    messageID: b62(15),
                    thread: req.body.threadID,
                    body: req.body.message,
                    author: req.decoded.uuid
                });
                return message.save();
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((newMsg) => {
        if (newMsg) {
            return res.send({
                err: false,
                msg: 'Message successfully sent.',
                messageID: newMsg.messageID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        debugError(err);
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'createfail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes a Message within a Project Thread.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteThreadMessage = (req, res) => {
    Message.findOne({
        messageID: req.body.messageID
    }).lean().then((message) => {
        if (message) {
            if ((message.author === req.user?.decoded?.uuid)
                || (authAPI.checkHasRole(req.user, 'libretexts', 'superadmin'))) {
                    return Message.deleteOne({
                        messageID: req.body.messageID
                    })
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((msgDeleteRes) => {
        if (msgDeleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: 'Message successfully deleted.'
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves all Messages within a Project Thread.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getMessages'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getThreadMessages = (req, res) => {
    Thread.findOne({
        threadID: req.query.threadID
    }).lean().then((thread) => {
        if (thread) {
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                return Message.aggregate([
                    {
                        $match: {
                            thread: req.query.threadID
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
                        $addFields: {
                            author: {
                                $arrayElemAt: ['$author', 0]
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $sort: {
                            createdAt: 1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((messages) => {
        return res.send({
            err: false,
            threadID: req.query.threadID,
            messages: messages
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
 * Checks if a user has permission to perform general actions on or view a
 * project.
 * @param {Object} project          - the project data object
 * @param {Object} user             - the current user context
 * @return {Boolean} true if user has permission, false otherwise
 */
const checkProjectGeneralPermission = (project, user) => {
    // check if project is public/available, or if the user is the owner or a
    // collaborator
    var projOwner = '';
    var projCollabs = [];
    if (project.hasOwnProperty('owner')) {
        if (typeof(project.owner) === 'string') {
            projOwner = project.owner;
        } else if (typeof(project.owner) === 'object') {
            if (project.owner?.uuid !== undefined) {
                projOwner = project.owner.uuid;
            }
        }
    }
    if (project.hasOwnProperty('collaborators') && Array.isArray(project.collaborators)) {
        projCollabs = project.collaborators;
    }
    if (project.visibility === 'public'
        || project.status === 'available'
        || projOwner === user.decoded?.uuid
        || projCollabs.includes(user.decoded?.uuid)) {
            return true;
    } else {
        // check if user is a SuperAdmin
        return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
    }
    return false;
};


/**
 * Checks if a user has permission to perform member-only actions on a Project.
 * @param {Object} project          - the project data object
 * @param {Object} user             - the current user context
 * @return {Boolean} true if user has permission, false otherwise
 */
const checkProjectMemberPermission = (project, user) => {
    // check if the user is the owner or a collaborator
    var projOwner = '';
    var projCollabs = [];
    if (project.hasOwnProperty('owner')) {
        if (typeof(project.owner) === 'string') {
            projOwner = project.owner;
        } else if (typeof(project.owner) === 'object') {
            if (project.owner?.uuid !== undefined) {
                projOwner = project.owner.uuid;
            }
        }
    }
    if (project.hasOwnProperty('collaborators') && Array.isArray(project.collaborators)) {
        projCollabs = project.collaborators;
    }
    if (projOwner === user.decoded?.uuid || projCollabs.includes(user.decoded?.uuid)) {
        return true;
    } else {
        // check if user is a SuperAdmin
        return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
    }
    return false;
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
 * Validate a provided Project Status option during editing.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateEditStatus = (status) => {
    if (status.length > 0) {
        if ((status === 'available') || (status === 'open')) return true;
    }
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
                body('classification', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectClassification),
                body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail(),
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
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateCreateStatus),
                body('classification', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectClassification),
                body('visibility', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateVisibility),
                body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail(),
                body('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
                body('resourceURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString()
            ]
        case 'getProject':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
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
        case 'createThread':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 })
            ]
        case 'deleteThread':
            return [
                body('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 })
            ]
        case 'getThreads':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'createMessage':
            return [
                body('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 }),
                body('message', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 2000 })
            ]
        case 'deleteMessage':
            return [
                body('messageID', conductorErrors.err1).exists().isString().isLength({ min: 15, max: 15 }),
            ]
        case 'getMessages':
            return [
                query('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 })
            ]
    }
};

module.exports = {
    createProject,
    deleteProject,
    getProject,
    completeProject,
    updateProject,
    getUserProjects,
    getRecentProjects,
    getAvailableProjects,
    getCompletedProjects,
    getAddableCollaborators,
    addCollaboratorToProject,
    removeCollaboratorFromProject,
    getOrgTags,
    createDiscussionThread,
    deleteDiscussionThread,
    getProjectThreads,
    createThreadMessage,
    deleteThreadMessage,
    getThreadMessages,
    checkProjectGeneralPermission,
    checkProjectMemberPermission,
    validate
};
