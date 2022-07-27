//
// LibreTexts Conductor
// projects.js
//

'use strict';
import Promise from 'bluebird';
import express from 'express';
import async from 'async';
import { body, query, param } from 'express-validator';
import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import b62 from 'base62-random';
import multer from 'multer';
import { v4 } from 'uuid';
import User from '../models/user.js';
import Project from '../models/project.js';
import Tag from '../models/tag.js';
import HarvestingRequest from '../models/harvestingrequest.js';
import Organization from '../models/organization.js';
import conductorErrors from '../conductor-errors.js';
import { debugError, debugCommonsSync } from '../debug.js';
import {
    validateProjectClassification,
    validateRoadmapStep,
    getLibreTextInformation
} from '../util/projectutils.js';
import {
  isValidLicense,
  getBookTOCFromAPI,
  retrieveBookMaterials,
  retrieveAllBookMaterials,
  MATERIALS_S3_CLIENT_CONFIG,
  updateBookMaterials,
  downloadBookMaterial,
} from '../util/bookutils.js';
import { validateA11YReviewSectionItem } from '../util/a11yreviewutils.js';
import { isEmptyString, assembleUrl } from '../util/helpers.js';
import { libraryNameKeys } from '../util/librariesmap.js';
import authAPI from './auth.js';
import mailAPI from './mail.js';
import usersAPI from './users.js';
import alertsAPI from './alerts.js';

const projectListingProjection = {
    _id: 0,
    orgID: 1,
    projectID: 1,
    title: 1,
    status: 1,
    visibility: 1,
    currentProgress: 1,
    a11yProgress: 1,
    peerProgress: 1,
    createdAt: 1,
    updatedAt: 1,
    classification: 1,
    flag: 1,
    flagDescrip: 1,
    leads: 1,
    liaisons: 1,
    members: 1,
    auditors: 1,
    rating: 1
};

const projectStatusOptions = ['completed', 'available', 'open'];
const projectVisibilityOptions = ['private', 'public'];

const materialsStorage = multer.memoryStorage();

/**
 * Creates a new Project within the current Organization using the values specified in the
 * request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createProject'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createProject = (req, res) => {
    let hasTags = false;
    let checkProjURL = false;
    let libNames = [];
    let libreURLRegex = null;
    // Setup project with defaults
    const newProjectID = b62(10);
    let newProjData = {
        orgID: process.env.ORG_ID,
        projectID: newProjectID,
        title: req.body.title,
        status: 'open',
        visibility: 'private',
        currentProgress: 0,
        peerProgress: 0,
        a11yProgress: 0,
        classification: '',
        author: '',
        authorEmail: '',
        license: '',
        resourceURL: '',
        projectURL: '',
        leads: [req.decoded.uuid],
        liaisons: [],
        members: [],
        auditors: [],
        tags: [],
        notes: ''
    };
    // Apply user values if present
    if (req.body.hasOwnProperty('visibility')) newProjData.visibility = req.body.visibility;
    if (req.body.hasOwnProperty('status')) newProjData.status = req.body.status;
    if (req.body.hasOwnProperty('progress')) newProjData.currentProgress = req.body.progress;
    if (req.body.hasOwnProperty('classification')) newProjData.classification = req.body.classification;
    if (req.body.hasOwnProperty('projectURL')) {
        /* If the Project URL is a LibreTexts link, flag it to gather more information */
        libNames = libraryNameKeys.join('|');
        libreURLRegex = new RegExp(`(http(s)?:\/\/)?(${libNames}).libretexts.org\/`, 'i');
        if (libreURLRegex.test(req.body.projectURL)) checkProjURL = true;
        newProjData.projectURL = req.body.projectURL;
    }
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
        // optionally lookup LibreText information if a LibreTexts URL was provided
        if (checkProjURL) return getLibreTextInformation(newProjData.projectURL);
        return {};
    }).then((projURLInfo) => {
        if (checkProjURL) {
            if (projURLInfo.hasOwnProperty('lib') && projURLInfo.lib !== '') newProjData.libreLibrary = projURLInfo.lib;
            if (projURLInfo.hasOwnProperty('id') && projURLInfo.id !== '') newProjData.libreCoverID = projURLInfo.id;
            if (projURLInfo.hasOwnProperty('shelf') && projURLInfo.shelf !== '') newProjData.libreShelf = projURLInfo.shelf;
            else if (projURLInfo.hasOwnProperty('campus') && projURLInfo.campus !== '') newProjData.libreCampus = projURLInfo.campus;
        }
        // save formatted project to DB
        return new Project(newProjData).save();
    }).then((newDoc) => {
        if (newDoc) {
            if (newDoc.visibility === 'public') {
                return alertsAPI.processInstantProjectAlerts([newDoc._id]);
            }
            return true;
        } else {
            throw (new Error('createfail'));
        }
    }).then(() => {
        // ignore return value of Alerts processing
        return res.send({
            err: false,
            msg: 'New project created.',
            projectID: newProjectID
        });
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
    }).lean().then((project) => {
        if (project) {
            if (checkProjectAdminPermission(project, req.user)) {
                return Project.deleteOne({
                    projectID: req.body.projectID
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            // TODO: Delete threads, messages, and tasks
            return res.send({
                err: false,
                msg: 'Successfully deleted project.'
            });
        } else {
            throw (new Error('deletefail')); // handle as generic error below
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
    return Project.aggregate([
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
                    members: '$members'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$members']
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
                as: 'members'
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
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
                as: 'leads'
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    liaisons: '$liaisons'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$liaisons']
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
                as: 'liaisons'
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    auditors: '$auditors'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$auditors']
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
                as: 'auditors'
            }
        }, {
            $project: {
                _id: 0
            }
        }
    ]).then((projects) => {
        if (projects.length > 0) {
            var projResult = projects[0];
            if (projResult.tagResults) {
                projResult.tags = projResult.tagResults.map((tagResult) => {
                    return tagResult.title;
                });
            } else {
                projResult.tags = [];
            }
            delete projResult.tagResults; // prune lookup results
            // check user has permission to view project
            if (checkProjectGeneralPermission(projResult, req.user)) {
                return res.send({
                    err: false,
                    project: projResult
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
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
 * @param  {Object} req - the express.js request object
 * @param  {Object} res - the express.js response object
 */
const updateProject = (req, res) => {
    let updateObj = {};
    let checkTags = false;
    let checkProjURL = false;
    let libNames = [];
    let libreURLRegex = null;
    let newTagTitles = []; // titles of the project's tags to be returned with the updated document
    let sendCompleted = false;
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if (checkProjectMemberPermission(project, req.user)) {
                // determine if there are changes to save
                if (req.body.hasOwnProperty('title') && req.body.title !== project.title) {
                    updateObj.title = req.body.title;
                }
                if (req.body.hasOwnProperty('progress') && req.body.progress !== project.currentProgress) {
                    updateObj.currentProgress = req.body.progress;
                }
                if (req.body.hasOwnProperty('peerProgress') && req.body.peerProgress !== project.peerProgress) {
                    updateObj.peerProgress = req.body.peerProgress;
                }
                if (req.body.hasOwnProperty('a11yProgress') && req.body.a11yProgress !== project.a11yProgress) {
                    updateObj.a11yProgress = req.body.a11yProgress;
                }
                if (req.body.hasOwnProperty('status') && req.body.status !== project.status) {
                    updateObj.status = req.body.status;
                    if (req.body.status === 'completed' && project.status !== 'completed') {
                        // only send notifications when status is first changed to completed
                        sendCompleted = true;
                    }
                }
                if (req.body.hasOwnProperty('visibility') && req.body.visibility !== project.visibility) {
                    updateObj.visibility = req.body.visibility;
                }
                if (req.body.hasOwnProperty('classification') && req.body.classification !== project.classification) {
                    updateObj.classification = req.body.classification;
                }
                if (req.body.hasOwnProperty('projectURL') && req.body.projectURL !== project.projectURL) {
                    /* If the Project URL is a LibreTexts link, flag it to gather more information */
                    libNames = libraryNameKeys.join('|');
                    libreURLRegex = new RegExp(`(http(s)?:\/\/)?(${libNames}).libretexts.org\/`, 'i');
                    if (libreURLRegex.test(req.body.projectURL)) checkProjURL = true;
                    updateObj.projectURL = req.body.projectURL;
                }
                if (req.body.hasOwnProperty('allowAnonPR') && req.body.allowAnonPR !== project.allowAnonPR) {
                    updateObj.allowAnonPR = req.body.allowAnonPR;
                }
                if (req.body.hasOwnProperty('preferredPRRubric') && req.body.preferredPRRubric !== project.preferredPRRubric) {
                    updateObj.preferredPRRubric = req.body.preferredPRRubric;
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
                if (req.body.hasOwnProperty('rdmpReqRemix') && req.body.rdmpReqRemix !== project.rdmpReqRemix) {
                    updateObj.rdmpReqRemix = req.body.rdmpReqRemix;
                }
                if (req.body.hasOwnProperty('rdmpCurrentStep') && req.body.rdmpCurrentStep !== project.rdmpCurrentStep) {
                    updateObj.rdmpCurrentStep = req.body.rdmpCurrentStep;
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
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((allOrgTags) => {
        let tagBulkOps = [];
        let projTagIDs = [];
        // build new array of existing tagIDs,
        // otherwise generate a new tagID and prepare to insert in DB
        if (checkTags) {
            req.body.tags.forEach((tagItem) => {
                let foundTag = allOrgTags.find((orgTag) => {
                    return orgTag.title === tagItem;
                });
                if (foundTag !== undefined) {
                    projTagIDs.push(foundTag.tagID);
                    newTagTitles.push(foundTag.title);
                } else {
                    let newID = b62(12);
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
        // optionally lookup LibreText information if a LibreTexts URL was provided
        if (checkProjURL) return getLibreTextInformation(updateObj.projectURL);
        return {};
    }).then((projURLInfo) => {
        if (checkProjURL) {
            if (projURLInfo.hasOwnProperty('lib') && projURLInfo.lib !== '') updateObj.libreLibrary = projURLInfo.lib;
            if (projURLInfo.hasOwnProperty('id') && projURLInfo.id !== '') updateObj.libreCoverID = projURLInfo.id;
            if (projURLInfo.hasOwnProperty('shelf') && projURLInfo.shelf !== '') updateObj.libreShelf = projURLInfo.shelf;
            else if (projURLInfo.hasOwnProperty('campus') && projURLInfo.campus !== '') updateObj.libreCampus = projURLInfo.campus;
        }
        if (Object.keys(updateObj).length > 0) {
            // check if an update needs to be submitted
            return Project.updateOne({
                projectID: req.body.projectID
            }, updateObj);
        }
        return {};
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            if (sendCompleted) {
                notifyProjectCompleted(req.body.projectID);
            }
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
            throw (new Error('updatefailed'));
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
                        $or: constructProjectTeamMemberQuery(req.decoded.uuid)
                    }, {
                        status: {
                            $ne: 'completed'
                        }
                    }
                ]
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
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
                as: 'leads'
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: projectListingProjection
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
    });
};


/**
 * Retrieves a list of a specified User's Projects, for Admin usage.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getUserProjectsAdmin = (req, res) => {
    Project.aggregate([
        {
            $match: {
                $and: [
                    {
                        $or: constructProjectTeamMemberQuery(req.query.uuid)
                    }, {
                        status: {
                            $ne: 'completed'
                        }
                    }
                ]
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
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
                as: 'leads'
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: projectListingProjection
        }
    ]).then((projects) => {
        return res.send({
            err: false,
            uuid: req.query.uuid,
            projects: projects
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: false,
            errMsg: conductorErrors.err6
        });
    });
};


/**
 * Retrieves a list of flagged projects that the requesting user may need to review.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getUserFlaggedProjects = (req, res) => {
    let isLibreAdmin = false;
    let isCampusAdmin = false;
    let orObj = [{
        $and: [{
            flag: 'liaison'
        }, {
            liaisons: req.decoded.uuid
        }]
    }, {
        $and: [{
            flag: 'lead'
        }, {
            leads: req.decoded.uuid
        }]
    }];
    User.findOne({
        uuid: req.decoded.uuid
    }).lean().then((user) => {
        if (user) {
            if (user.roles && Array.isArray(user.roles)) {
                user.roles.forEach((item) => {
                    if (item.org === 'libretexts' && item.role === 'superadmin') {
                        // user is a LibreTexts Admin
                        isLibreAdmin = true;
                    }
                    if (item.org === process.env.ORG_ID && (item.role === 'campusadmin' || item.role === 'superadmin')) {
                        // user is a Campus Admin or LibreTexts Campus Admin
                        isCampusAdmin = true;
                    }
                });
            }
            if (isLibreAdmin) {
                orObj.push({
                    flag: 'libretexts'
                });
            }
            if (isCampusAdmin) {
                orObj.push({
                    $and: [{
                        flag: 'campusadmin'
                    }, {
                        orgID: process.env.ORG_ID
                    }]
                });
            }
            return Project.aggregate([
                {
                    $match: {
                        $or: orObj
                    }
                }, {
                    $lookup: {
                        from: 'users',
                        let: {
                            leads: '$leads'
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ['$uuid', '$$leads']
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
                        as: 'leads'
                    }
                }, {
                    $sort: {
                        title: -1
                    }
                }, {
                    $project: projectListingProjection
                }
            ]);
        } else {
            throw (new Error('user'));
        }
    }).then((projects) => {
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
 * Retrieve a list of the user's "pinned" projects for quick access.
 *
 * @param {Object} req - The express.js request object.
 * @param {Object} res - The express.js response object.
 */
const getUserPinnedProjects = (req, res) => {
  return User.findOne(
    { uuid: req.user.decoded.uuid },
    { pinnedProjects: 1 },
  ).lean().then((user) => {
    if (user) {
      const pinned = user.pinnedProjects || [];
      return Project.aggregate([
        {
          $match: {
            projectID: {
              $in: pinned
            }
          }
        }, {
          $sort: {
            title: -1,
          }
        }, {
          $project: projectListingProjection
        }
      ]);
    }
    throw (new Error('user'));
  }).then((projects) => {
    return res.send({
      err: false,
      projects,
    });
  }).catch((err) => {
    let errMsg = conductorErrors.err6;
    if (err.message === 'user') {
      errMsg = conductorErrors.err9;
    } else {
      debugError(err);
    }
    return res.send({
      err: false,
      errMsg,
    });
  });
};

/**
 * Retrieves a list of the requesting User's most recent projects. Excludes completed projects
 * and projects the user has in their "pinned" list.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getRecentProjects(req, res) {
  const user = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
  if (!user) {
    return res.send({
      err: true,
      errMsg: conductorErrors.err9,
    });
  }
  let userPinned = [];
  if (Array.isArray(user.pinnedProjects)) {
    userPinned = user.pinnedProjects;
  }
  try {
    const projects = await Project.aggregate([
      {
        $match: {
          $and: [
            { $or: constructProjectTeamMemberQuery(req.user.decoded.uuid) },
            { status: { $ne: 'completed' } },
            { projectID: { $nin: userPinned }},
          ]
        }
      }, {
        $sort: {
          updatedAt: -1,
          title: -1,
        }
      }, {
        $limit: 6
      }, {
        $project: projectListingProjection,
      },
    ]);
    if (!Array.isArray(projects)) {
      throw (new Error('Invalid result returned.'));
    }
    return res.send({
      err: false,
      projects,
    });
  } catch (e) {
    debugError(e);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
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
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
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
                as: 'leads'
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: projectListingProjection
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
                        $or: constructProjectTeamMemberQuery(req.decoded.uuid)
                    }
                ]
            }
        }, {
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
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
                as: 'leads'
            }
        }, {
            $sort: {
                title: -1
            }
        }, {
            $project: projectListingProjection
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
 * Retrieves a list of public Projects that are 'under development' (not completed).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const getProjectsUnderDevelopment = (req, res) => {
    return Project.aggregate([
        {
            $match: {
                $and: [
                    { orgID: 'libretexts' },
                    { visibility: 'public' },
                    { classification: {
                        $in: ['harvesting', 'construction', 'adoptionrequest']
                    }},
                    { status: {
                        $in: ['available', 'open', 'flagged']
                    }}
                ]
            }
        }, {
            $project: {
                _id: 0,
                projectID: 1,
                title: 1,
                status: 1,
                currentProgress: 1,
                peerProgress: 1,
                a11yProgress: 1,
                classification: 1,
            }
        }
    ]).then((projects) => {
        const sortedProjects = projects.sort((a, b) => {
            const aData = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
            const bData = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
            if (aData < bData) return -1;
            if (aData > bData) return 1;
            return 0;
        });
        return res.send({
            err: false,
            projects: sortedProjects
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
 * Retrieves a list of the Users that can be added to the team of the
 * project identified in the request query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getAddableMembers'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getAddableMembers = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to add team members
            if (checkProjectAdminPermission(project, req.user)) {
                var unadd = constructProjectTeam(project); // can't add existing users
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
                throw (new Error('unauth'))
            }
        } else {
            throw (new Error('notfound'));
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
 * Adds a User to the members list of the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'addMemberToProject'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const addMemberToProject = (req, res) => {
    var userData = {};
    var projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            projectData = project;
            // check user has permission to add members
            if (checkProjectAdminPermission(project, req.user)) {
                // check user is not attempting to add themself
                if (req.body.uuid !== req.user?.decoded?.uuid) {
                    // lookup user being added
                    return User.findOne({ uuid: req.body.uuid }).lean();
                } else {
                    throw (new Error('invalid'));
                }
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((user) => {
        if (user) {
            userData = user;
            // update the project's members list
            return Project.updateOne({
                projectID: projectData.projectID
            }, {
                $addToSet: {
                    members: userData.uuid
                }
            });
        } else {
            throw (new Error('usernotfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return mailAPI.sendAddedAsMemberNotification(userData.email, userData.firstName,
                projectData.projectID, projectData.title);
        } else {
            throw (new Error('updatefailed')); // handle as generic error below
        }
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Successfully added user as team member.'
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
 * Changes a User's role within the team of the Project identified
 * in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js request object
 */
const changeMemberRole = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to manage team members
            if (checkProjectAdminPermission(project, req.user)) {
                /* Construct current role listings, remove user, then add user to new role */
                let projLeads = [];
                let projLiaisons = [];
                let projMembers = [];
                let projAuditors = [];
                if (project.leads && Array.isArray(project.leads)) projLeads = project.leads;
                if (project.liaisons && Array.isArray(project.liaisons)) projLiaisons = project.liaisons;
                if (project.members && Array.isArray(project.members)) projMembers = project.members;
                if (project.auditors && Array.isArray(project.auditors)) projAuditors = project.auditors;
                projLeads = projLeads.filter(item => item !== req.body.uuid);
                projLiaisons = projLiaisons.filter(item => item !== req.body.uuid);
                projMembers = projMembers.filter(item => item !== req.body.uuid);
                projAuditors = projAuditors.filter(item => item !== req.body.uuid);
                switch (req.body.newRole) {
                    case 'lead':
                        projLeads.push(req.body.uuid);
                        break;
                    case 'liaison':
                        projLiaisons.push(req.body.uuid);
                        break;
                    case 'member':
                        projMembers.push(req.body.uuid);
                        break;
                    case 'auditor':
                        projAuditors.push(req.body.uuid);
                        break;
                    default:
                        throw (new Error('invalidarg'));
                };
                if (projLeads.length === 0) {
                    throw (new Error('nolead')); // at least one lead must be specified
                }
                /* Send update to DB */
                return Project.updateOne({
                    projectID: project.projectID
                }, {
                    leads: projLeads,
                    liaisons: projLiaisons,
                    members: projMembers,
                    auditors: projAuditors
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully removed user from project team.'
            });
        } else {
            throw (new Error('updatefailed')); // handle as generic error below
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'nolead') errMsg = conductorErrors.err44;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Removes a User from the team of the Project identified in the
 * request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'removeMemberFromProject'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const removeMemberFromProject = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to remove team members
            if (checkProjectAdminPermission(project, req.user)) {
                // update the project's members list
                let projLeads = [];
                let projLiaisons = [];
                let projMembers = [];
                let projAuditors = [];
                if (project.leads && Array.isArray(project.leads)) projLeads = project.leads;
                if (project.liaisons && Array.isArray(project.liaisons)) projLiaisons = project.liaisons;
                if (project.members && Array.isArray(project.members)) projMembers = project.members;
                if (project.auditors && Array.isArray(project.auditors)) projAuditors = project.auditors;
                projLeads = projLeads.filter(item => item !== req.body.uuid);
                projLiaisons = projLiaisons.filter(item => item !== req.body.uuid);
                projMembers = projMembers.filter(item => item !== req.body.uuid);
                projAuditors = projAuditors.filter(item => item !== req.body.uuid);
                if (projLeads.length === 0) {
                    throw (new Error('nolead')); // at least one lead must be specified
                }
                return Project.updateOne({
                    projectID: project.projectID
                }, {
                    leads: projLeads,
                    liaisons: projLiaisons,
                    members: projMembers,
                    auditors: projAuditors
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully removed user from project team.'
            });
        } else {
            throw (new Error('updatefailed')); // handle as generic error below
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'nolead') errMsg = conductorErrors.err44;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Sets a flag on the Project identified by the projectID in the request body
 * and sends an email to the user(s) in the flagging group.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'flagProject'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const flagProject = (req, res) => {
    let projectData = {};
    let flagGroupTitle = null;
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            projectData = project;
            if (checkProjectMemberPermission(project, req.user)) {
                if (!req.body.hasOwnProperty('flagDescrip')) {
                    req.body.flagDescrip = '';
                }
                // set flag on project
                return Project.updateOne({
                    projectID: req.body.projectID
                }, {
                    flag: req.body.flagOption,
                    flagDescrip: req.body.flagDescrip
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            switch (req.body.flagOption) {
                case 'libretexts':
                    flagGroupTitle = 'LibreTexts Administrators';
                    return authAPI.getLibreTextsAdmins();
                case 'campusadmin':
                    flagGroupTitle = 'Campus Administrators';
                    return authAPI.getCampusAdmins(projectData.orgID);
                case 'liaison':
                    flagGroupTitle = 'Project Liaisons';
                    return authAPI.getUserBasicWithEmail(projectData.liaisons);
                case 'lead':
                    flagGroupTitle = 'Project Leads';
                    return authAPI.getUserBasicWithEmail(projectData.leads);
                default:
                    throw (new Error('flagoption'));
            }
        } else {
            throw (new Error('updatefail'));
        }
    }).then((flaggingGroup) => {
        const recipients = flaggingGroup.map((item) => {
            if (item.hasOwnProperty('email')) return item.email;
            else return null;
        }).filter(item => item !== null);
        return mailAPI.sendProjectFlaggedNotification(recipients, projectData.projectID,
            projectData.title, projectData.orgID, flagGroupTitle, req.body.flagDescrip);
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Project successfully flagged.'
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        else if (err.message === 'noliaison') errMsg = conductorErrors.err32;
        else if (err.message === 'flagoption') errMsg = conductorErrors.err1;
        else if (err.message === 'missingcampus' || err.message === 'missinguuid') errMsg = conductorErrors.err1;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Clears a flag on the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'clearProjectFlag'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const clearProjectFlag = (req, res) => {
    let projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            projectData = project;
            if (checkProjectMemberPermission(project, req.user)) {
                // set flag on project
                return Project.updateOne({
                    projectID: req.body.projectID
                }, {
                    flag: null,
                    flagDescrip: ''
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Project successfully unflagged.'
            });
        } else {
            throw (new Error('updatefail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Looks up whether or not a user has a particular saved in their "pinned" list for quick access.
 *
 * @param {Object} req - The express.js request object.
 * @param {Object} res - The express.js response object.
 */
const getProjectPinStatus = (req, res) => {
  return User.findOne(
    { uuid: req.user.decoded.uuid },
    { pinnedProjects: 1 },
  ).lean().then((user) => {
    if (user) {
      let pinned = false;
      if (Array.isArray(user.pinnedProjects)) {
        pinned = user.pinnedProjects.includes(req.query.projectID);
      }
      return res.send({
        err: false,
        pinned,
      });
    }
    throw (new Error('notfound'));
  }).catch((err) => {
    let errMsg = conductorErrors.err6;
    if (err.message === 'notfound') {
      errMsg = conductorErrors.err9;
    }
    return res.send({
      err: true,
      errMsg,
    });
  });
};


/**
 * Adds a project to the user's "pinned" list for quick access.
 *
 * @param {Object} req - The express.js request object. 
 * @param {Object} res - The express.js response object.
 */
const pinProject = (req, res) => {
  return Project.findOne({ projectID: req.body.projectID }).lean().then((project) => {
    if (project) {
      return User.updateOne({ uuid: req.user.decoded.uuid }, {
        $addToSet: {
          pinnedProjects: project.projectID,
        }
      });
    }
    throw (new Error('notfound'));
  }).then(() => {
    return res.send({
      err: false,
      msg: 'Project successfully pinned!',
    });
  }).catch((err) => {
    let errMsg = conductorErrors.err6;
    if (err.message === 'notfound') {
      errMsg = conductorErrors.err11;
    } else {
      debugError(err);
    }
    return res.send({
      err: true,
      errMsg,
    });
  });
};


/**
 * Removes a project from the user's "pinned" list.
 *
 * @param {Object} req - The express.js request object. 
 * @param {Object} res - The express.js response object.
 */
const unpinProject = (req, res) => {
  return User.updateOne(
    { uuid: req.user.decoded.uuid },
    { $pullAll: { pinnedProjects: [req.body.projectID] }},
  ).then(() => {
    return res.send({
      err: false,
      msg: 'Successfully unpinned project.',
    });
  }).catch((err) => {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  });
};


/**
 * Retrieves a list of project team members (or the OER Integration Request submitter)
 * and triggers the Mail API to send the Project Completed Notification via email.
 * INTERNAL USE ONLY.
 * @param {string} projectID - The standard internal projectID.
 * @returns {Promise<object|Error>} A promise from the Mail API.
 */
const notifyProjectCompleted = (projectID) => {
    if (projectID !== null && !isEmptyString(projectID)) {
        let projectData = {};
        let notifRecipients = [];
        return Project.findOne({
            projectID: projectID
        }).lean().then((project) => {
            projectData = project;
            if (project.harvestReqID && !isEmptyString(project.harvestReqID)) {
                return HarvestingRequest.findOne({
                    _id: project.harvestReqID
                }).lean();
            } else {
                return {};
            }
        }).then((harvestReq) => {
            const projTeam = constructProjectTeam(projectData);
            if (Object.keys(harvestReq).length > 0 && harvestReq.email && !isEmptyString(harvestReq.email)) {
                notifRecipients.push(harvestReq.email);
            }
            if (Array.isArray(projTeam) && projTeam.length > 0) {
                return usersAPI.getUserEmails(projTeam);
            } else {
                return [];
            }
        }).then((notifUsers) => {
            if (notifUsers && Array.isArray(notifUsers) && notifUsers.length > 0) {
                notifUsers = notifUsers.map((item) => {
                    if (item.hasOwnProperty('email')) return item.email;
                    else return null;
                }).filter(item => item !== null);
                notifUsers.forEach((item) => {
                    if (notifRecipients.indexOf(item) === -1) {
                        notifRecipients.push(item);
                    }
                });
            }
            if (notifRecipients.length > 0) {
                return mailAPI.sendProjectCompletedAlert(notifRecipients, projectData.projectID, projectData.title, projectData.orgID);
            }
        }).catch((err) => {
            debugError(err);
        });
    }
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
 * Sends an email via the Mailgun API to the LibreTexts team requesting
 * publishing of the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'requestProjectPublishing'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const requestProjectPublishing = (req, res) => {
    var projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            projectData = project;
            // check user has permission to request publishing
            if (checkProjectMemberPermission(projectData, req.user)) {
                // lookup user for info
                if (req.user?.decoded?.uuid) {
                    return User.findOne({ uuid: req.user.decoded.uuid }).lean();
                } else {
                    throw (new Error('unauth'));
                }
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((user) => {
        if (user) {
            let userName = user.firstName + ' ' + user.lastName;
            let projLib = null;
            let projCoverID = null;
            if (projectData.libreLibrary && !isEmptyString(projectData.libreLibrary)) {
                projLib = projectData.libreLibrary;
            }
            if (projectData.libreCoverID && !isEmptyString(projectData.libreCoverID)) {
                projCoverID = projectData.libreCoverID;
            }
            return mailAPI.sendPublishingRequestedNotification(userName, projectData.projectID,
                projectData.title, projLib, projCoverID);
        } else {
            throw (new Error('usernotfound'));
        }
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Successfully requested publishing.'
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
 * Adds a A11Y Review Section to the A11Y Review array of the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createA11YReviewSection'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const createA11YReviewSection = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to add section
            if (checkProjectMemberPermission(project, req.user)) {
                return Project.updateOne({
                    projectID: project.projectID
                }, {
                    $push: {
                        a11yReview: {
                            sectionTitle: req.body.sectionTitle
                        }
                    }
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully added accessibility review section.'
            });
        } else {
            throw (new Error('updatefailed')); // handle as generic error below
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
 * Retrieves the list of A11Y Review Sections for the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getA11YReviewSections'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getA11YReviewSections = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to view reviews
            if (checkProjectMemberPermission(project, req.user)) {
                return res.send({
                    err: false,
                    projectID: project.projectID,
                    a11yReview: project.a11yReview
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
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
 * Updates an item within a A11Y Review Section for the project identified
 * by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'updateA11YReviewSectionItem'
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const updateA11YReviewSectionItem = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to update item
            if (checkProjectMemberPermission(project, req.user)) {
                let toSet = {};
                toSet[`a11yReview.$.${req.body.itemName}`] = req.body.newResponse;
                return Project.updateOne({
                    projectID: project.projectID,
                    'a11yReview._id': req.body.sectionID
                }, {
                    $set: toSet
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully updated review section item'
            });
        } else {
            throw (new Error('updatefailed')) // handle as generic error below
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


const importA11YSectionsFromTOC = (req, res) => {
    const recurseBuildPagesArray = (pages) => {
        if (Array.isArray(pages)) {
            let processed = [];
            pages.forEach((item) => {
                let children = item.children;
                delete item.children;
                processed.push(item);
                if (Array.isArray(children) && children.length > 0) {
                    processed = [...processed, ...recurseBuildPagesArray(children)];
                }
            });
            return processed;
        }
        return [];
    };

    let projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            projectData = project;
            // check user has permission to import TOC
            if (checkProjectMemberPermission(projectData, req.user)) {
                if (
                    !isEmptyString(projectData.libreLibrary)
                    && !isEmptyString(projectData.libreCoverID)
                    && !isEmptyString(projectData.projectURL)
                ) return getBookTOCFromAPI(null, projectData.projectURL);
                else throw (new Error('bookid'));
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((toc) => {
        if (toc) {
            let pages = recurseBuildPagesArray(toc.children);
            let pageObjs = pages.map((page) => {
                return {
                    sectionTitle: page.title,
                    sectionURL: page.url
                }
            });
            if (pageObjs.length > 0) {
                if (req.body.merge === true && Array.isArray(projectData.a11yReview)) {
                    let currentState = projectData.a11yReview;
                    pageObjs = pageObjs.map((page) => {
                        let foundIndex = -1;
                        let foundExisting = projectData.a11yReview.find((existing, index) => {
                            if (existing.sectionTitle === page.sectionTitle) {
                                foundIndex = index;
                                return existing;
                            }
                            return null;
                        });
                        if (foundExisting !== undefined) {
                            if (foundIndex !== -1) {
                                currentState.splice(foundIndex, 1);
                            }
                            return foundExisting;
                        } else {
                            return page;
                        }
                    });
                }
                // need to update project
                return Project.updateOne({
                    projectID: projectData.projectID
                }, {
                    $set: {
                        a11yReview: pageObjs
                    }
                });
            } else {
                // no pages, don't need to update
                return {};
            }
        } else {
            throw (new Error('notoc')); // handle as generic error below
        }
    }).then((updateRes) => {
        let resMsg = 'No pages found to import.';
        if (Object.keys(updateRes).length > 0) { // update performed
            if (updateRes.modifiedCount === 1) {
                if (req.body.merge === true) {
                    resMsg = 'LibreText sections successfully imported and merged.';
                } else {
                    resMsg = 'LibreText sections successfully imported.';
                }
            } else {
                throw (new Error('updatefail')); // handle as generic error below
            }
        }
        return res.send({
            err: false,
            projectID: projectData.projectID,
            msg: resMsg
        });
    }).catch((err) => {
        debugError(err);
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'bookid') errMsg = conductorErrors.err28;
        else if (err.message === 'privateresource') errMsg = conductorErrors.err29;
        else if (err.message === 'tocretrieve') errMsg = conductorErrors.err22;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Generates new Projects from a batch of Books, typically newly-imported.
 * @param {Object[]} newBooks - The newly imported Book information objects.
 * @returns {Promise<Number|Boolean>} Number of newly created Projects, or false if error encountered.
 */
const autoGenerateProjects = (newBooks) => {
    let projLead = '';
    let notifEmails = [];
    let numCreated = 0;
    let newProjects = [];
    let newProjectsDbIds = [];
    return Promise.try(() => {
        if (Array.isArray(newBooks) && newBooks.length > 0) {
            return Organization.findOne({ orgID: 'libretexts' }, {
                _id: 0,
                defaultProjectLead: 1
            }).lean();
        } else {
            throw (new Error('nobooks'));
        }
    }).then((libreOrg) => {
        if (
            libreOrg
            && typeof (libreOrg.defaultProjectLead) === 'string'
            && libreOrg.defaultProjectLead.length > 0
        ) {
            projLead = libreOrg.defaultProjectLead;
            let infoRequests = [];
            newBooks.forEach((book) => {
                if (typeof (book.url) === 'string' && book.url.length > 0) {
                    infoRequests.push(getLibreTextInformation(book.url));
                }
            });
            return Promise.all(infoRequests);
        } else {
            throw (new Error('leadnotfound'));
        }
    }).then((bookInfoRes) => {
        newBooks.forEach((book) => {
            let newProj = {
                orgID: 'libretexts',
                projectID: b62(10),
                title: book.title,
                status: 'completed',
                visibility: 'public',
                currentProgress: 100,
                classification: 'curation',
                projectURL: book.url,
                leads: [projLead],
                liaisons: [],
                members: [],
                auditors: [],
                tags: [],
                libreLibrary: book.library,
                libreCoverID: book.coverID
            };
            if (typeof (book.author) === 'string' && book.author.length > 0) newProj.author = book.author;
            if (Array.isArray(bookInfoRes)) {
                let foundInfo = bookInfoRes.find((infoObj) => (
                    infoObj.lib === book.library && infoObj.id === book.coverID
                ));
                if (foundInfo !== undefined) {
                    if (foundInfo.hasOwnProperty('shelf') && foundInfo.shelf !== '') {
                        newProj.libreShelf = foundInfo.shelf;
                    } else if (foundInfo.hasOwnProperty('campus') && foundInfo.campus !== '') {
                        newProj.libreCampus = foundInfo.campus;
                    }
                }
            }
            newProjects.push(newProj);
        });
        return Project.insertMany(newProjects, {
            ordered: false,
            rawResult: true
        });
    }).then((createRes) => {
        if (createRes) {
            if (typeof (createRes.insertedCount) === 'number') numCreated = createRes.insertedCount;
            if (typeof (createRes.insertedIds) === 'object') {
                Object.keys(createRes.insertedIds).forEach((key) => {
                    newProjectsDbIds.push(createRes.insertedIds[key]);
                });
            }
            return authAPI.getUserBasicWithEmail(projLead); // get Default Lead's email
        } else {
            throw (new Error('createfail'));
        }
    }).then((defaultLeadInfo) => {
        if (Array.isArray(defaultLeadInfo) && defaultLeadInfo.length === 1) {
            if (typeof (defaultLeadInfo[0].email) === 'string') {
                notifEmails.push(defaultLeadInfo[0].email);
            }
        }
        return authAPI.getLibreTextsAdmins(true); // attempt to notify other LibreTexts Admins
    }).then((libreAdmins) => {
        if (Array.isArray(libreAdmins) && libreAdmins.length > 0) {
            libreAdmins.forEach((lAdmin) => {
                if (typeof (lAdmin.email) === 'string' && lAdmin.email.length > 0) {
                    if (notifEmails.indexOf(lAdmin.email) === -1) { // no duplicates
                        notifEmails.push(lAdmin.email);
                    }
                }
            });
        }
        if (notifEmails.length > 0 && process.env.NODE_ENV === 'production') {
            return mailAPI.sendAutogeneratedProjectsNotification(notifEmails, newProjects);
        } else {
            return null; // don't fail as long as projects were created
        }
    }).then(() => {
        // ignore return value of MailAPI call
        debugCommonsSync('Sent Autogenerated Projects Notification.');
        if (newProjectsDbIds.length > 0) {
            return alertsAPI.processInstantProjectAlerts(newProjectsDbIds);
        }
        return true;
    }).then(() => {
        // ignore return value of processing Alerts
        return numCreated;
    }).catch((err) => {
        debugError(err);
        if (err.message === 'nobooks') {
            return 0;
        } else if (err.status === 400) {
            // MailAPI error
            return numCreated;
        } else {
            return false;
        }
    });
};

/**
 * Multer handler to process and validate Book Materials uploads.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next middleware to call.
 * @returns {function} The Materials upload handler.
 */
 function materialUploadHandler(req, res, next) {
  const materialUploadConfig = multer({
    storage: materialsStorage,
    limits: {
      files: 10,
      fileSize: 25000000,
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes('/')) {
        return cb(new Error('filenameslash'), false);
      }
      return cb(null, true);
    },
  }).array('materials', 10);
  return materialUploadConfig(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        errMsg = conductorErrors.err60;
      }
      if (err.message === 'filenameslash') {
        errMsg = conductorErrors.err61;
      }
      return res.status(400).send({
        err: true,
        errMsg,
      });
    }
    return next();
  });
}

/**
 * Uploads Ancillary Materials for a Book linked to a Project to the corresponding folder
 * in S3 and updates the Materials list.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
 async function addProjectBookMaterials(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectMemberPermission(project, req.user);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    if (
      isEmptyString(project.projectURL)
      || isEmptyString(project.libreLibrary)
      || isEmptyString(project.libreCoverID)
    ) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    const bookID = `${project.libreLibrary}-${project.libreCoverID}`;
    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) {
      throw (new Error('retrieveerror'));
    }

    let parent = '';
    if (req.body.parentID && req.body.parentID !== '') {
      const foundParent = materials.find((obj) => obj.materialID === req.body.parentID);
      if (!foundParent || foundParent.storageType === 'file') {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err64,
        });
      }
      parent = req.body.parentID;
    }

    const storageClient = new S3Client(MATERIALS_S3_CLIENT_CONFIG);
    const providedFiles = Array.isArray(req.files) && req.files.length > 0;
    const materialEntries = [];

    if (providedFiles) { // Adding a file
      const uploadCommands = [];
      req.files.forEach((file) => {
        const newID = v4();
        const fileKey = assembleUrl([bookID, newID]);
        const contentType = file.mimetype || 'application/octet-stream';
        uploadCommands.push(new PutObjectCommand({
          Bucket: process.env.AWS_MATERIALS_BUCKET,
          Key: fileKey,
          Body: file.buffer,
          ContentDisposition: `inline; filename=${file.originalname}`,
          ContentType: contentType,
        }));
        materialEntries.push({
          materialID: newID,
          name: file.originalname,
          access: 'public',
          size: file.size,
          createdBy: req.user.decoded.uuid,
          downloadCount: 0,
          storageType: 'file',
          parent,
        });
      });
      await async.eachLimit(uploadCommands, 2, async (command) => storageClient.send(command));
    } else { // Adding a folder
      if (!req.body.folderName) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err65,
        });
      }
      materialEntries.push({
        materialID: v4(),
        name: req.body.folderName,
        size: 0,
        createdBy: req.user.decoded.uuid,
        storageType: 'folder',
        parent,
      });
    }

    const updated = [...materials, ...materialEntries];
    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Succesfully uploaded materials!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a download URL for a single Book Material linked to a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectBookMaterial(req, res) {
  try {
    const { projectID, materialID } = req.params;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    const downloadURL = await downloadBookMaterial(bookID, materialID, req);
    if (downloadURL === null) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    } else if (downloadURL === false) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    return res.send({
      err: false,
      msg: 'Successfully generated download link!',
      url: downloadURL,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of Ancillary Materials for a Book linked to a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
 async function getProjectBookMaterials(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectGeneralPermission(project, req.user.decoded.uuid);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }
    const materialID = req.params.materialID || '';

    const [materials, path] = await retrieveBookMaterials(bookID, materialID, true);
    if (!materials) { // error encountered
      throw (new Error('retrieveerror'));
    }

    return res.send({
      err: false,
      msg: 'Successfully retrieved materials!',
      path,
      materials,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Renames an Ancillary Material (for a Book linked to a Project).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
 async function renameProjectBookMaterial(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectMemberPermission(project, req.user);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    let newName = req.body.newName;
    const materialID = req.params.materialID;

    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = materials.find((obj) => obj.materialID === materialID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    /* Ensure file extension remains in new name */
    if (!newName.includes('.')) {
      const splitCurrName = foundObj.name.split('.');
      if (splitCurrName.length > 1) {
        const currExtension = splitCurrName[splitCurrName.length - 1];
        newName = `${newName}.${currExtension}`;
      }
    }

    const updated = materials.map((obj) => {
      if (obj.materialID === foundObj.materialID) {
        return {
          ...obj,
          name: newName,
        };
      }
      return obj;
    });

    if (foundObj.storageType === 'file') {
      const fileKey = `${bookID}/${materialID}`;
      const storageClient = new S3Client(MATERIALS_S3_CLIENT_CONFIG);
      const s3File = await storageClient.send(new GetObjectCommand({
        Bucket: process.env.AWS_MATERIALS_BUCKET,
        Key: fileKey,
      }));

      let newContentType = 'application/octet-stream';
      if (typeof (s3File.ContentType) === 'string' && s3File.ContentType !== newContentType) {
        newContentType = s3File.ContentType;
      }

      await storageClient.send(new CopyObjectCommand({
        Bucket: process.env.AWS_MATERIALS_BUCKET,
        CopySource: `${process.env.AWS_MATERIALS_BUCKET}/${fileKey}`,
        Key: fileKey,
        ContentDisposition: `inline; filename=${newName}`,
        ContentType: newContentType,
        MetadataDirective: "REPLACE",
      }));
    }

    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully renamed material!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates the access/visibility setting of an Ancillary Material (for a Book linked to a Project).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgiong response object.
 */
async function updateProjectBookMaterialAccess(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectMemberPermission(project, req.user);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) {
      throw (new Error('retrieveerror'));
    }

    const materialID = req.params.materialID;
    const newAccess = req.body.newAccess;
    const foundObj = materials.find((obj) => obj.materialID === materialID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }
    if (foundObj.storageType !== 'file') {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }

    const updated = materials.map((obj) => {
      if (obj.materialID === materialID) {
        return {
          ...obj,
          access: newAccess,
        };
      }
      return obj;
    });

    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated material access setting!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Moves an Ancillary Material to a new parent (for a Book linked to a Project).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object. 
 */
async function moveProjectBookMaterial(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectMemberPermission(project, req.user);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    const newParentID = req.body.newParent;
    const materialID = req.params.materialID;
    let newParentIsRoot = false;
    if (newParentID === '') {
      newParentIsRoot = true;
    } 

    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = materials.find((obj) => obj.materialID === materialID);
    let foundNewParent = null;
    if (!newParentIsRoot) {
      foundNewParent = materials.find((obj) => obj.materialID === newParentID);
    }
    if (!foundObj || (!newParentIsRoot && !foundNewParent)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    if (
      materialID === newParentID
      || (!newParentIsRoot && foundNewParent.storageType === 'file')
    ) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err66,
      });
    }

    const updated = materials.map((obj) => {
      if (obj.materialID === materialID) {
        return {
          ...obj,
          parent: newParentID,
        };
      }
      return obj;
    });

    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully moved material!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Deletes an Ancillary Material (for a Book linked to a Project) in S3 and updates the Materials
 * list. Multiple materials can be deleted by specifying a folder identifier.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
 async function removeProjectBookMaterial(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasPermission = checkProjectMemberPermission(project, req.user);
    if (!hasPermission) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookID = getBookLinkedToProject(project);
    if (!bookID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err28,
      });
    }

    const materialID = req.params.materialID;
    const materials = await retrieveAllBookMaterials(bookID);
    if (!materials) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = materials.find((obj) => obj.materialID === materialID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    const objsToDelete = [];

    const findChildObjectsRecursive = (parent = null) =>  {
      materials.forEach((obj) => {
        if (parent && obj.parent === parent) {
          if (obj.storageType === 'folder') {
            findChildObjectsRecursive(obj.materialID);
          }
          objsToDelete.push(obj);
        }
      });
    };

    objsToDelete.push(foundObj);
    if (foundObj.storageType === 'folder') {
      findChildObjectsRecursive(foundObj.materialID);
    }

    const objectIDs = objsToDelete.map((obj) => obj.materialID);
    const filesToDelete = objsToDelete.map((obj) => {
      if (obj.storageType === 'file') {
        return {
          Key: `${bookID}/${obj.materialID}`,
        };
      }
      return null;
    }).filter((obj) => obj !== null);

    if (filesToDelete.length > 0) {
      const storageClient = new S3Client(MATERIALS_S3_CLIENT_CONFIG);
      const deleteRes = await storageClient.send(new DeleteObjectsCommand({
        Bucket: process.env.AWS_MATERIALS_BUCKET,
        Delete: {
          Objects: filesToDelete,
        }
      }));
      if (Array.isArray(deleteRes.Errors) && deleteRes.Errors.length > 0) {
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err58,
        });
      }
    }

    const updated = materials.map((obj) => {
      if (objectIDs.includes(obj.materialID)) {
        return null;
      }
      return obj;
    }).filter((obj) => obj !== null);

    const bookUpdate = await updateBookMaterials(bookID, updated);
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: `Successfully deleted materials!`,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves the LibreTexts standard identifier of the resource linked to a Project.
 * 
 * @param {object} project - Project information object.
 * @returns {string|null} The linked Book identifier, or null if no book is linked.
 */
function getBookLinkedToProject(project) {
  if (
    isEmptyString(project.projectURL)
    || isEmptyString(project.libreLibrary)
    || isEmptyString(project.libreCoverID)
  ) {
    return null;
  }
  return `${project.libreLibrary}-${project.libreCoverID}`;
}


/**
 * Checks if a user has permission to perform general actions on or view a
 * project.
 * @param {Object} project          - the project data object
 * @param {Object} user             - the current user context
 * @returns {Boolean} true if user has permission, false otherwise
 */
const checkProjectGeneralPermission = (project, user) => {
    /* Get Project Team and extract user UUID */
    let projTeam = constructProjectTeam(project);
    let userUUID = '';
    if (typeof (user) === 'string') userUUID = user;
    else if (typeof (user) === 'object') {
        if (user.uuid !== undefined) userUUID = user.uuid;
        else if (user.decoded?.uuid !== undefined) userUUID = user.decoded.uuid
    }
    /* Check user has permission */
    if (project.visibility === 'public' || project.status === 'available') {
        return true; // project is public
    }
    if (userUUID !== '') {
        let foundUser = projTeam.find((item) => {
            if (typeof (item) === 'string') {
                return item === userUUID;
            } else if (typeof (item) === 'object') {
                return item.uuid === userUUID;
            }
            return false;
        });
        if (foundUser !== undefined) {
            return true; // user is in the project team
        } else {
            // check if user is a SuperAdmin
            return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
        }
    }
    return false;
};


/**
 * Checks if a user has permission to perform member-only actions on a Project.
 * @param {Object} project - the project data object
 * @param {Object|String} user - the current user context
 * @return {Boolean} true if user has permission, false otherwise
 */
const checkProjectMemberPermission = (project, user) => {
    /* Get Project Team and extract user UUID */
    let projTeam = constructProjectTeam(project);
    let userUUID = '';
    if (typeof (user) === 'string') userUUID = user;
    else if (typeof (user) === 'object') {
        if (user.uuid !== undefined) userUUID = user.uuid;
        else if (user.decoded?.uuid !== undefined) userUUID = user.decoded.uuid;
    }
    /* Check user has permission */
    if (userUUID !== '') {
        const foundUser = projTeam.find((item) => {
            if (typeof (item) === 'string') {
                return item === userUUID;
            } else if (typeof (item) === 'object') {
                return item.uuid === userUUID;
            }
            return false;
        });
        if (foundUser !== undefined) {
            return true; // user is in the project team
        } else {
            // check if user is a SuperAdmin
            return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
        }
    }
    return false;
};


/**
 * Checks if a user has permission to perform high-level actions on a Project.
 * @param {Object} project - the project data object
 * @param {Object|String} user - the current user context 
 * @returns {Boolean} true if user has permission, false otherwise
 */
const checkProjectAdminPermission = (project, user) => {
    /* Construct Project Admins and extract user UUID */
    let projAdmins = [];
    let userUUID = '';
    if (typeof (user) === 'string') userUUID = user;
    else if (typeof (user) === 'object') {
        if (user.uuid !== undefined) userUUID = user.uuid;
        else if (user.decoded?.uuid !== undefined) userUUID = user.decoded.uuid;
    }
    if (typeof (project.leads) !== 'undefined' && Array.isArray(project.leads)) {
        projAdmins = [...projAdmins, ...project.leads];
    }
    if (typeof (project.liaisons) !== 'undefined' && Array.isArray(project.liaisons)) {
        projAdmins = [...projAdmins, ...project.liaisons];
    }
    /* Check user has permission */
    if (userUUID !== '') {
        let foundUser = projAdmins.find((item) => {
            if (typeof (item) === 'string') {
                return item === userUUID;
            } else if (typeof (item) === 'object') {
                return item.uuid === userUUID;
            }
            return false;
        });
        if (foundUser !== undefined) {
            return true; // user is a project admin
        } else {
            // check if user is a SuperAdmin
            return authAPI.checkHasRole(user, 'libretexts', 'superadmin');
        }
    }
    return false;
};


/**
 * Construct an array of users in a project's team, with optional exclusion(s).
 * @param {Object} project - The Project data object.
 * @param {String|String[]} [exclude] - The UUID(s) to exclude from the array.
 * @returns {String[]} The UUIDs of the project team members.
 */
const constructProjectTeam = (project, exclude) => {
    let projTeam = [];
    if (typeof (project.leads) !== 'undefined' && Array.isArray(project.leads)) {
        projTeam = [...projTeam, ...project.leads];
    }
    if (typeof (project.liaisons) !== 'undefined' && Array.isArray(project.liaisons)) {
        projTeam = [...projTeam, ...project.liaisons];
    }
    if (typeof (project.members) !== 'undefined' && Array.isArray(project.members)) {
        projTeam = [...projTeam, ...project.members];
    }
    if (typeof (project.auditors) !== 'undefined' && Array.isArray(project.auditors)) {
        projTeam = [...projTeam, ...project.auditors];
    }
    if (typeof (exclude) !== 'undefined') {
        projTeam = projTeam.filter((item) => {
            if (typeof (exclude) === 'string') {
                if (typeof (item) === 'string') {
                    return item !== exclude;
                } else if (typeof (item) === 'object') {
                    return item.uuid !== exclude;
                }
            } else if (typeof (exclude) === 'object' && Array.isArray(exclude)) {
                if (typeof (item) === 'string') {
                    return !exclude.includes(item);
                } else if (typeof (item) === 'object' && typeof (item.uuid) !== 'undefined') {
                    return !exclude.includes(item.uuid);
                }
            }
            return false;
        });
    }
    return projTeam;
};


/**
 * Constructs an array containing filters to ensure a user is a Project team member
 * during Project aggregation/querying.
 * @param {string} uuid - The UUID to query on.
 * @returns {object[]} An array of team member filters as objects.
 */
const constructProjectTeamMemberQuery = (uuid) => {
    if (typeof (uuid) === 'string' && uuid.trim().length > 0) {
        return [
            { leads: uuid },
            { liaisons: uuid },
            { members: uuid },
            { auditors: uuid }
        ];
    }
    throw (new Error('uuid')); // for security, do not allow unrestricted aggregation
};


/**
 * Validate a provided Project Visibility option.
 * @param {string} visibility - The visibility option to validate.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateVisibility = (visibility) => {
    if (typeof (visibility) === 'string') {
        return projectVisibilityOptions.includes(visibility);
    }
    return false;
}


/**
 * Validate a provided Project Status option during creation.
 * @deprecated
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateCreateStatus = (status) => {
    if ((status === 'available') || (status === 'open')) return true;
    return false;
};


/**
 * Validate a provided Project Status.
 * @param {string} status - The status classifier to validate.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateProjectStatus = (status) => {
    if (typeof (status) === 'string') {
        return projectStatusOptions.includes(status);
    }
    return false;
};


/**
 * Validate a provided Thread Kind.
 * @deprecated
 * @returns {Boolean} true if valid Kind, false otherwise.
 */
const validateThreadKind = (kind) => {
    if (kind.length > 0) {
        if ((kind === 'project') || (kind === 'a11y') || (kind === 'peerreview')) return true;
    }
    return false;
};


/**
 * Validate a provided Project Flagging Group.
 * @returns {Boolean} true if valid Group, false otherwise.
 */
const validateFlaggingGroup = (group) => {
    if (group.length > 0) {
        return ['libretexts', 'campusadmin', 'liaison', 'lead'].includes(group);
    }
    return false;
};

/**
 * Validate a provided Project role title.
 * @param {String} role 
 * @returns {Boolean} true if valid role, false otherwise.
 */
const validateProjectRole = (role) => {
    if (typeof (role) === 'string' && role.length > 0) {
        return ['lead', 'liaison', 'member', 'auditor'].includes(role);
    }
    return false;
};

/**
 * Validates a provided Book Ancillary Material access/visibility setting.
 *
 * @param {string} access - The setting identifier to validate. 
 * @returns {boolean} True if valid role, false otherwise. 
 */
const validateMaterialAccessSetting = (access) => {
  return ['public', 'users'].includes(access);
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
          body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateProjectStatus),
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
          body('peerProgress', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 0, max: 100, allow_leading_zeroes: false }),
          body('a11yProgress', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 0, max: 100, allow_leading_zeroes: false }),
          body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateProjectStatus),
          body('classification', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectClassification),
          body('visibility', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateVisibility),
          body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
          body('allowAnonPR', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('preferredPRRubric', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail(),
          body('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
          body('resourceURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
          body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('rdmpReqRemix', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('rdmpCurrentStep', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateRoadmapStep)
      ]
    case 'getProject':
      return [
          query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'getUserProjectsAdmin':
      return [
          query('uuid', conductorErrors.err1).exists().isString().isUUID()
      ]
    case 'getAddableMembers':
      return [
          query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'addMemberToProject':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('uuid', conductorErrors.err1).exists().isString().isUUID()
      ]
    case 'changeMemberRole':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('uuid', conductorErrors.err1).exists().isString().isUUID(),
          body('newRole', conductorErrors.err1).exists().isString().custom(validateProjectRole)
      ]
    case 'removeMemberFromProject':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('uuid', conductorErrors.err1).exists().isString().isUUID()
      ]
    case 'flagProject':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('flagOption', conductorErrors.err1).exists().isString().custom(validateFlaggingGroup),
          body('flagDescrip', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ max: 2000 })
      ]
    case 'clearProjectFlag':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'getProjectPinStatus':
      return [
          query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'pinProject':
      return [
        body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
      ]
    case 'unpinProject':
      return [
        body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
      ]
    case 'createA11YReviewSection':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('sectionTitle', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 150 })
      ]
    case 'getA11YReviewSections':
      return [
          query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'updateA11YReviewSectionItem':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('sectionID', conductorErrors.err1).exists().isMongoId(),
          body('itemName', conductorErrors.err1).exists().isString().custom(validateA11YReviewSectionItem),
          body('newResponse', conductorErrors.err1).exists().isBoolean().toBoolean()
      ]
    case 'requestProjectPublishing':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
      ]
    case 'importA11YSectionsFromTOC':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('merge', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
      ]
    case 'addProjectBookMaterials':
      return [
        param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
        body('parentID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
        body('folderName', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 100 }),
      ]
    case 'getProjectBookMaterial':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
      ]
    case 'getProjectBookMaterials':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
      ]
    case 'renameProjectBookMaterial':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).exists().isUUID(),
        body('newName', conductorErrors.err1).exists().isLength({ min: 1, max: 100 }),
      ]
    case 'updateProjectBookMaterialAccess':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).exists().isUUID(),
        body('newAccess', conductorErrors.err1).exists().isString().custom(validateMaterialAccessSetting),
      ]
    case 'moveProjectBookMaterial':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).exists().isUUID(),
        body('newParent', conductorErrors.err1).exists().isString(),
      ]
    case 'removeProjectBookMaterial':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('materialID', conductorErrors.err1).exists().isUUID(),
      ]
  }
};

export default {
    projectStatusOptions,
    projectVisibilityOptions,
    createProject,
    deleteProject,
    getProject,
    updateProject,
    getUserProjects,
    getUserProjectsAdmin,
    getUserFlaggedProjects,
    getUserPinnedProjects,
    getRecentProjects,
    getAvailableProjects,
    getCompletedProjects,
    getProjectsUnderDevelopment,
    getAddableMembers,
    addMemberToProject,
    changeMemberRole,
    removeMemberFromProject,
    flagProject,
    clearProjectFlag,
    getProjectPinStatus,
    pinProject,
    unpinProject,
    notifyProjectCompleted,
    getOrgTags,
    requestProjectPublishing,
    createA11YReviewSection,
    getA11YReviewSections,
    updateA11YReviewSectionItem,
    importA11YSectionsFromTOC,
    autoGenerateProjects,
    materialUploadHandler,
    addProjectBookMaterials,
    getProjectBookMaterial,
    getProjectBookMaterials,
    renameProjectBookMaterial,
    updateProjectBookMaterialAccess,
    moveProjectBookMaterial,
    removeProjectBookMaterial,
    checkProjectGeneralPermission,
    checkProjectMemberPermission,
    checkProjectAdminPermission,
    constructProjectTeam,
    constructProjectTeamMemberQuery,
    validate
}
