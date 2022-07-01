//
// LibreTexts Conductor
// peerreview.js
//

'use strict';
import Promise from 'bluebird';
import { body, query } from 'express-validator';
import b62 from 'base62-random';
import User from '../models/user.js';
import Project from '../models/project.js';
import PeerReview from '../models/peerreview.js';
import PeerReviewRubric from '../models/peerreviewrubric.js';
import Book from '../models/book.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';
import  {
    validatePeerReviewPromptType,
    validatePeerReviewAuthorType,
    buildPeerReviewAggregation,
    calculateAveragePeerReviewRating
} from '../util/peerreviewutils.js';
import { isEmptyString } from '../util/helpers.js';
import authAPI from './auth.js';
import mailAPI from './mail.js';
import projectAPI from './projects.js';

/**
 * Internal method to retrieve the specified Peer Review Rubric, the Organization's Rubric or
 * LibreTexts default Rubric if not found.
 * NOTE: Do not use for external API calls.
 * @param {String} rubricID - The Peer Review Rubric identifier to query on.
 * @param {Boolean} [doResolution=true] - Whether to resolve down to a default Rubric if specified is not found.
 * @returns {Promise<Object|Error>} The Peer Review Rubric, or error if not found.
 */
const getPeerReviewRubricInternal = (rubricID, doResolution = true) => {
    let foundRubric = null;
    let didOrgLookup = false;
    let didLibreLookup = false;
    return new Promise.try(() => {
        if (typeof (rubricID) === 'string' && rubricID.length > 0) {
            if (rubricID === process.env.ORG_ID) didOrgLookup = true;
            if (rubricID === 'libretexts') didLibreLookup = true;
            return PeerReviewRubric.findOne({
                rubricID: rubricID
            }, { _id: 0, __v: 0 }).lean();
        } else {
            throw (new Error('rubricnotfound'));
        }
    }).then((rubric) => {
        if (rubric) { // store to send and move on
            foundRubric = rubric;
            return null;
        }
        if (doResolution && !didOrgLookup) {
            // Look up Org default
            didOrgLookup = true;
            return PeerReviewRubric.findOne({ rubricID: process.env.ORG_ID }, { _id: 0, __v: 0 }).lean();
        } else if (doResolution && !didLibreLookup) {
            // Look up LibreTexts default
            didLibreLookup = true;
            return PeerReviewRubric.findOne({ rubricID: 'libretexts' }, { _id: 0, __v: 0 }).lean();
        } else {
            // Resolution disabled or all paths exhausted
            throw (new Error('rubricnotfound'));
        }
    }).then((rubric) => {
        if (foundRubric !== null) { // already found, move on
            return null;
        } else if (rubric) { // just found, move on
            foundRubric = rubric;
            return null;
        }
        if (doResolution && !didLibreLookup) {
            // Look up LibreTexts default as last possible path
            didLibreLookup = true;
            return PeerReviewRubric.findOne({ rubricID: 'libretexts' }, { _id: 0, __v: 0 }).lean();
        } else {
            // Resolution disabled or all paths exhausted
            throw (new Error('rubricnotfound'));
        }
    }).then((rubric) => {
        if (foundRubric !== null) { // already found, return
            return foundRubric;
        } else if (rubric) { // just found, return
            return rubric;
        } else {
            throw (new Error('rubricnotfound'));
        }
    });
};


/**
 * Retrieves the specified Peer Review Rubric or the Organization's default.
 * Provides wrapper to respond to external API calls.
 * VALIDATION: 'getPeerReviewRubric'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getPeerReviewRubric = (req, res) => {
    let rubricID = process.env.ORG_ID;
    if (!isEmptyString(req.query.rubricID)) rubricID = req.query.rubricID;
    return getPeerReviewRubricInternal(rubricID, false).then((rubric) => {
        if (rubric) {
            return res.send({
                err: false,
                rubric: rubric
            });
        } else {
            throw (new Error('rubricnotfound'));
        }
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.message === 'rubricnotfound') errMsg = conductorErrors.err48;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves all Peer Review Rubrics.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getAllPeerReviewRubrics = (_req, res) => {
    PeerReviewRubric.aggregate([
        {
            $match: {}
        }, {
            $lookup: {
                from: 'organizations',
                let: {
                    organization: '$orgID'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$orgID', '$$organization']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            name: 1,
                            shortName: 1,
                            abbreviation: 1
                        }
                    }
                ],
                as: 'organization'
            }
        }, {
            $addFields: {
                organization: {
                    $arrayElemAt: ['$organization', 0]
                }
            }
        }, {
            $project: {
                _id: 0,
                __v: 0
            }
        }
    ]).then((rubrics) => {
        let sorted = [...rubrics].sort((a, b) => {
            let aKey = String(a.rubricTitle).toLowerCase().replace(/[^A-Za-z]+/g, "");
            let bKey = String(b.rubricTitle).toLowerCase().replace(/[^A-Za-z]+/g, "");
            if (aKey < bKey) return -1;
            if (aKey > bKey) return 1;
            return 0;
        });
        return res.send({
            err: false,
            rubrics: sorted
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
 * Returns whether the current Organization has a default Peer Review Rubric set up.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const checkOrgDefaultRubric = (_req, res) => {
    PeerReviewRubric.findOne({
        rubricID: process.env.ORG_ID
    }).lean().then((rubric) => {
        let hasDefault = false;
        if (rubric) hasDefault = true;
        return res.send({
            hasDefault,
            err: false,
            orgID: process.env.ORG_ID
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
 * Retrieves the preferred Peer Review Rubric configuration for a given Project, or a default if necessary.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProjectPeerReviewRubric'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getProjectPeerReviewRubric = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            let rubricID = project.orgID;
            if (typeof (project.preferredPRRubric) === 'string' && project.preferredPRRubric.length > 0) {
                rubricID = project.preferredPRRubric;
            }
            return getPeerReviewRubricInternal(rubricID);
        } else {
            throw (new Error('notfound'));
        }
    }).then((rubric) => {
        if (rubric) {
            return res.send({
                err: false,
                rubric: rubric
            });
        } else {
            throw (new Error('rubricnotfound'));
        }
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'rubricnotfound') errMsg = conductorErrors.err48;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Checks if a user has access to submit a Peer Review to a Project,
 * otherwise, if unauthenticated, if the Project accepts non-user reviews.
 * VALIDATION: 'getProjectPeerReviewAccess'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getProjectPeerReviewAccess = (req, res) => {
    let hasAccess = false;
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if (project.visibility === 'public' && (project.allowAnonPR === true || !project.hasOwnProperty('allowAnonPR'))) {
                hasAccess = true;
            } else if (typeof (req.user?.decoded?.uuid) === 'string') {
                hasAccess = projectAPI.checkProjectMemberPermission(project, req.user);
            }
            if (hasAccess) {
                return res.send({
                    err: false,
                    access: true,
                    msg: "User is authorized to submit a Peer Review for this project."
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message == 'unauth') errMsg = conductorErrors.err8;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves all Peer Review for the Project specified in the request query.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getProjectPeerReviews = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            // check user has permission to view Project's Peer Reviews
            if (projectAPI.checkProjectGeneralPermission(project, req.user)) {
                return PeerReview.aggregate(buildPeerReviewAggregation(project.projectID));
            }
            throw (new Error('unauth'));
        }
        throw (new Error('notfound'));
    }).then((peerReviews) => {
        let reviewsRes = {
            err: false,
            reviews: peerReviews
        };
        if (peerReviews.length > 0) {
            let averageRating = calculateAveragePeerReviewRating(peerReviews);
            if (averageRating !== null) reviewsRes.averageRating = averageRating;
        }
        return res.send(reviewsRes);
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves a single Peer Review specified in the request query.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object. 
 */
const getPeerReview = (req, res) => {
    let peerReview = {};
    PeerReview.aggregate(buildPeerReviewAggregation(req.query.peerReviewID, true)).then((peerReviews) => {
        if (peerReviews.length > 0) {
            peerReview = peerReviews[0];
            return Project.findOne({ projectID: peerReview.projectID }).lean();
        }
        throw (new Error('notfound'));
    }).then((project) => {
        if (project) {
            // check user has permission to view Peer Reviews for the Project
            if (projectAPI.checkProjectGeneralPermission(project, req.user)) {
                return res.send({
                    err: false,
                    review: peerReview
                });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Sends an invite to a potential Peer Reviewer for the specified project.
 * VALIDATION: 'sendPeerReviewInvite'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const sendPeerReviewInvite = (req, res) => {
    let project = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((projectData) => {
        if (projectData) {
            project = projectData;
            // verify project accepts non-user reviews
            if (project.visibility === 'public' && (project.allowAnonPR === true || !project.hasOwnProperty('allowAnonPR'))) {
                // check user has permission to send invites
                if (typeof (req.user?.decoded?.uuid) === 'string' && projectAPI.checkProjectMemberPermission(project, req.user)) {
                    return User.findOne({
                        uuid: req.user.decoded.uuid
                    }, {
                        firstName: 1,
                        lastName: 1
                    }).lean();
                } else {
                    throw (new Error('unauth'));
                }
            } else {
                throw (new Error('projectsettings'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((inviterRes) => {
        if (inviterRes) {
            let inviterName = 'Unknown User';
            let projectURL = null;
            if (typeof (inviterRes.firstName) === 'string' && typeof (inviterRes.lastName) === 'string') {
                inviterName = `${inviterRes.firstName} ${inviterRes.lastName}`;
            }
            if (req.body.sendProjectURL === true && typeof (project.projectURL) === 'string' && project.projectURL.length > 0) {
                projectURL = project.projectURL;
            }
            return mailAPI.sendPeerReviewInvitation(inviterName, req.body.inviteEmail, project.projectID, project.title, projectURL);
        } else {
            throw (new Error('usernotfound'))
        }
    }).then(() => {
        // ignore return value, errors will be handled below
        return res.send({
            err: false,
            msg: "Successfully sent invitation email!"
        });
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'projectsettings') errMsg = conductorErrors.err52;
        else if (err.message === 'usernotfound') errMsg = conductorErrors.err7;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Submits a new Peer Review for the specified Project.
 * VALIDATION: 'createPeerReview'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const createPeerReview = (req, res) => {
    let project = {};
    let newReview = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((projectData) => {
        if (projectData) {
            project = projectData;
            let allowSubmit = false;
            if (typeof (req.user?.decoded?.uuid) === 'string' && projectAPI.checkProjectMemberPermission(project, req.user)) {
                // user has implicit permission as team member
                allowSubmit = true;
                newReview = {
                    author: req.user.decoded.uuid,
                    anonAuthor: false
                };
            } else if ((project.hasOwnProperty('allowAnonPR') && project.allowAnonPR === true) || !project.hasOwnProperty('allowAnonPR')) {
                if (typeof (req.body.authorFirst) === 'string' && typeof (req.body.authorLast) === 'string' && typeof (req.body.authorEmail) === 'string') {
                    // resolve 'anon' submission
                    allowSubmit = true;
                    newReview = {
                        author: `${req.body.authorFirst.trim()} ${req.body.authorLast.trim()}`,
                        authorEmail: req.body.authorEmail.trim(),
                        anonAuthor: true
                    };
                } else if (typeof (req.user?.decoded.uuid) === 'string') {
                    // is authenticated user, but not member of project
                    allowSubmit = true;
                    newReview = {
                        author: req.user.decoded.uuid,
                        anonAuthor: false
                    };
                }
            }
            let rubricID = project.orgID;
            if (typeof(project.preferredPRRubric) === 'string' && project.preferredPRRubric.length > 0) {
                rubricID = project.preferredPRRubric;
            }
            if (allowSubmit) return getPeerReviewRubricInternal(rubricID);
            throw (new Error('unauth'));
        }
        throw (new Error('notfound'));
    }).then((rubric) => {
        if (Object.keys(rubric).length > 0 && Array.isArray(rubric.prompts) && rubric.prompts.length > 0) {
            newReview = {
                ...newReview,
                projectID: project.projectID,
                peerReviewID: b62(9),
                rubricID: rubric.rubricID,
                rubricTitle: rubric.rubricTitle,
                authorType: req.body.authorType,
                headings: [],
                textBlocks: []
            };
            if (
                typeof (req.body.rating) === 'number'
                && req.body.rating > 0
                && req.body.rating <= 5
            ) {
                newReview.rating = req.body.rating;
            } else {
                throw (new Error('requiredresponses'));
            }
            if (Array.isArray(rubric.headings)) newReview.headings = rubric.headings;
            if (Array.isArray(rubric.textBlocks)) newReview.textBlocks = rubric.textBlocks;
            let allPrompts = rubric.prompts.map((existPrompt) => existPrompt._id.toString());
            let requiredResponses = rubric.prompts.map((existPrompt) => {
                if (existPrompt.promptRequired === true) return existPrompt._id.toString();
                return null;
            }).filter((existPrompt) => existPrompt !== null);

            if (Array.isArray(req.body.promptResponses)) {
                let responses = [];
                req.body.promptResponses.forEach((promptRes) => {
                    let existingMatch = rubric.prompts.find((prompt) => {
                        if (
                            prompt._id.toString() === promptRes.promptID
                            && prompt.promptType === promptRes.promptType
                            && prompt.order === promptRes.order
                        ) {
                            return prompt;
                        }
                        return null;
                    });
                    if (existingMatch !== undefined) {
                        const removeRequired = (requiredID) => {
                            let idToRemove = requiredID.toString();
                            if (requiredResponses.includes(idToRemove)) { // Remove satisfied required responses
                                requiredResponses = requiredResponses.filter((required) => required !== idToRemove);
                            }
                            if (allPrompts.includes(idToRemove)) { // Remove from list of all prompts
                                allPrompts = allPrompts.filter((prompt) => prompt !== idToRemove);
                            }
                        };
                        const validateLikert = (newRes, existing, prompt, numPoints) => {
                            let likertRes = null;
                            if (typeof (prompt.likertResponse) === 'number') {
                                likertRes = prompt.likertResponse;
                            } else if (typeof (prompt.likertRes) === 'string') {
                                likertRes = parseInt(prompt.likertResponse);
                            }
                            if (likertRes !== null && !isNaN(likertRes) && likertRes > 0 && likertRes < (numPoints + 1)) {
                                newRes.likertResponse = likertRes;
                                removeRequired(existing._id);
                                responses.push(newRes);
                            }
                        };
                        let newResponse = {
                            promptType: existingMatch.promptType,
                            promptText: existingMatch.promptText,
                            promptRequired: existingMatch.promptRequired,
                            order: existingMatch.order
                        };
                        if (typeof (newResponse.promptType) === 'string' && newResponse.promptType.includes('likert')) {
                            let typeSplit = newResponse.promptType.split('-');
                            let likertPoints = parseInt(typeSplit[0]);
                            if (!isNaN(likertPoints) && likertPoints > 0 && likertPoints < 8) {
                                validateLikert(newResponse, existingMatch, promptRes, likertPoints);
                            }
                        } else if (
                            newResponse.promptType === 'text'
                            && typeof (promptRes.textResponse) === 'string'
                            && promptRes.textResponse.length > 0
                            && promptRes.textResponse.length < 10000
                        ) {
                            newResponse.textResponse = promptRes.textResponse;
                            removeRequired(existingMatch._id);
                            responses.push(newResponse);
                        } else if (newResponse.promptType === 'dropdown' && typeof (promptRes.dropdownResponse) === 'string') {
                            if (Array.isArray(existingMatch.promptOptions) && existingMatch.promptOptions.length > 0) {
                                let findExistingOption = existingMatch.promptOptions.find((existOption) => {
                                    if (existOption.value === promptRes.dropdownResponse) return existOption;
                                    return null;
                                });
                                if (findExistingOption !== undefined) {
                                    newResponse = {
                                        ...newResponse,
                                        dropdownResponse: promptRes.dropdownResponse,
                                        promptOptions: existingMatch.promptOptions
                                    };
                                    removeRequired(existingMatch._id);
                                    responses.push(newResponse);
                                }
                            }
                        } else if (newResponse.promptType === 'checkbox') {
                            if (promptRes.checkboxResponse === true || promptRes.checkboxResponse === 'true') {
                                newResponse.checkboxResponse = true;
                                removeRequired(existingMatch._id);
                            } else {
                                newResponse.checkboxResponse = false;
                                if (allPrompts.includes(existingMatch._id.toString())) { // Remove from list of all prompts
                                    allPrompts = allPrompts.filter((prompt) => prompt !== existingMatch._id.toString());
                                }
                            }
                            responses.push(newResponse);
                        }
                    }
                });
                if (allPrompts.length > 0) { // remaining optional prompts, store to preserve form snapshot
                    allPrompts.forEach((prompt) => {
                        let existingMatch = rubric.prompts.find((existing) => existing._id.toString() === prompt);
                        if (existingMatch !== undefined) {
                            let newResponse = {
                                promptType: existingMatch.promptType,
                                promptText: existingMatch.promptText,
                                promptRequired: existingMatch.promptRequired,
                                order: existingMatch.order
                            };
                            if (existingMatch.promptType === 'dropdown' && Array.isArray(existingMatch.promptOptions)) {
                                newResponse.promptOptions = existingMatch.promptOptions;
                            }
                            responses.push(existingMatch);
                        }
                    });
                }
                if (requiredResponses.length !== 0) throw (new Error('requiredresponses'));
                if (responses.length > 0) {
                    newReview.responses = responses;
                    return new PeerReview(newReview).save();
                }
            } else {
                throw (new Error('noresponses'));
            }
        } else {
            throw (new Error('rubricnotfound')); // couldn't find any form config to use
        }
    }).then((createRes) => {
        if (createRes) {
            return updateProjectAverageRating(project.projectID);
        } else {
            throw (new Error('createfail'));
        }
    }).then((ratingUpdateRes) => {
        if (ratingUpdateRes) {
            // send notification to project team
            let projTeam = projectAPI.constructProjectTeam(project);
            if (projTeam.length > 0) return authAPI.getUserBasicWithEmail(projTeam);
            return [];
        } else {
            throw (new Error('updatefail'));
        }
    }).then((teamRecipients) => {
        if (Array.isArray(teamRecipients) && teamRecipients.length > 0) {
            const recipients = teamRecipients.map((item) => {
                if (item.hasOwnProperty('email')) return item.email;
                return null;
            }).filter((item) => item !== null);
            if (recipients.length > 0) return mailAPI.sendPeerReviewNotification(recipients, project.projectID, project.title, project.orgID);
        }
        return null;
    }).then(() => {
        // ignore return value of MailAPI call
        return res.send({
            err: false,
            msg: "Successfully submitted new Peer Review!"
        });
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'rubricnotfound') errMsg = conductorErrors.err48;
        else if (err.message === 'requiredresponses') errMsg = conductorErrors.err49;
        else if (err.message === 'noresponses') errMsg = conductorErrors.err50;
        else if (err.message === 'createfail') errMsg = conductorErrors.err3;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes a specified Peer Review given that the user has permission within its Project.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const deletePeerReview = (req, res) => {
    let peerReview = {};
    let project = null;
    PeerReview.findOne({
        peerReviewID: req.body.peerReviewID
    }).lean().then((peerReviewData) => {
        if (peerReviewData) {
            peerReview = peerReviewData;
            return Project.findOne({ projectID: peerReview.projectID }).lean();
        }
        throw (new Error('notfound'));
    }).then((projectData) => {
        if (projectData) {
            project = projectData;
            // check user has permission to delete PeerReview
            if (projectAPI.checkProjectAdminPermission(project, req.user) || peerReview.author === req.user?.decoded?.uuid) {
                return PeerReview.deleteOne({
                    peerReviewID: peerReview.peerReviewID
                });
            }
            else throw (new Error('unauth'));
        }
        throw (new Error('notfound'));
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return updateProjectAverageRating(project.projectID);
        }
        throw (new Error('deletefail'));
    }).then((ratingUpdateRes) => {
        if (ratingUpdateRes) {
            return res.send({
                err: false,
                msg: "Successfully deleted Peer Review."
            });
        } else {
            throw (new Error('updatefail'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Updates/creates the specified Peer Review Rubric.
 * VALIDATION: 'updatePeerReviewRubric'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const updatePeerReviewRubric = (req, res) => {
    let mode = 'create';
    let newHeadings = [];
    let newBlocks = [];
    let newPrompts = [];
    let newTitle = '';
    return new Promise((resolve, reject) => {
        /* Validation */
        const validateRubricTitle = (rubricTitle) => {
            if (
                typeof (rubricTitle) === 'string'
                && rubricTitle.trim().length > 3
                && rubricTitle.trim().length < 201
            ) {
                return true;
            }
            return false;
        };
        if (req.body.mode === 'create') {
            if (!validateRubricTitle(req.body.rubricTitle)) reject('missingvalues');
            resolve({});
        } else { // 'edit', ensured by validation chain
            mode = 'edit';
            if (
                !isEmptyString(req.body.rubricID)
                && req.body.hasOwnProperty('rubricTitle')
                && validateRubricTitle(req.body.rubricTitle)
            ) {
                newTitle = req.body.rubricTitle;
                resolve(PeerReviewRubric.findOne({
                    rubricID: req.body.rubricID
                }));
            } else {
                reject('missingvalues');
            }
        }
    }).then((rubricLookup) => {
        /* Verify authorization to edit, if neccesary */
        if ((mode === 'create') || (mode === 'edit' && rubricLookup && typeof (rubricLookup.orgID) === 'string')) {
            if (!authAPI.checkHasRole(req.user, rubricLookup.orgID, 'campusadmin')) {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
        /* Process Rubric */
        if (Array.isArray(req.body.headings)) {
            req.body.headings.forEach((heading) => {
                if (typeof (heading.text) === 'string' && heading.text.trim().length > 0 && typeof (heading.order) === 'number') {
                    newHeadings.push({
                        text: heading.text.trim(),
                        order: heading.order
                    });
                }
            });
        }
        if (Array.isArray(req.body.textBlocks)) {
            req.body.textBlocks.forEach((block) => {
                if (typeof (block.text) === 'string' && block.text.trim().length > 0 && typeof (block.order) === 'number') {
                    newBlocks.push({
                        text: block.text.trim(),
                        order: block.order
                    });
                }
            });
        }
        if (Array.isArray(req.body.prompts)) {
            req.body.prompts.forEach((prompt) => {
                if (
                    typeof (prompt.promptType) === 'string' && validatePeerReviewPromptType(prompt.promptType)
                    && typeof (prompt.promptText) === 'string' && prompt.promptText.trim().length > 0
                    && typeof (prompt.order) === 'number'
                ) {
                    let newPromptObj = {
                        promptType: prompt.promptType,
                        promptText: prompt.promptText.trim(),
                        promptRequired: false,
                        order: prompt.order
                    };
                    if (prompt.promptRequired === true || prompt.promptRequired === 'true') {
                        newPromptObj.promptRequired = true;
                    }
                    if (prompt.promptType === 'dropdown') {
                        let dropdownOptions = [];
                        if (Array.isArray(prompt.promptOptions)) {
                            let dropdownKeys = [];
                            prompt.promptOptions.forEach((opt) => {
                                if (
                                    typeof (opt.key) === 'string' && opt.key.length > 0
                                    && !dropdownKeys.includes(opt.key)
                                    && typeof (opt.value) === 'string' && opt.value.length > 0
                                    && typeof (opt.text) === 'string' && opt.text.length > 0
                                    && dropdownOptions.length < 11
                                ) {
                                    dropdownKeys.push(opt.key);
                                    dropdownOptions.push({
                                        key: opt.key,
                                        value: opt.value,
                                        text: opt.text
                                    });
                                }
                            });
                        }
                        if (dropdownOptions.length === 0) reject(new Error('dropdownoptions'));
                        newPromptObj.promptOptions = dropdownOptions;
                    }
                    newPrompts.push(newPromptObj);
                }
            });
        }
        let rubricObj = {
            headings: newHeadings,
            textBlocks: newBlocks,
            prompts: newPrompts
        };
        if (mode === 'create') {
            let newID = '';
            let isOrgDefault = false;
            if (req.body.orgDefault === true) {
                newID = process.env.ORG_ID
                isOrgDefault = true;
            } else {
                newID = b62(7);
            }
            rubricObj = {
                ...rubricObj,
                orgID: process.env.ORG_ID,
                rubricID: newID,
                isOrgDefault: isOrgDefault,
                rubricTitle: req.body.rubricTitle
            };
            return new PeerReviewRubric(rubricObj).save();
        } else {
            if (newTitle.length > 0) rubricObj.rubricTitle = newTitle;
            return PeerReviewRubric.updateOne({ rubricID: req.body.rubricID }, rubricObj);
        }
    }).then((saveRes) => {
        if ((mode === 'create' && saveRes) || (mode === 'edit' && saveRes.modifiedCount === 1)) {
            return res.send({
                err: false,
                msg: `Peer Review Rubric successfully ${mode === 'create' ? 'created' : 'updated'}.`
            });
        }
        throw (new Error('updatefail'));
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        else if (err.message === 'dropdownoptions') errMsg = conductorErrors.err51;
        else if (err.message === 'missingvalues') errMsg = conductorErrors.err1;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes a specified Peer Review Rubric.
 * VALIDATION: 'deletePeerReviewRubric'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const deletePeerReviewRubric = (req, res) => {
    PeerReviewRubric.findOne({
        rubricID: req.body.rubricID
    }).then((rubric) => {
        if (rubric && typeof (rubric.orgID) === 'string') {
            let hasRole = authAPI.checkHasRole(req.user, rubric.orgID, 'campusadmin');
            if (hasRole) {
                return PeerReviewRubric.deleteOne({ rubricID: req.body.rubricID });
            } else {
                throw (new Error('unauth'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: "Rubric successfully deleted."
            });
        } else {
            throw (new Error('deletefail'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
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
 * Updates a Project with a new average rating from all related Peer Reviews. If the Project is
 * connected to a Book, the Book's average rating is also updated.
 * @param {String} projectID - The identifier of the Project to update.
 * @returns {Promise<Boolean|Error>} True if successfully updated, throws error otherwise.
 */
const updateProjectAverageRating = (projectID) => {
    let project = {};
    let newAverage = 0;
    let updateBook = false;
    return Project.findOne({
        projectID: projectID
    }).lean().then((projectData) => {
        if (projectData) {
            project = projectData;
            return PeerReview.aggregate([
                {
                    $match: {
                        $and: [
                            {
                                projectID: projectID
                            }, {
                                rating: {
                                    $ne: null
                                }
                            }
                        ]
                    }
                }, {
                    $project: {
                        _id: 0,
                        rating: 1
                    }
                }
            ]);
        } else {
            throw (new Error('notfound'));
        }
    }).then((peerReviews) => {
        if (Array.isArray(peerReviews) && peerReviews.length > 0) {
            let averageRating = calculateAveragePeerReviewRating(peerReviews);
            if (averageRating !== null) newAverage = averageRating;
        } else {
            newAverage = 0;
        }
        return Project.updateOne({ projectID: projectID }, {
            rating: newAverage
        });
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            if (
                typeof (project.projectURL) === 'string'
                && project.projectURL.length > 0
                && typeof (project.libreLibrary) === 'string'
                && project.libreLibrary.length > 0
                && typeof (project.libreCoverID) === 'string'
                && project.libreCoverID.length > 0
            ) {
                updateBook = true;
                let bookID = `${project.libreLibrary}-${project.libreCoverID}`;
                return Book.updateOne({ bookID: bookID }, {
                    rating: newAverage
                });
            } else {
                return null;
            }
        } else {
            throw (new Error('updatefail'));
        }
    }).then((updateRes) => {
        if ((updateBook && updateRes.modifiedCount === 1) || (!updateBook)) {
            return true;
        } else {
            throw (new Error('updatefail'));
        }
    });
};


/**
 * Verifies that a provided Peer Review Rubric editing mode is one of the pre-defined,
 * acceptable values.
 * @param {String} mode - The editing mode to validate. 
 * @returns {Boolean} True if valid mode, false otherwise.
 */
const validateRubricEditingMode = (mode) => {
    if (typeof (mode) === 'string' && mode.length > 0) {
        return ['create', 'edit'].includes(mode);
    }
    return false;
};


/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'getPeerReviewRubric':
            return [
                query('rubricID', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 100 })
            ]
        case 'getProjectPeerReviewRubric':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'getProjectPeerReviewAccess':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'getProjectPeerReviews':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
        case 'getPeerReview':
            return [
                query('peerReviewID', conductorErrors.err1).exists().isString().isLength({ min: 9, max: 9 })
            ]
        case 'sendPeerReviewInvite':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('inviteEmail', conductorErrors.err1).exists().isString().isEmail(),
                body('sendProjectURL', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
        case 'createPeerReview':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('promptResponses', conductorErrors.err1).exists().isArray(),
                body('authorType', conductorErrors.err1).exists().isString().custom(validatePeerReviewAuthorType),
                body('authorFirst', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 1000 }),
                body('authorLast', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 1000 }),
                body('authorEmail', conductorErrors.err1).optional({ checkFalsy: true }).isString().isEmail()
            ]
        case 'deletePeerReview':
            return [
                body('peerReviewID', conductorErrors.err1).exists().isString().isLength({ min: 9, max: 9 })
            ]
        case 'updatePeerReviewRubric':
            return [
                body('mode', conductorErrors.err1).exists().isString().custom(validateRubricEditingMode),
                body('rubricID', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 100 }),
            ]
        case 'deletePeerReviewRubric':
            return [
                body('rubricID', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 100 })
            ]
    }
};


export default {
    getPeerReviewRubric,
    getAllPeerReviewRubrics,
    checkOrgDefaultRubric,
    getProjectPeerReviewRubric,
    getProjectPeerReviewAccess,
    getProjectPeerReviews,
    getPeerReview,
    sendPeerReviewInvite,
    createPeerReview,
    deletePeerReview,
    updatePeerReviewRubric,
    deletePeerReviewRubric,
    validate
}
