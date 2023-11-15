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
import Book from '../models/book.js';
import Tag from '../models/tag.js';
import Task from '../models/task.js';
import Thread from '../models/thread.js';
import Message from '../models/message.js';
import HarvestingRequest from '../models/harvestingrequest.js';
import Organization from '../models/organization.js';
import CIDDescriptor from '../models/ciddescriptor.js';
import conductorErrors from '../conductor-errors.js';
import { debugError, debugCommonsSync } from '../debug.js';
import {
    validateProjectClassification,
    validateRoadmapStep,
    getLibreTextInformation,
    progressThreadDefaultMessage,
    projectWelcomeMessage,
    retrieveAllProjectFiles,
    retrieveProjectFiles,
    PROJECT_FILES_S3_CLIENT_CONFIG,
    updateProjectFiles,
    downloadProjectFiles,
    computeStructureAccessSettings,
    checkIfBookLinkedToProject,
    isFileInterfaceAccess,
    generateZIPFile,
    retrieveSingleProjectFile,
} from '../util/projectutils.js';
import {
  checkBookIDFormat,
  isValidLicense,
  getBookTOCFromAPI,
} from '../util/bookutils.js';
import { validateA11YReviewSectionItem } from '../util/a11yreviewutils.js';
import { isEmptyString, assembleUrl } from '../util/helpers.js';
import { libraryNameKeys } from '../util/librariesmap.js';
import authAPI from './auth.js';
import mailAPI from './mail.js';
import usersAPI from './users.js';
import alertsAPI from './alerts.js';
import { upsertAssetTags, validateAssetTagArray } from './assettagging.js';
import fse from 'fs-extra';
import * as MiscValidators from './validators/misc.js';
import { conductor404Err } from '../util/errorutils.js';

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

const filesStorage = multer.memoryStorage();

/**
 * Creates a new, empty Project within the current Organization.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
async function createProject(req, res) {
  try {
    const { title, visibility } = req.body;
    const newProjData = {
      title,
      visibility,
      orgID: process.env.ORG_ID,
      projectID: b62(10),
      status: 'open',
      leads: [req.user.decoded.uuid],
    };
    const newProject = await new Project(newProjData).save();

    // Create default Threads
    const welcomeThreadID = b62(14);
    const progressThreadID = b62(14);
    const defaultThreads = [{
        threadID: welcomeThreadID,
        project: newProject.projectID,
        title: 'Welcome',
        kind: 'project',
        createdBy: process.env.CONDUCTOR_SYSTEM_UUID,
      }, {
        threadID: progressThreadID,
        project: newProject.projectID,
        title: 'Progress',
        kind: 'project',
        createdBy: process.env.CONDUCTOR_SYSTEM_UUID,
    }];
    await Thread.insertMany(defaultThreads);

    // Create default Messages
    const defaultMessages = [{
      messageID: b62(15),
      thread: welcomeThreadID,
      body: projectWelcomeMessage,
      author: process.env.CONDUCTOR_SYSTEM_UUID,
    }, {
      messageID: b62(15),
      thread: progressThreadID,
      body: progressThreadDefaultMessage,
      author: process.env.CONDUCTOR_SYSTEM_UUID,
    }];
    await Message.insertMany(defaultMessages);

    return res.send({
      err: false,
      msg: 'New project created!',
      projectID: newProject.projectID,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Deletes the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteProject'
 * @param {express.Request} req - the express.js request object.
 * @param {express.Response} res - the express.js response object.
 */
async function deleteProject(req, res) {
  try {
    const project = await Project.findOne({ projectID: req.params.projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (!checkProjectAdminPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const deleteRes = await Project.deleteOne({ projectID: req.params.projectID });
    if (deleteRes.deletedCount !== 1) {
      throw new Error('not deleted');
    }

    return res.send({
      err: false,
      msg: 'Successfully deleted project.',
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
 * Retrieves information about the Project identified by the projectID in
 * the request query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProject'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProject(req, res) {
  try {
    const projects = await Project.aggregate([
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
        $lookup: {
          from: 'books',
          let: {
            library: '$libreLibrary',
            pageID: '$libreCoverID',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$$library', ''] },
                        { $ne: ['$$pageID', ''] }
                      ],
                    },
                    {
                      $eq: ['$bookID', {
                        $concat: ['$$library', '-', '$$pageID'],
                      }],
                    },
                    {
                      $eq: ['$bookID', false] // empty lookup
                    },
                  ]
                }
              }
            }, {
              $project: {
                _id: 0,
                bookID: 1,
              }
            }
          ],
          as: 'hasCommonsBook',
        }
      }, {
        $addFields: {
          hasCommonsBook: {
            $cond: [
              {
                $gt: [
                  { $size: '$hasCommonsBook' },
                  0
                ]
              },
              true,
              false,
            ],
          },
        },
      }, {
        $project: {
          _id: 0
        }
      }
    ]);
    if (!projects.length > 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    const projResult = projects[0];

    /* check permission */
    if (!checkProjectGeneralPermission(projResult, req.user)) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    /* process tags */
    if (Array.isArray(projResult.tagResults)) {
      projResult.tags = projResult.tagResults.map((result) => result.title);
    } else {
      projResult.tags = [];
    }
    delete projResult.tagResults; // prune lookup results
    
    return res.send({
      err: false,
      project: projResult,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};


/**
 * Updates the Project identified by the projectID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProject'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateProject(req, res) {
  try {
    const libNames = libraryNameKeys.join('|');
    const libreURLRegex = new RegExp(`(http(s)?:\/\/)?(${libNames}).libretexts.org\/`, 'i');
    const { projectID } = req.body;
    let updateObj = {};
    let sendCompleted = false;
    
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (!checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    async function resolveTags(tagArr) {
      if (tagArr.length > 0) {
        const tagBulkInsert = [];
        const newTagIDs = [];
        const orgTags = await Tag.aggregate([
          {
            $match: {
              $and: [
                { orgID: process.env.ORG_ID },
                { title: { $in: tagArr } },
              ],
            },
          },
        ]);
        tagArr.forEach((tagItem) => {
          const foundTag = orgTags.find((oTag) => oTag.title === tagItem);
          if (foundTag) {
            newTagIDs.push(foundTag.tagID);
          } else {
            const newID = b62(12);
            tagBulkInsert.push({
              orgID: process.env.ORG_ID,
              tagID: newID,
              title: tagItem,
            });
            newTagIDs.push(newID);
          }
        });
        if (newTagIDs.length > 0 && tagBulkInsert.length > 0) {
          Tag.insertMany(tagBulkInsert, { ordered: false }); // insert new tags
        }
        return newTagIDs;
      }
      return []; // tags removed
    };

    if (req.body.title && req.body.title !== project.title) {
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
    if (req.body.status && req.body.status !== project.status) {
      updateObj.status = req.body.status;
      /* only send notification on first change to complete */
      sendCompleted = req.body.status === 'completed' && project.status !== 'completed';
    }
    if (req.body.visibility && req.body.visibility !== project.visibility) {
      updateObj.visibility = req.body.visibility;
    }
    if (req.body.classification && req.body.classification !== project.classification) {
      updateObj.classification = req.body.classification;
    }
    if (req.body.hasOwnProperty('projectURL') && req.body.projectURL !== project.projectURL) {
      /* If the Project URL is a LibreTexts link, gather more information */
      updateObj.projectURL = req.body.projectURL;
      if (libreURLRegex.test(req.body.projectURL)) {
        const projURLInfo = await getLibreTextInformation(
          updateObj.projectURL.toString()
        );
        if (
          !projURLInfo.lib ||
          !projURLInfo.hasOwnProperty("id") ||
          projURLInfo.lib == "" ||
          projURLInfo.id == ""
        ) {
          throw new Error("Error checking for LibreTexts book");
        }

        const otherProject = await checkIfBookLinkedToProject(
          projURLInfo.lib,
          projURLInfo.id
        );

        if (otherProject) {
          return res.status(409).send({
            err: true,
            errMsg: conductorErrors.err80,
            projectID: `${
              typeof otherProject === "string" ? otherProject : ""
            }`,
          });
        }

        if (projURLInfo.lib && projURLInfo.lib !== "") {
          updateObj.libreLibrary = projURLInfo.lib;
        }
        if (projURLInfo.hasOwnProperty("id") && projURLInfo.id !== "") {
          updateObj.libreCoverID = projURLInfo.id;
        }
        if (projURLInfo.shelf && projURLInfo.shelf !== "") {
          updateObj.libreShelf = projURLInfo.shelf;
        } else if (projURLInfo.campus && projURLInfo.campus !== "") {
          updateObj.libreCampus = projURLInfo.campus;
        }
      } else {
        // Clear values if projectUrl is being updated to non-LibreTexts URL
        updateObj.libreLibrary = "";
        updateObj.libreShelf = "";
        updateObj.libreCampus = "";
      }
    }
    if (req.body.hasOwnProperty('adaptURL') && req.body.adaptURL !== project.adaptURL) {
      if (req.body.adaptURL !== '') { // link
        const courseIDMatches = req.body.adaptURL.match(/[0-9]+/);
        if (courseIDMatches.length === 1) {
          updateObj.adaptCourseID = courseIDMatches[0];
        }
      } else { // unlink
        updateObj.adaptCourseID = '';
      }
      updateObj.adaptURL = req.body.adaptURL;
    }
    if (req.body.hasOwnProperty('allowAnonPR') && req.body.allowAnonPR !== project.allowAnonPR) {
      updateObj.allowAnonPR = req.body.allowAnonPR;
    }
    if (req.body.preferredPRRubric && req.body.preferredPRRubric !== project.preferredPRRubric) {
      updateObj.preferredPRRubric = req.body.preferredPRRubric;
    }
    if (req.body.author && req.body.author !== project.author) {
      updateObj.author = req.body.author;
    }
    if (req.body.authorEmail && req.body.authorEmail !== project.authorEmail) {
      updateObj.authorEmail = req.body.authorEmail;
    }
    if (req.body.license && req.body.license !== project.license) {
      updateObj.license = req.body.license;
    }
    if (req.body.resourceURL && req.body.resourceURL !== project.resourceURL) {
      updateObj.resourceURL = req.body.resourceURL;
    }
    if (req.body.notes && req.body.notes !== project.notes) {
      updateObj.notes = req.body.notes;
    }
    if (req.body.hasOwnProperty('rdmpReqRemix') && req.body.rdmpReqRemix !== project.rdmpReqRemix) {
      updateObj.rdmpReqRemix = req.body.rdmpReqRemix;
    }
    if (req.body.rdmpCurrentStep && req.body.rdmpCurrentStep !== project.rdmpCurrentStep) {
      updateObj.rdmpCurrentStep = req.body.rdmpCurrentStep;
    }
    if (req.body.tags && Array.isArray(req.body.tags)) {
      updateObj.tags = await resolveTags(req.body.tags);
    }
    if (Array.isArray(req.body.cidDescriptors)) {
      updateObj.cidDescriptors = req.body.cidDescriptors;
    }

    if (Array.isArray(req.body.associatedOrgs)) {
      updateObj.associatedOrgs = req.body.associatedOrgs;
    }

    if (Object.keys(updateObj).length > 0) {
      const updateRes = await Project.updateOne({ projectID }, updateObj);
      if (updateRes.modifiedCount !== 1) {
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err3,
        });
      }
      if (sendCompleted) {
        notifyProjectCompleted(projectID);
      }
      return res.send({
        err: false,
        msg: 'Successfully updated project!',
      });
    } else {
      return res.send({
        err: false,
        msg: 'No changes to save.',
      });
    }
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  } 
};


/**
 * Retrieves a list of the requesting User's currently open projects.
 * @param {Object} req - the express.js request object
 * @param {Object} res - the express.js response object
 */
const getUserProjects = (req, res) => {
  const { searchQuery } = req.query;

  let matchObj = {};
  if (searchQuery) {
    const parsedSearch = searchQuery.toString().toLowerCase();
    matchObj = {
      $and: [
        {
          $text: {
            $search: parsedSearch,
          },
        },
        {
          $or: constructProjectTeamMemberQuery(req.decoded.uuid),
        },
        {
          status: {
            $ne: "completed",
          },
        },
      ],
    };
  } else {
    matchObj = {
      $and: [
        {
          $or: constructProjectTeamMemberQuery(req.decoded.uuid),
        },
        {
          status: {
            $ne: "completed",
          },
        },
      ],
    };
  }

  Project.aggregate([
    {
      $match: { ...matchObj },
    },
    {
      $lookup: {
        from: "users",
        let: {
          leads: "$leads",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$uuid", "$$leads"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          },
        ],
        as: "leads",
      },
    },
    {
      $sort: {
        title: 1,
      },
    },
    {
      $project: projectListingProjection,
    },
  ])
    .then((projects) => {
      return res.send({
        err: false,
        projects: projects,
      });
    })
    .catch((err) => {
      debugError(err);
      return res.send({
        err: false,
        errMsg: conductorErrors.err6,
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
            $or: constructProjectTeamMemberQuery(req.query.uuid),
          },
          {
            status: {
              $ne: "completed",
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        let: {
          leads: "$leads",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$uuid", "$$leads"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          },
        ],
        as: "leads",
      },
    },
    {
      $sort: {
        title: -1,
      },
    },
    {
      $project: projectListingProjection,
    },
  ])
    .then((projects) => {
      return res.send({
        err: false,
        uuid: req.query.uuid,
        projects: projects,
      });
    })
    .catch((err) => {
      debugError(err);
      return res.send({
        err: false,
        errMsg: conductorErrors.err6,
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
 * Retrieves a list of Users that can be added to a Project team.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
async function getAddableMembers(req, res) {
  try {
    const { projectID } = req.params;
    const { search } = req.query;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    /* Check user has permission to add team members */
    if (!checkProjectAdminPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const existing = constructProjectTeam(project); // don't include existing team members

    let matchObj = {};
    if (search) {
      const parsedSearch = search.toString().toLowerCase();
      matchObj = {
        $and: [
          {
            $text: {
              $search: parsedSearch,
            },
          },
          { uuid: { $nin: existing } },
          { $expr: { $not: "$isSystem" } },
        ],
      };
    } else {
      matchObj = {
        $and: [
          { uuid: { $nin: existing } },
          { $expr: { $not: '$isSystem' } },
        ],
      };
    }

    const users = await User.aggregate([
      {
        $match: {...matchObj}
      }, {
        $project: {
          _id: 0,
          uuid: 1,
          firstName: 1,
          lastName: 1,
          avatar: 1,
        },
      }, {
        $sort: { firstName: -1 },
      },
    ]);

    return res.send({
      users,
      err: false,
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
 * Adds a User to the members list of a Project.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
async function addMemberToProject(req, res) {
  try {
    const { projectID } = req.params;
    const { uuid } = req.body;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!checkProjectAdminPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    // If user is already a member, return success
    const projectTeam = constructProjectTeam(project);
    if (projectTeam.includes(uuid)) {
      return res.send({
        err: false,
        msg: 'Successfully added user as team member!',
      });
    }
  
    const user = await User.findOne({ uuid }).lean();
    if (!user) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err7,
      });
    }

    const updateRes = await Project.updateOne(
      { projectID },
      { $addToSet: { members: uuid } },
    );
    if (updateRes.modifiedCount !== 1) {
      throw (new Error('Project update failed.'));
    }

    const updatedProject = await Project.findOne({ projectID });
    if (!updatedProject) {
      throw (new Error('Error finding updated project.'));
    }

    const updatedTeam = constructProjectTeam(updatedProject);
    const foundTeam = await User.find({'uuid': { $in: updatedTeam }}, '-_id email');
    if (!foundTeam) {
      throw (new Error('Error finding updated members.'));
    }
    const teamEmails = foundTeam.map((member) => member.email);
    await mailAPI.sendAddedAsMemberNotification(
      user.firstName,
      teamEmails,
      projectID,
      project.title,
    ).catch((e) => {
      debugError('Error sending Team Member Added notification email: ', e);
    });
      
    return res.send({
      err: false,
      msg: 'Successfully added user as team member!',
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
 * Retrieves a list of the Project's team members.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object. 
 */
async function getProjectTeam(req, res) {
  try {
    const { projectID } = req.params;
    const { combine, excludeCurrent } = req.query;
    const userProjection = {
      _id: 0,
      uuid: 1,
      firstName: 1,
      lastName: 1,
      avatar: 1,
    };
    const projects = await Project.aggregate([
      {
        $match: {
          projectID,
        },
      }, {
        $project: {
          _id: 0,
          projectID: 1,
          members: 1,
          leads: 1,
          liaisons: 1,
          auditors: 1,
        }
      }, {
        $lookup: {
          from: 'users',
          let: { members: '$members' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$uuid', '$$members'] },
              },
            }, {
              $project: userProjection,
            },
          ],
          as: 'members',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { leads: '$leads' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$uuid', '$$leads'] },
              },
            }, {
              $project: userProjection,
            },
          ],
          as: 'leads',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { liaisons: '$liaisons' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$uuid', '$$liaisons'] },
              },
            }, {
              $project: userProjection,
            },
          ],
          as: 'liaisons',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { auditors: '$auditors' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$uuid', '$$auditors'] },
              },
            }, {
              $project: userProjection,
            },
          ],
          as: 'auditors',
        },
      },
    ]);
    if (!projects.length > 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    const projectResult = projects[0];

    // check permission
    if (!checkProjectGeneralPermission(projectResult, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    let response = {
      err: false,
      projectID: projectResult.projectID,
    };

    let members = projectResult.members || [];
    let leads = projectResult.leads || [];
    let liaisons = projectResult.liaisons || [];
    let auditors = projectResult.auditors || [];

    const collator = new Intl.Collator();
    const sortTeamArray = (a, b) => {
      const aName = `${a.firstName} ${a.lastName}`;
      const bName = `${b.firstName} ${b.lastName}`;
      return collator.compare(aName, bName);
    };

    const filterCurrentUser = (item) => item.uuid !== req.user.decoded.uuid;

    if (excludeCurrent) {
      members = members.filter(filterCurrentUser);
      leads = leads.filter(filterCurrentUser);
      liaisons = liaisons.filter(filterCurrentUser);
      auditors = auditors.filter(filterCurrentUser)
    }

    if (!combine) {
      members.sort(sortTeamArray);
      leads.sort(sortTeamArray);
      liaisons.sort(sortTeamArray);
      auditors.sort(sortTeamArray);
      response = {
        ...response,
        members,
        leads,
        liaisons,
        auditors,
      };
    } else {
      const allTeam = [
        ...members.map((item) => ({ ...item, role: 'Member' })),
        ...leads.map((item) => ({ ...item, role: 'Lead' })),
        ...liaisons.map((item) => ({ ...item, role: 'Liaison' })),
        ...auditors.map((item) => ({ ...item, role: 'Auditor' })),
      ];
      allTeam.sort(sortTeamArray);
      response.team = allTeam;
    }

    return res.send(response);
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Changes a team member's role within a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function changeMemberRole(req, res) {
  try {
    const { projectID, uuid } = req.params;
    const { newRole } = req.body;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!checkProjectAdminPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    /* Construct current role listings, remove user, then add user to new role */
    let leads = [];
    let liaisons = [];
    let members = [];
    let auditors = [];
    if (Array.isArray(project.leads)) {
      leads = project.leads.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.liaisons)) {
      liaisons = project.liaisons.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.members)) {
      members = project.members.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.auditors)) {
      auditors = project.auditors.filter((item) => item !== uuid);
    }
    switch (newRole) {
      case 'lead':
        leads.push(uuid);
        break;
      case 'liaison':
        liaisons.push(uuid);
        break;
      case 'member':
        members.push(uuid);
        break;
      case 'auditor':
        auditors.push(uuid);
        break;
      default:
        throw (new Error('Unknown role identifier provided.'));
    }
    if (leads.length === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err44,
      });
    }

    const updateRes = await Project.updateOne({ projectID }, {
      leads,
      liaisons,
      members,
      auditors,
    });
    if (updateRes.modifiedCount !== 1) {
      throw (new Error('Project update failed.'));
    }

    return res.send({
      err: false,
      msg: 'Successfully changed team member role!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    })
  }
}

/**
 * Removes a team member from a Project.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
async function removeMemberFromProject(req, res) {
  try {
    const { projectID, uuid } = req.params;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (!checkProjectAdminPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      })
    }

    let leads = [];
    let liaisons = [];
    let members = [];
    let auditors = [];
    if (Array.isArray(project.leads)) {
      leads = project.leads.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.liaisons)) {
      liaisons = project.liaisons.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.members)) {
      members = project.members.filter((item) => item !== uuid);
    }
    if (Array.isArray(project.auditors)) {
      auditors = project.auditors.filter((item) => item !== uuid);
    }
    if (leads.length === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err44,
      });
    }

    const updateRes = await Project.updateOne({ projectID }, {
      leads,
      liaisons,
      members,
      auditors,
    });
    if (updateRes.modifiedCount !== 1) {
      throw (new Error('Project update failed.'));
    }

    await Task.updateMany({ projectID }, {
      $pull: {
        assignees: uuid,
      },
    }).catch((e) => debugError(e));

    return res.send({
      err: false,
      errMsg: 'Successfully removed team member from Project.',
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
 * Multer handler to process and validate Project File uploads.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next middleware to call.
 * @returns {function} The Project File upload handler.
 */
 function fileUploadHandler(req, res, next) {
  // If the 'file' is a URL, skip multer
  if(req.body.isURL && req.body.fileURL){
    return next();
  }
  const fileUploadConfig = multer({
    storage: filesStorage,
    limits: {
      files: 10,
      fileSize: 100000000,
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes('/')) {
        return cb(new Error('filenameslash'), false);
      }
      return cb(null, true);
    },
  }).array('files', 10);
  return fileUploadConfig(req, res, (err) => {
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
 * Uploads Files linked to a Project to the corresponding folder
 * in S3 and updates the Files list.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
 async function addProjectFile(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const files = await retrieveAllProjectFiles(projectID, false, req.user.decoded.uuid);
    if (!files) {
      throw (new Error('retrieveerror'));
    }

    let parent = '';
    let accessSetting = 'public'; // default
    if (req.body.parentID && req.body.parentID !== '') {
      const foundParent = files.find((obj) => obj.fileID === req.body.parentID);
      if (!foundParent || foundParent.storageType === 'file') {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err64,
        });
      }
      parent = req.body.parentID;
      if (foundParent.access !== 'mixed') {
        accessSetting = foundParent.access; // assume same setting as parent
      }
    }

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const providedFiles = Array.isArray(req.files) && req.files.length > 0;
    const fileEntries = [];

    if (providedFiles) { // Adding a file
      const uploadCommands = [];
      req.files.forEach((file) => {
        const newID = v4();
        const fileKey = assembleUrl([projectID, newID]);
        const contentType = file.mimetype || 'application/octet-stream';
        uploadCommands.push(new PutObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: fileKey,
          Body: file.buffer,
          ContentDisposition: `inline; filename=${file.originalname}`,
          ContentType: contentType,
        }));
        fileEntries.push({
          fileID: newID,
          name: file.originalname,
          access: accessSetting,
          size: file.size,
          createdBy: req.user.decoded.uuid,
          downloadCount: 0,
          storageType: 'file',
          parent,
        });
      });
      await async.eachLimit(uploadCommands, 2, async (command) => storageClient.send(command));
    } else if (req.body.isURL && req.body.fileURL) {
      // Adding a file from URL
      fileEntries.push({
        fileID: v4(),
        name: 'URL: ' + req.body.fileURL.toString(),
        isURL: true,
        url: req.body.fileURL,
        size: 0,
        createdBy: req.user.decoded.uuid,
        storageType: 'file',
        parent,
        access: accessSetting,
        license: {
          sourceURL: req.body.fileURL, // Set Source url as url
        }
      })
    } else {
      // Adding a folder
      if (!req.body.folderName) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err65,
        });
      }
      fileEntries.push({
        fileID: v4(),
        name: req.body.folderName,
        size: 0,
        createdBy: req.user.decoded.uuid,
        storageType: 'folder',
        parent,
        access: accessSetting
      });
    }

    const updated = [...files, ...fileEntries];
    const fileUpdate = await updateProjectFiles(projectID, updated);
    if (!fileUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Succesfully uploaded files!',
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
 * Retrieves a download URL for a single File linked to a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectFileDownloadURL(req, res) {
  try {
    const { projectID, fileID} = req.params;
    const { shouldIncrement = true } = req.query;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const downloadURLs = await downloadProjectFiles(projectID, [fileID], undefined, req.user.decoded.uuid, shouldIncrement);
    if (downloadURLs === null || !Array.isArray(downloadURLs) || downloadURLs.length === 0) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    return res.send({
      err: false,
      msg: 'Successfully generated download link!',
      url: downloadURLs[0], // Only first index because we only requested one file
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function bulkDownloadProjectFiles(req, res) {
  try {
    const { projectID } = req.params;
    const rawIds = req.query.fileIDs;
    const split = rawIds.split("&");
    const parsed = split.map((item) => item.split("=")[1]);
    const fileIDs = parsed.filter(
      (item) => item !== undefined && MiscValidators.isUUID(item)
    );

    if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err62,
      });
    }

    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const allFiles = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!allFiles) {
      throw new Error("retrieveerror");
    }

    const foundFiles = allFiles.filter((file) => fileIDs.includes(file.fileID));

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const downloadCommands = [];

    if (foundFiles.length > 0) {
      // create zip file
      foundFiles.forEach((file) => {
        const fileKey = assembleUrl([projectID, file.fileID]);
        downloadCommands.push(
          new GetObjectCommand({
            Bucket: process.env.AWS_PROJECTFILES_BUCKET,
            Key: fileKey,
          })
        );
      });
    } else {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    const items = [];
    const downloadRes = await Promise.all(
      downloadCommands.map((command) => storageClient.send(command))
    );

    for (let i = 0; i < downloadRes.length; i++) {
      const byteArray = await downloadRes[i].Body?.transformToByteArray();
      if (foundFiles[i]) {
        foundFiles[i].name = foundFiles[i].name;
        items.push({
          name: foundFiles[i].name,
          data: byteArray,
        });
      } else {
        items.push({
          name: v4(), // Fallback to random name
          data: byteArray,
        });
      }
    }

    const zipPath = await generateZIPFile(items);
    if (!zipPath) {
      throw new Error("ziperror");
    }

    //TODO: update download count

    return res.download(zipPath, `${projectID}.zip`, async (err) => {
      if(err) {
        throw new Error("downloaderror");
      }
      await fse.unlink(zipPath) // delete temp zip file
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
 * Retrieves the contents of a Project (Files/Assets) Folder.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
 async function getProjectFolderContents(req, res) {
  try {
    const projectID = req.params.projectID;
    const folderID = req.params.folderID || '';
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    if (!checkProjectGeneralPermission(project, req.user)) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [files, path] = await retrieveProjectFiles(projectID, folderID, undefined, req.user.decoded.uuid);
    if (!files) { // error encountered
      throw (new Error('retrieveerror'));
    }

    return res.send({
      err: false,
      msg: 'Successfully retrieved files!',
      files,
      path
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
 * Retrieves a single Project File/Folder.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectFile(req, res) {
  try {
    const { projectID, fileID } = req.params;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    if (!checkProjectGeneralPermission(project, req.user)) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [file, path] = await retrieveSingleProjectFile(projectID, fileID, undefined, req.user.decoded.uuid);
    if (!file) { // error encountered
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      msg: 'Successfully retrieved files!',
      file,
      path
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
 * Renames or updates the description of a Project File.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
 async function updateProjectFile(req, res) {
  try {
    const {projectID, fileID } = req.params;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const { name, description, license, author, publisher } = req.body;

    const files = await retrieveAllProjectFiles(projectID, false, req.user.decoded.uuid);
    if (!files) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    let processedName = name;
    if (processedName) {
      // Ensure file extension remains in new name
      if (!processedName.includes('.')) {
        const splitCurrName = foundObj.name.split('.');
        if (splitCurrName.length > 1) {
          const currExtension = splitCurrName[splitCurrName.length - 1];
          processedName = `${processedName}.${currExtension}`;
        }
      }
    }

    // update tags
    await upsertAssetTags(foundObj, req.body.tags);

    const updated = files.map((obj) => {
      if (obj.fileID === foundObj.fileID) {
        const updateObj = { ...obj };
        if (processedName) {
          updateObj.name = processedName;
        }
        if (typeof (description) === 'string') { // account for unsetting
          updateObj.description = description;
        }
        if (license) {
          updateObj.license = license;
        }
        if(author) {
          updateObj.author = author;
        }
        if(publisher) {
          updateObj.publisher = publisher;
        }
        return updateObj;
      }
      return obj;
    });

    if (foundObj.storageType === 'file' && !foundObj.isURL && !foundObj.url) {
      const fileKey = `${projectID}/${fileID}`;
      const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
      const s3File = await storageClient.send(new GetObjectCommand({
        Bucket: process.env.AWS_PROJECTFILES_BUCKET,
        Key: fileKey,
      }));

      let newContentType = 'application/octet-stream';
      if (typeof (s3File.ContentType) === 'string' && s3File.ContentType !== newContentType) {
        newContentType = s3File.ContentType;
      }

      await storageClient.send(new CopyObjectCommand({
        Bucket: process.env.AWS_PROJECTFILES_BUCKET,
        CopySource: `${process.env.AWS_PROJECTFILES_BUCKET}/${fileKey}`,
        Key: fileKey,
        ContentDisposition: `inline; filename=${processedName}`,
        ContentType: newContentType,
        MetadataDirective: "REPLACE",
      }));
    }

    const projectUpdate = await updateProjectFiles(projectID, updated);
    if (!projectUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated file!',
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
 * Updates the access/visibility setting of a Project File.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgiong response object.
 */
async function updateProjectFileAccess(req, res) {
  try {
    const {projectID, fileID} = req.params;
    const newAccess = req.body.newAccess;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const files = await retrieveAllProjectFiles(projectID, false, req.user.decoded.uuid);
    if (!files) {
      throw (new Error('retrieveerror'));
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    /* Update file and any children */
    const entriesToUpdate = [];

    const findChildEntriesToUpdate = (parentID) => {
      files.forEach((obj) => {
        if (obj.parent === parentID) {
          entriesToUpdate.push(obj);
          if (obj.storageType === 'folder') {
            findChildEntriesToUpdate(obj.fileID);
          }
        }
      });
    };

    entriesToUpdate.push(foundObj);
    if (foundObj.storageType === 'folder') {
      findChildEntriesToUpdate(foundObj.fileID);
    }

    let updated = files.map((obj) => {
      const foundUpdater = entriesToUpdate.find((upd) => upd.fileID === obj.fileID);
      if (foundUpdater) {
        return {
          ...obj,
          access: newAccess,
        }
      }
      return obj;
    });
    
    /* Recalculate access for all file system entries */
    updated = computeStructureAccessSettings(updated);

    /* Save updates */
    const projectUpdate = await updateProjectFiles(projectID, updated);
    if (!projectUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated file access setting!',
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
 * Moves a Project File to a new parent.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object. 
 */
async function moveProjectFile(req, res) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const newParentID = req.body.newParent;
    const fileID = req.params.fileID;
    let newParentIsRoot = false;
    if (newParentID === '') {
      newParentIsRoot = true;
    } 

    const files = await retrieveAllProjectFiles(projectID, false, req.user.decoded.uuid);
    if (!files) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    let foundNewParent = null;
    if (!newParentIsRoot) {
      foundNewParent = files.find((obj) => obj.fileID === newParentID);
    }
    if (!foundObj || (!newParentIsRoot && !foundNewParent)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    if (
      fileID === newParentID
      || (!newParentIsRoot && foundNewParent.storageType === 'file')
    ) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err66,
      });
    }

    let updated = files.map((obj) => {
      if (obj.fileID === fileID) {
        return {
          ...obj,
          parent: newParentID,
        };
      }
      return obj;
    });

    updated = computeStructureAccessSettings(updated);

    const projectUpdate = await updateProjectFiles(projectID, updated);
    if (!projectUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully moved file!',
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
 * Deletes a Project File in S3 and updates the Files
 * list. Multiple files  can be deleted by specifying a folder identifier.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
 async function removeProjectFile(req, res) {
  try {
    const projectID = req.params.projectID;
    const fileID = req.params.fileID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const files = await retrieveAllProjectFiles(projectID, false, req.user.decoded.uuid);
    if (!files) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    const objsToDelete = [];

    const findChildObjectsRecursive = (parent = null) =>  {
      files.forEach((obj) => {
        if (parent && obj.parent === parent) {
          if (obj.storageType === 'folder') {
            findChildObjectsRecursive(obj.fileID);
          }
          objsToDelete.push(obj);
        }
      });
    };

    objsToDelete.push(foundObj);
    if (foundObj.storageType === 'folder') {
      findChildObjectsRecursive(foundObj.fileID);
    }

    const objectIDs = objsToDelete.map((obj) => obj.fileID);
    const filesToDelete = objsToDelete.map((obj) => {
      if (obj.storageType === 'file') {
        return {
          Key: `${projectID}/${obj.fileID}`,
        };
      }
      return null;
    }).filter((obj) => obj !== null);

    if (filesToDelete.length > 0) {
      const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
      const deleteRes = await storageClient.send(new DeleteObjectsCommand({
        Bucket: process.env.AWS_PROJECTFILES_BUCKET,
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

    let updated = files.map((obj) => {
      if (objectIDs.includes(obj.fileID)) {
        return null;
      }
      return obj;
    }).filter((obj) => obj !== null);

    updated = computeStructureAccessSettings(updated);

    const projectUpdate = await updateProjectFiles(projectID, updated);
    if (!projectUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: `Successfully deleted files!`,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of Reader Resources for a Book linked to a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectBookReaderResources(req, res) {
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

    let readerResources = [];
    const bookRes = await Book.findOne({ bookID }).lean();
    if (bookRes.readerResources) readerResources = bookRes.readerResources;

    return res.send({
      err: false,
      msg: 'Successfully retrieved Reader Resources!',
      readerResources
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
 * Updates a collection of Reader Resources (for a Book linked to a Project).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateProjectBookReaderResources(req, res) {
  try {
    const newResources = req.body.readerResources;
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

    const bookRes = await Book.findOne({ bookID });
    if (!bookRes.readerResources) { // error encountered
      throw (new Error('retrieveerror'));
    }

    const bookUpdate = await Book.updateOne({ bookID }, { $set: { readerResources: newResources } });
    if (!bookUpdate) {
      throw (new Error('updatefail'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated Reader Resources!',
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
  const projTeam = constructProjectTeam(project);
  let userUUID = "";
  if (typeof user === "string") {
    userUUID = user;
  } else if (typeof user === "object") {
    if (user.uuid && typeof user.uuid === "string") {
      userUUID = user.uuid;
    } else if (user.decoded && user.decoded.uuid) {
      userUUID = user.decoded.uuid;
    }
  }

  /* Check user has permission */
  if (userUUID) {
    const foundUser = projTeam.find((item) => {
      if (typeof item === "string") {
        return item.toString() === userUUID.toString();
      } else if (typeof item === "object" && item.uuid !== undefined) {
        return item.uuid.toString() === userUUID.toString();
      }
    });

    if (!foundUser) {
      if (typeof user === "object") {
        // no user found in project team, check if user is a SuperAdmin
        return authAPI.checkHasRole(user, "libretexts", "superadmin");
      }
      return false;
    }
    
    return true;
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
 * Verifies that a provided ADAPT Course URL contains a Course ID number.
 *
 * @param {string} url - The course url to validate. 
 * @returns {boolean} True if valid course url, false otherwise.
 */
function validateADAPTCourseURL(url) {
  if (typeof (url) === 'string') {
    if (url.includes('/courses/')) { // link course
      return Array.isArray(url.match(/[0-9]+/));
    } else if (url === '') { // allow empty strings to unlink course
      return true;
    }
  }
  return false;
}

/**
 * Verifies that all provided C-ID Descriptors exist.
 *
 * @param {string[]} descriptors - The C-ID descriptors to attach to the Project.
 * @returns {Promise<void>} Resolves if all valid descriptors, rejects otherwise.
 */
async function validateCIDDescriptors(descriptors) {
  if (Array.isArray(descriptors)) {
    if (descriptors.length === 0) {
      return Promise.resolve(); // unsetting descriptors
    }
    try {
      const found = await CIDDescriptor.aggregate([
        {
          $project: {
            _id: 0,
            descriptor: 1,
          },
        },
      ]);
      const all = found.map((item) => item.descriptor).filter((item) => item !== undefined);
      let valid = true;
      descriptors.forEach((item) => {
        if (!all.includes(item)) {
          valid = false;
        }
      });
      if (valid) {
        return Promise.resolve();
      }
    } catch (e) {
      debugError(`Error validating C-IDs: ${e.toString()}`);
    }
  }
  return Promise.reject();
}

/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
  switch (method) {
    case 'createProject':
      return [
          body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
          body('visibility', conductorErrors.err1).exists().custom(validateVisibility),
      ]
    case 'deleteProject':
      return [
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
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
          body('visibility', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateVisibility),
          body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
          body('allowAnonPR', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('preferredPRRubric', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail(),
          body('license', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(isValidLicense),
          body('resourceURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
          body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('rdmpReqRemix', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('rdmpCurrentStep', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateRoadmapStep),
          body('adaptURL', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateADAPTCourseURL),
          body('cidDescriptors', conductorErrors.err1).optional().custom(validateCIDDescriptors),
          body('associatedOrgs', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
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
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'addMemberToProject':
      return [
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('uuid', conductorErrors.err1).exists().isString().isUUID()
      ]
    case 'getProjectTeam':
      return [
          param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
          query('combine', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          query('excludeCurrent', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
      ]
    case 'changeMemberRole':
      return [
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          param('uuid', conductorErrors.err1).exists().isString().isUUID(),
          body('newRole', conductorErrors.err1).exists().isString().custom(validateProjectRole)
      ]
    case 'removeMemberFromProject':
      return [
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          param('uuid', conductorErrors.err1).exists().isString().isUUID()
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
    case 'addProjectFile':
      return [
        param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
        body('parentID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
        body('folderName', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 100 }),
        body('isURL', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
        body('fileURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
      ]
    case 'getProjectFolderContents':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('folderID', conductorErrors.err1).optional({ checkFalsy: true }).isUUID(),
      ]
    case 'getProjectFile':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('fileID', conductorErrors.err1).exists().isUUID(),
      ]
    case 'getProjectFileDownloadUrl':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('fileID', conductorErrors.err1).exists().isUUID(),
        query('shouldIncrement', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
      ]
    case 'bulkDownloadProjectFiles':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        query('fileIDs', conductorErrors.err1).exists(),
      ]
    case 'updateProjectFileAccess':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('fileID', conductorErrors.err1).exists().isUUID(),
        body('newAccess', conductorErrors.err1).exists().isString().custom(isFileInterfaceAccess),
      ]
    case 'moveProjectFile':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('fileID', conductorErrors.err1).exists().isUUID(),
        body('newParent', conductorErrors.err1).exists().isString(),
      ]
    case 'removeProjectFile':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10 }),
        param('fileID', conductorErrors.err1).exists().isUUID(),
      ]
    case 'getProjectBookReaderResources':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10})
      ]
    case 'updateProjectBookReaderResources':
      return [
        param('projectID', conductorErrors.err1).exists().isLength({ min: 10, max: 10}),
        body('readerResources').exists().isArray(),
        body('readerResources.*.name').exists().trim().isLength({ min: 2, max: 100 }),
        body('readerResources.*.url').exists().trim().isURL(),
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
    getProjectTeam,
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
    fileUploadHandler,
    addProjectFile,
    getProjectFileDownloadURL,
    bulkDownloadProjectFiles,
    getProjectFolderContents,
    getProjectFile,
    updateProjectFile,
    updateProjectFileAccess,
    moveProjectFile,
    removeProjectFile,
    getProjectBookReaderResources,
    updateProjectBookReaderResources,
    checkProjectGeneralPermission,
    checkProjectMemberPermission,
    checkProjectAdminPermission,
    constructProjectTeam,
    constructProjectTeamMemberQuery,
    validate
}
