//
// LibreTexts Conductor
// projects.js
//

'use strict';
import BluebirdPromise from 'bluebird';
import express from 'express';
import { body, query, param } from 'express-validator';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import b62 from 'base62-random';
import multer from 'multer';
import { v4 } from 'uuid';
import User, { DEFAULT_PINNED_PROJECTS } from '../models/user.js';
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
    checkIfBookLinkedToProject,
    updateTeamWorkbenchPermissions,
    validateDefaultFileLicense,
    PROJECT_THUMBNAILS_S3_CLIENT_CONFIG,
} from '../util/projectutils.js';
import {
  checkBookIDFormat,
  isValidLicense,
  getBookTOCFromAPI,
} from '../util/bookutils.js';
import { validateA11YReviewSectionItem } from '../util/a11yreviewutils.js';
import { isEmptyString, assembleUrl, getPaginationOffset, extractEmailDomain } from '../util/helpers.js';
import authAPI from './auth.js';
import mailAPI from './mail.js';
import usersAPI from './users.js';
import alertsAPI from './alerts.js';
import centralIdentityAPI from './central-identity.js';
import { getSubdomainFromLibrary } from '../util/librariesclient.js';
import projectFilesAPI from './projectfiles.js';
import ProjectFile from "../models/projectfile.js";
import { getLibraryNameKeys } from './libraries.js';
import TrafficAnalyticsService from "./services/traffic-analytics-service.js";
import ProjectInvitation from '../models/projectinvitation.js';

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

function isValidISBN(isbn) {
  // Allow empty string (optional field)
  if (!isbn) return true;
  // Only digits, and length 10 or 13
  return (/^\d{10}$/.test(isbn) || /^\d{13}$/.test(isbn));
}

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
 * Deletes a Project and its associated resources.
 *
 * @param projectID - Identifier of the Project to delete
 * @returns {Promise<boolean>} True if successful, false otherwise.
 * @private
 */
async function deleteProjectInternal(projectID) {
  try {
    const proj = await Project.findOneAndDelete({
      projectID,
    });
    if (!proj) {
      // findOneAndDelete returns deleted document
      return false;
    }

    // <delete threads and messages>
    const threads = await Thread.find({ project: projectID }).lean();
    if (threads.length > 0) {
      await Promise.allSettled(threads.map((t) => Message.deleteMany({
        thread: t.threadID,
      })));
    }
    // </delete threads and messages>

    await Task.deleteMany({ projectID });

    // <delete files>
    const allFiles = await ProjectFile.find({
      parent: '', // only root-level files - removeProjectFilesInternal() is recursive
      projectID,
    }).lean();
    if (allFiles.length > 0) {
      await projectFilesAPI.removeProjectFilesInternal(projectID, allFiles.map((f) => f.fileID));
    }
    // </delete files>

    return true;
  } catch (err) {
    debugError(err);
    return false;
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

    const deleteRes = await deleteProjectInternal(req.params.projectID);
    if (!deleteRes) {
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
      },
      ...LOOKUP_PROJECT_PI_STAGES(true),
      {
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

    /* Because we only optionally verify the request
    we need to attempt to load the user here
    and pass it to the permission check */
    let foundUser;
    if(req.user?.decoded?.uuid){
      foundUser = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
    }

    if (!checkProjectGeneralPermission(projResult, foundUser ?? undefined)) {
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

    if(projResult?.projectModules){
      // Remove _id and __v fields from projectModules subdocument
      // @ts-ignore
      delete projResult.projectModules._id;
      // @ts-ignore
      delete projResult.projectModules.__v;
    }

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

async function findByBook(req, res) {
  try {
    const { bookID } = req.params;
    if(!bookID){
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const split = bookID.split('-');
    if(split.length !== 2){
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const [library, pageID] = split;

    const project = await Project.findOne({
      libreLibrary: library,
      libreCoverID: pageID,
    }).lean();

    if(!project){
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    return res.send({
      err: false,
      projectID: project.projectID,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Multer handler to process and validate Project thumbnail uploads.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next middleware to call.
 * @returns {function} The Project thumbnail upload handler.
 */
function thumbnailUploadHandler(req, res, next) {
  const thumbnailUploadConfig = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fileSize: 10000000, // 10MB
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes('/')) {
        return cb(new Error('filenameslash'), false);
      }
      return cb(null, true);
    },
  }).single('thumbnail');
  return thumbnailUploadConfig(req, res, (err) => {
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

async function uploadProjectThumbnail(req, res) {
  try {
    const { projectID } = req.params;

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

    if (!req.file) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err61,
      });
    }

    const thumbnail = req.file;
    const thumbnailKey = project.projectID;
    const thumbnailParams = {
      Bucket: process.env.AWS_PROJECT_THUMBNAILS_BUCKET,
      Key: thumbnailKey,
      Body: thumbnail.buffer,
      ContentDisposition: `inline; filename="${thumbnailKey}"`,
      ContentType: thumbnail.mimetype ?? "application/octet-stream",
    };
    const s3Client = new S3Client(PROJECT_THUMBNAILS_S3_CLIENT_CONFIG);
    const uploadResult = await s3Client.send(
      new PutObjectCommand(thumbnailParams)
    );

    if (uploadResult.$metadata.httpStatusCode !== 200) {
      throw new Error("Failed to upload thumbnail image");
    }

    // Check if the current thumbnail URL (if any) has a version number
    let version = 1;
    if(project.thumbnail && project.thumbnail.includes('?')){
      const params = new URLSearchParams(project.thumbnail.split('?')[1]);
      if(params.has('v')){
        version = parseInt(params.get('v'));
        version = version ? version + 1 : 1; // increment version
      }
    }

    const url = assembleUrl([
      'https://',
      process.env.AWS_PROJECT_THUMBNAILS_DOMAIN,
      thumbnailKey + '?v=' + version,
    ]);

    const updateRes = await Project.updateOne(
      { projectID },
      { thumbnail: url }
    );
    if (updateRes.modifiedCount !== 1) {
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err3,
      });
    }

    return res.send({
      err: false,
      msg: "Successfully uploaded thumbnail image!",
      thumbnail: url,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

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

    if (req.body.isbns && Array.isArray(req.body.isbns)) {
      for (const row of req.body.isbns) {
        if (row.isbn && !isValidISBN(row.isbn)) {
          return res.status(400).json({
            err: true,
            errMsg: "Each ISBN must be either 10 or 13 digits and contain only numbers."
          });
        }
      }
    }
    
    const libNameKeys = await getLibraryNameKeys(true);
    if(!libNameKeys){
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }

    const libNames = libNameKeys.join('|');
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

      // If attempting to change a workbench project url, ensure user is a superadmin
      const isSuperadmin = req.user.roles?.filter((role) => role.org === process.env.ORG_ID && role.role === 'superadmin').length > 0;
      if (project.didCreateWorkbench && !isSuperadmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
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
        let otherProjectData;
        if (typeof otherProject === 'string') {
          otherProjectData = await Project.findOne({ projectID: otherProject }).lean();
        }

        if (otherProject) {
          const projectURL = `/projects/${otherProject}`;
          return res.status(409).send({
            err: true,
            errMsg: "Oops, another Project already has that Book associated with it.",
            projectID: `${
              typeof otherProject === "string" ? otherProject : ""
            }`,
            projectName: otherProjectData.title || null, 
            projectURL: projectURL || null,
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
    if (req.body.license) {
      updateObj.license = req.body.license;
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

    if(req.body.hasOwnProperty('defaultFileLicense')) {
      updateObj.defaultFileLicense = req.body.defaultFileLicense;
    }
    if(req.body.hasOwnProperty('projectModules')){
      updateObj.projectModules = req.body.projectModules;
    }
    if(req.body.hasOwnProperty('defaultPrimaryAuthor')){

      const parsed = await projectFilesAPI._parseAndSaveAuthors([req.body.defaultPrimaryAuthor]);
      if(!parsed || !Array.isArray(parsed) || parsed.length < 1){
        throw new Error('Error parsing primary author');
      }

      updateObj.defaultPrimaryAuthorID = parsed[0]
    }
    if(req.body.hasOwnProperty('defaultSecondaryAuthors')){
      const parsed = await projectFilesAPI._parseAndSaveAuthors(req.body.defaultSecondaryAuthors);
      if(!parsed || !Array.isArray(parsed)){
        throw new Error('Error parsing secondary authors');
      }

      updateObj.defaultSecondaryAuthorIDs = parsed;
    }
    if(req.body.hasOwnProperty('defaultCorrespondingAuthor')){
      const parsed = await projectFilesAPI._parseAndSaveAuthors([req.body.defaultCorrespondingAuthor]);
      if(!parsed || !Array.isArray(parsed) || parsed.length < 1){
        throw new Error('Error parsing corresponding author');
      }

      updateObj.defaultCorrespondingAuthorID = parsed[0];
    }

    if(req.body.hasOwnProperty('principalInvestigators')){
      const parsed = await projectFilesAPI._parseAndSaveAuthors(req.body.principalInvestigators);
      if(!parsed || !Array.isArray(parsed)){
        throw new Error('Error parsing principal investigators');
      }
      updateObj.principalInvestigatorIDs = parsed;
    }

    if(req.body.hasOwnProperty('coPrincipalInvestigators')){
      const parsed = await projectFilesAPI._parseAndSaveAuthors(req.body.coPrincipalInvestigators);
      if(!parsed || !Array.isArray(parsed)){
        throw new Error('Error parsing co-principal investigators');
      }

      updateObj.coPrincipalInvestigatorIDs = parsed;
    }

    if(req.body.hasOwnProperty('description')){
      updateObj.description = req.body.description;
    }
    if(req.body.hasOwnProperty('contentArea')){
      updateObj.contentArea = req.body.contentArea;
    }
    if(req.body.hasOwnProperty('defaultChatNotification')){
      updateObj.defaultChatNotification = req.body.defaultChatNotification;
    }
    if(req.body.hasOwnProperty('isbns')){
      updateObj.isbns = req.body.isbns;
    }
    if(req.body.hasOwnProperty('doi')){
      updateObj.doi = req.body.doi;
    }
    if(req.body.hasOwnProperty('sourceOriginalPublicationDate')){
      updateObj.sourceOriginalPublicationDate = req.body.sourceOriginalPublicationDate ? new Date(req.body.sourceOriginalPublicationDate) : undefined;
    }
    if(req.body.hasOwnProperty('sourceHarvestDate')){
      updateObj.sourceHarvestDate = req.body.sourceHarvestDate ? new Date(req.body.sourceHarvestDate) : undefined;
    }
    if(req.body.hasOwnProperty('sourceLastModifiedDate')){
      updateObj.sourceLastModifiedDate = req.body.sourceLastModifiedDate ? new Date(req.body.sourceLastModifiedDate) : undefined;
    }
    if(req.body.hasOwnProperty('sourceLanguage')){
      updateObj.sourceLanguage = req.body.sourceLanguage;
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
async function getUserProjectsAdmin(req, res) {
  try {
    let userid = req.query.uuid;
    const centralID = req.query.centralID;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    const offset = getPaginationOffset(page, limit);

    if (centralID) {
      const found = await User.findOne({centralID: req.query.uuid}).orFail();
      userid = found.uuid;
    };
    const projects = await Project.aggregate([
      {
        $match: {
          $and: [
            {
              $or: constructProjectTeamMemberQuery(userid),
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
          title: 1,
        },
      },
      {
        $project: projectListingProjection,
      },
    ]);

    const total = projects.length;
    const paginatedProjects = projects.slice(offset, offset + limit);

    return res.send({
      err: false,
      uuid: userid,
      projects: paginatedProjects,
      total_items: total,
      has_more: total > offset + limit,
    });
  } catch (err) {
    debugError(err);
    return res.send({
      err: false,
      errMsg: conductorErrors.err6,
    });
  }
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
const getUserPinnedProjects = async (req, res) => {
  try {
    if(!req.user.decoded.uuid){
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const user = await User.findOne(
      { uuid: req.user.decoded.uuid },
      { pinnedProjects: 1 },
    ).lean();

    if(!user) {
      throw new Error('user');
    }

    if(!user.pinnedProjects || !Array.isArray(user.pinnedProjects)){
      return res.send({
        err: false,
        pinned: DEFAULT_PINNED_PROJECTS
      });
    }

    // transform the pinnedProjects array of objects into a flat array of IDs
    // e.g. { folder: "Default", projects: ["abc", "def"] } => ["abc", "def"]
    const pinnedIds = user.pinnedProjects?.reduce((acc, val) => {
      if (Array.isArray(val.projects)) {
        return acc.concat(val.projects);
      }
      return acc;
    }, []) ?? [];

    if (pinnedIds.length === 0) {
      return res.send({
        err: false,
        pinned: user.pinnedProjects
      });
    }

    const projects = await Project.aggregate([
      {
        $match: {
          projectID: {
            $in: pinnedIds
          }
        }
      }, {
        $sort: {
          title: -1,
        }
      }, {
        $project: {
          _id: 0,
          orgID: 1,
          projectID: 1,
          title: 1,
          updatedAt: 1,
        }
      }
    ]);

    // rebuild the pinnedProjects array of objects with the project data
    const pinned = user.pinnedProjects.map((folder) => {
      const folderProjects = projects.filter((project) => {
        return folder.projects.includes(project.projectID);
      });
      return {
        folder: folder.folder,
        projects: folderProjects
      };
    });

    return res.send({
      err: false,
      pinned
    });
  } catch (err){
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
  }
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
    userPinned = user.pinnedProjects.reduce((acc, val) => {
      if (Array.isArray(val.projects)) {
        return acc.concat(val.projects);
      }
      return acc;
    }, []);
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
 * Retrieves a list of public Projects with 'public' visibility.
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @returns
 */
async function getPublicProjects(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = getPaginationOffset(page, limit);

    const aggRes = await Project.aggregate([{
       $facet: {
        projects: [
          {
            $match: {
              orgID: process.env.ORG_ID,
              visibility: "public",
            },
          },
          ...LOOKUP_PROJECT_PI_STAGES(false),
          {
            $lookup: {
              from: "projectfiles",
              localField: "projectID",
              foreignField: "projectID",
              as: "files",
            },
          },
          {
            $addFields: {
              publicAssets: {
                $size: {
                  $filter: {
                    input: "$files",
                    cond: { $eq: ["$$this.access", "public"] }
                  }
                }
              },
              instructorAssets: {
                $size: {
                  $filter: {
                    input: "$files",
                    cond: { $eq: ["$$this.access", "instructor"] }
                  }
                }
              }
            },
          },
          {
            $project: {
              files: 0
            }
          },
          {
            $project: {
              _id: 0,
              orgID: 1,
              projectID: 1,
              title: 1,
              status: 1,
              visibility: 1,
              currentProgress: 1,
              peerProgress: 1,
              a11yProgress: 1,
              tags: 1,
              classification: 1,
              libreLibrary: 1,
              libreCoverID: 1,
              thumbnail: 1,
              projectURL: 1,
              contentArea: 1,
              description: 1,
              principalInvestigators: 1,
              coPrincipalInvestigators: 1,
              associatedOrgs: 1,
              publicAssets: 1,
              instructorAssets: 1
            },
          },
          {
            $skip: offset,
          },
          {
            $limit: limit,
          },
        ],
        totalCount: [
          {
            $match: {
              orgID: process.env.ORG_ID,
              visibility: "public",
            },
          },
          {
            $count: "count",
          },
        ],
      }
    }]);

    return res.send({
      err: false,
      projects: aggRes[0]?.projects ?? [],
      totalCount: aggRes[0]?.totalCount[0]?.count ?? 0,
    });
  } catch (e) {
    debugError(e);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of Users that can be added to a Project team.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getAddableMembers(req, res) {
  try {
    const { projectID } = req.params;
    const { search, includeOutsideOrg, page, limit } = req.query;

    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 10;

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

    let userDomain;
    if(["false", false].includes(includeOutsideOrg)){
      const user = await User.findOne({uuid: req.user.decoded.uuid}).lean().orFail();
      userDomain = extractEmailDomain(user.email);
    }

    const existing = constructProjectTeam(project); // don't include existing team members

    let searchObj = {};
    if (search) {
      searchObj = {
        $search: {
          text: {
            query: search,
            path: ["firstName", "lastName", "email"],
            fuzzy: {
              maxEdits: 2,
              maxExpansions: 50,
            },
          },
        },
      };
    }

    const sortObj = { $sort: { firstName: -1 } }; // sort by first name if no search (otherwise, results are sorted by text score)
    const users = await User.aggregate([
      ...(search && [searchObj]),
      {
        $match: {
          $and: [
            { uuid: { $nin: existing } },
            { $expr: { $not: '$isSystem' } },
            {centralID: {$exists: true}},
            ...(userDomain ? [{email: {$regex: new RegExp(userDomain, 'i')}}] : []),
          ],
        },
      },
      {
        $project: {
          _id: 0,
          uuid: 1,
          centralID: 1,
          firstName: 1,
          lastName: 1,
          avatar: 1,
        },
      },
      ...(search ? [] : [sortObj]),
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit },
    ])


    // Returns map of centralID to orgs (as {name: string} objects)
    const orgsRes = await centralIdentityAPI._getMultipleUsersOrgs(users.map(u => u.centralID)).catch((e) => {
      debugError(e); // fail silently
      return {};
    });

    // attempt to match orgs to users
    const usersWithOrgs = users.map((u) => {
      const orgs = orgsRes[u.centralID] || [];
      return {
        ...u,
        orgs: orgs.map((o) => ({ name: o.name })),
      };
    });

    return res.send({
      users: usersWithOrgs || [],
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

    // PUT user permissions for updated team if project is linked to a Workbench book
    if(updatedProject.didCreateWorkbench && updatedProject.libreLibrary && updatedProject.libreCoverID) {
      const subdomain = await getSubdomainFromLibrary(updatedProject.libreLibrary);
      if(!subdomain) {
        throw new Error("Invalid library");
      }

      await updateTeamWorkbenchPermissions(projectID, subdomain, updatedProject.libreCoverID)
    }

    const foundTeam = await User.find({'uuid': { $in: updatedTeam }}, '-_id email');
    if (!foundTeam) {
      throw (new Error('Error finding updated members.'));
    }

    const teamEmails = foundTeam.map((member) => member.email);
    const emailPromises = teamEmails.map((e) => {
      return mailAPI.sendAddedAsMemberNotification(
        user.firstName,
        e,
        projectID,
        project.title,
      )
    });
    await Promise.all(emailPromises).catch((e) => {
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


    // PUT user permissions for updated team if project is linked to a Workbench book
    if(project.didCreateWorkbench && project.libreLibrary && project.libreCoverID) {
      const subdomain = await getSubdomainFromLibrary(project.libreLibrary);
      if(!subdomain) {
        throw new Error("Invalid library");
      }

      await updateTeamWorkbenchPermissions(projectID, subdomain, project.libreCoverID)
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

    // PUT user permissions for updated team if project is linked to a Workbench book
    if(project.didCreateWorkbench && project.libreLibrary && project.libreCoverID) {
      const subdomain = await getSubdomainFromLibrary(project.libreLibrary);
      if(!subdomain) {
        throw new Error("Invalid library");
      }

      await updateTeamWorkbenchPermissions(projectID, subdomain, project.libreCoverID)
    }

    const user = await User.findOne({ uuid }); 
    // Delete the invitation for the removed user from the project
    await ProjectInvitation.deleteOne({
      projectID,
      email: user.email,
    });

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

async function reSyncProjectTeamBookAccess(req, res){
  try {
    const { projectID } = req.params;
    if (!projectID) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

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

    // PUT user permissions for updated team if project is linked to a Workbench book
    if (project.libreLibrary && project.libreCoverID) {
      const subdomain = await getSubdomainFromLibrary(project.libreLibrary);
      if(!subdomain) {
        throw new Error("Invalid library");
      }

      await updateTeamWorkbenchPermissions(projectID, subdomain, project.libreCoverID)
    }

    return res.send({
      err: false,
      errMsg: "Successfully initiated re-sync of team member(s) book access.",
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
                    if(projectData.didRequestPublish){
                      throw (new Error('alreadypublished'))
                    } else {
                      return User.findOne({ uuid: req.user.decoded.uuid }).lean();
                    }
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
      // set didRequestPublish to true
      return Project.updateOne({
        projectID: req.body.projectID
      }, {
        didRequestPublish: true
      });
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
        else if (err.message === 'alreadypublished'){
          return res.send({
            err: false,
            msg: 'Publishing already requested.'
          })
        }
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
    }).lean().then(async (project) => {
        if (project) {
            projectData = project;
            // check user has permission to import TOC
            if (checkProjectMemberPermission(projectData, req.user)) {
              const bookData = await Book.findOne({
                library: projectData.libreLibrary,
              }).lean();
                if (
                    !isEmptyString(projectData.libreLibrary)
                    && !isEmptyString(projectData.libreCoverID)
                    && !isEmptyString(projectData.projectURL)
                ) return getBookTOCFromAPI(bookData.bookID, projectData.projectURL);
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
    return BluebirdPromise.try(() => {
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

async function getTrafficAnalyticsData(req, res, func) {
  const projectID = req.params.projectID;
  const project = await Project.findOne({projectID}).lean();
  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: conductorErrors.err11,
    });
  }

  const hasPermission = checkProjectGeneralPermission(project, req.user);
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

  const foundBook = await Book.findOne({bookID}).lean();
  if (!foundBook?.links?.online) {
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err28,
    });
  }

  if (!foundBook.trafficAnalyticsConfigured) {
    return res.status(200).send({
      err: false,
      data: [],
    });
  }

  const trafficAnalytics = new TrafficAnalyticsService();
  try {
    const data = await trafficAnalytics[func](foundBook.links.online, req.query);
    res.send({
      err: false,
      data,
    });
  } catch (err) {
    debugError(err);
    res.send({
      err: false,
      data: [],
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
 * @param {any} user             - the current user context
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
            return authAPI.checkHasRole(user, 'libretexts', ['superadmin', 'support']);
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
        return authAPI.checkHasRole(user, "libretexts", ["superadmin", "support"]);
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
            return authAPI.checkHasRole(user, 'libretexts', ['superadmin', 'support']);
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

const LOOKUP_PROJECT_PI_STAGES = (includeAuthors = false) => {
    return [
    ...(includeAuthors ? [
      {
        $lookup: {
          from: "authors",
          localField: "defaultPrimaryAuthorID",
          foreignField: "_id",
          as: "defaultPrimaryAuthor",
        },
      },
      {
        $set: {
          defaultPrimaryAuthor: {
            $arrayElemAt: ["$defaultPrimaryAuthor", 0],
          },
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "defaultCorrespondingAuthorID",
          foreignField: "_id",
          as: "defaultCorrespondingAuthor",
        },
      },
      {
        $set: {
          defaultCorrespondingAuthor: {
            $arrayElemAt: ["$defaultCorrespondingAuthor", 0],
          },
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "defaultSecondaryAuthorIDs",
          foreignField: "_id",
          as: "defaultSecondaryAuthors",
        }
      },
    ]: []),
    {
      $lookup: {
        from: "authors",
        localField: "principalInvestigatorIDs",
        foreignField: "_id",
        as: "principalInvestigators",
      }
    },
    {
      $lookup: {
        from: "authors",
        localField: "coPrincipalInvestigatorIDs",
        foreignField: "_id",
        as: "coPrincipalInvestigators",
      }
    },
  ]
}


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

function validateProjectModules(projectModules) {
  const validModules = ["discussion", "files", "tasks"];
  if (typeof projectModules !== 'object') {
    return false;
  }
  for (const module in projectModules) {
    if(module === "_id" || module === "__v"){
      // ignore these fields (mongodb adds them because projectModules is technically a subdocument of the Organization model)
      continue;
    }

    if (!validModules.includes(module)) {
      return false;
    }
    if (typeof projectModules[module] !== 'object') {
      return false;
    }
    if (typeof projectModules[module].enabled !== 'boolean') {
      return false;
    }
    if (typeof projectModules[module].order !== 'number') {
      return false;
    }
  }
  return true;
}

function validateAuthor(author){
  if (typeof author !== 'object') {
    return false;
  }
  if (!author.hasOwnProperty('firstName') || !author.hasOwnProperty('lastName')) {
    return false;
  }
  if (typeof author.firstName !== 'string' || typeof author.lastName !== 'string') {
    return false;
  }
  return true;
}

function validateAuthorArray(authors){
  if (!Array.isArray(authors)) {
    return false;
  }
  for (const author of authors) {
    if (!validateAuthor(author)) {
      return false;
    }
  }
  return true;
}

function validateLicense(license){
  if (typeof license !== 'object') {
    return false;
  }
  if(license.hasOwnProperty('name')){
    if (typeof license.name !== 'string') {
      return false;
    }
    if(license.name.length > 255){
      return false
    }
  }
  if(license.hasOwnProperty('url') && typeof license.url !== 'string'){
    return false;
  }
  if(license.hasOwnProperty('version') && typeof license.version !== 'string'){
    return false;
  }
  if(license.hasOwnProperty('additionalTerms')){
    if (typeof license.additionalTerms !== 'string') {
      return false;
    }
    if(license.additionalTerms.length > 500){
      return false
    }
  }
  return true;
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
    case 'uploadProjectThumbnail':
      return [
          param('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
      ]
    case 'updateProject':
      return [
          body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          body('title', conductorErrors.err1).optional().isString().isLength({ min: 1 }),
          body('tags', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
          body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateProjectStatus),
          body('classification', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectClassification),
          body('visibility', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateVisibility),
          body('projectURL', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
          body('defaultChatNotification', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('allowAnonPR', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('preferredPRRubric', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('author', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail(),
          body('license', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateLicense),
          body('notes', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('rdmpReqRemix', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
          body('rdmpCurrentStep', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateRoadmapStep),
          body('adaptURL', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateADAPTCourseURL),
          body('cidDescriptors', conductorErrors.err1).optional().custom(validateCIDDescriptors),
          body('associatedOrgs', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
          body('defaultFileLicense', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateDefaultFileLicense),
          body('projectModules', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateProjectModules),
          body('defaultPrimaryAuthor', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateAuthor),
          body('defaultSecondaryAuthors', conductorErrors.err1).optional({ checkFalsy: true }).isArray().custom(validateAuthorArray),
          body('defaultCorrespondingAuthor', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateAuthor),
          body('principalInvestigators', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
          body('coPrincipalInvestigators', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
          body('description', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('contentArea', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
          body('isbn', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 5, max: 50 }),
          body('doi', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 4, max: 50 }),
          body('sourceOriginalPublicationDate', conductorErrors.err1).optional({ checkFalsy: true }).isString().toDate(),
          body('sourceHarvestDate', conductorErrors.err1).optional({ checkFalsy: true }).isString().toDate(),
          body('sourceLastModifiedDate', conductorErrors.err1).optional({ checkFalsy: true }).isString().toDate(),
          body('sourceLanguage', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2, max: 2 }),
      ]
    case 'getProject':
      return [
          query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
          query('include', conductorErrors.err1).optional({ checkFalsy: true }).isArray()
      ]
    case 'getUserProjectsAdmin':
      return [
          query('uuid', conductorErrors.err1).exists().isString().isUUID(),
          query('centralID', conductorErrors.err1).optional({checkFalsy: true}).isBoolean().toBoolean(),
          query('page', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 0 }).toInt(),
          query('limit', conductorErrors.err1).optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }).toInt(),
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
    deleteProjectInternal,
    deleteProject,
    getProject,
    findByBook,
    thumbnailUploadHandler,
    uploadProjectThumbnail,
    updateProject,
    getUserProjects,
    getUserProjectsAdmin,
    getUserFlaggedProjects,
    getUserPinnedProjects,
    getRecentProjects,
    getAvailableProjects,
    getCompletedProjects,
    getPublicProjects,
    getAddableMembers,
    addMemberToProject,
    getProjectTeam,
    changeMemberRole,
    removeMemberFromProject,
    reSyncProjectTeamBookAccess,
    flagProject,
    clearProjectFlag,
    notifyProjectCompleted,
    getOrgTags,
    requestProjectPublishing,
    createA11YReviewSection,
    getA11YReviewSections,
    updateA11YReviewSectionItem,
    importA11YSectionsFromTOC,
    autoGenerateProjects,
    getProjectBookReaderResources,
    updateProjectBookReaderResources,
    getTrafficAnalyticsData,
    checkProjectGeneralPermission,
    checkProjectMemberPermission,
    checkProjectAdminPermission,
    constructProjectTeam,
    constructProjectTeamMemberQuery,
    LOOKUP_PROJECT_PI_STAGES,
    validate
}
