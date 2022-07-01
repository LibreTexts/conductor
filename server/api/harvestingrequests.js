//
// LibreTexts Conductor
// harvestingrequests.js
//

'use strict';
import { body, query } from 'express-validator';
import { validate as uuidValidate } from 'uuid';
import b62 from 'base62-random';
import User from '../models/user.js';
import HarvestingRequest from '../models/harvestingrequest.js';
import Project from '../models/project.js';
import conductorErrors from '../conductor-errors.js';
import { isEmptyString } from '../util/helpers.js';
import { threePartDateStringValidator } from '../validators.js';
import { getTextUse } from '../util/projectutils.js';
import { debugError } from '../debug.js';
import mailAPI from './mail.js';

/**
 * Creates and saves a new HarvestingRequest model with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'addRequest'
 */
const addRequest = (req, res) => {
    let userLookup = false;
    let userFirst = null;
    let finalizedRequest = {};
    if (!isEmptyString(req.body.dateIntegrate)) { // validate and convert to Date object
        const rawDI = String(req.body.dateIntegrate).split('-');
        const dateIntegrate = new Date(rawDI[2], rawDI[0]-1, rawDI[1], 0, 0, 0);
        req.body.dateIntegrate = dateIntegrate;
    }
    new Promise((resolve, reject) => {
        if (req.user) {
            // user is logged in
            if (req.user?.decoded?.uuid) {
                userLookup = true;
                resolve(User.findOne({
                    uuid: req.user.decoded.uuid
                }));
            } else {
                reject(new Error('unauth'));
            }
        } else {
            // 'anon' submission
            if (req.body.email && !isEmptyString(req.body.email)) {
                resolve({});
            } else {
                reject(new Error('missingfield'));
            }
        }
    }).then((user) => {
        if (userLookup && Object.keys(user).length > 0) {
            req.body.submitter = user.uuid;
            req.body.email = user.email;
            if (user.firstName && user.lastName && !isEmptyString(user.firstName) && !isEmptyString(user.lastName)) {
                req.body.name = user.firstName + ' ' + user.lastName;
                userFirst = user.firstName;
            }
            if (typeof(req.body.addToProject) !== 'undefined' && req.body.addToProject === true) {
                req.body.addToProject = true;
            } else req.body.addToProject = false;
        }
        req.body.status = 'open';
        return new HarvestingRequest(req.body).save();
    }).then((newDoc) => {
        if (newDoc) {
            finalizedRequest = newDoc;
            let recipientName = newDoc.name;
            if (userFirst !== null) recipientName = userFirst;
            // send confirmation to submitter
            return mailAPI.sendOERIntRequestConfirmation(recipientName, newDoc.email, newDoc.title);
        } else {
            throw(conductorErrors.err3);
        }
    }).then(() => {
        // ignore return value of Mailgun call
        // send notification to LibreTexts team
        return mailAPI.sendOERIntRequestAdminNotif(finalizedRequest.name, finalizedRequest.title);
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: "Harvesting request succesfully submitted."
        });
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.msg === 'unauth') errMsg = conductorErrors.err9;
        else if (err.msg === 'missingfield') errMsg = conductorErrors.err1;
        return res.status(500).send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Returns Harvesting Requests within a given date range.
 * VALIDATION: 'getRequests'
 */
const getRequests = (req, res) => {
    try {
        var sComp = String(req.query.startDate).split('-');
        var eComp = String(req.query.endDate).split('-');
        var sM, sD, sY;
        var eM, eD, eY;
        if ((sComp.length == 3) && (eComp.length == 3)) {
            sM = parseInt(sComp[0]) - 1;
            sD = parseInt(sComp[1]);
            sY = parseInt(sComp[2]);
            eM = parseInt(eComp[0]) - 1;
            eD = parseInt(eComp[1]);
            eY = parseInt(eComp[2]);
        }
        if (!isNaN(sM) && !isNaN(sD) && !isNaN(sY) && !isNaN(eM) && !isNaN(eD) && !isNaN(eY)) {
            var start = new Date(sY, sM, sD);
            start.setHours(0,0,0,0);
            var end = new Date(eY, eM, eD);
            end.setHours(23,59,59,999);
            HarvestingRequest.aggregate([
                {
                    $match: {
                        $and: [
                            {
                                createdAt: {
                                    $gte: start,
                                    $lte: end
                                },
                            }, {
                                status: 'open'
                            }
                        ]
                    }
                }, {
                    $project: {
                        __v: 0
                    }
                }, {
                    $sort: {
                        createdAt: 1
                    }
                }
            ]).then((requests) => {
                return res.status(200).send({
                    err: false,
                    requests: requests
                });
            }).catch((err) => {
                debugError(err);
                return res.status(500).send({
                    err: true,
                    errMsg: conductorErrors.err6
                });
            });
        } else {
            throw('timeparse-err')
        }
    } catch (err) {
        debugError(err);
        return res.status(400).send({
            err: true,
            errMsg: emmErrors.err3
        });
    }
};


/**
 * Deletes the HarvestingRequest identified by the requestID in
 * the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteRequest'
 */
const deleteRequest = (req, res) => {
    HarvestingRequest.deleteOne({
        _id: req.body.requestID
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                errMsg: 'Request successfully deleted.'
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.msg === 'deletefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Converts the HarvestingRequest identified by the requestID in
 * the request body to a Project.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'convertRequest'
 */
const convertRequest = (req, res) => {
    let projectData = {};
    let harvestReq = {};
    let userData = {};
    let userLookup = false;
    HarvestingRequest.findOne({
        _id: req.body.requestID
    }).lean().then((harvestData) => {
        if (harvestData) {
            harvestReq = harvestData;
            projectData = {
                orgID: process.env.ORG_ID,
                projectID: b62(10),
                title: harvestReq.title,
                status: 'available',
                visibility: 'public',
                currentProgress: 0,
                peerProgress: 0,
                a11yProgress: 0,
                classification: 'harvesting',
                collaborators: [],
                tags: [],
                notes: '',
                leads: [req.decoded.uuid],
                liaisons: [],
                members: [],
                auditors: [],
                libreLibrary: harvestReq.library,
                license: harvestReq.license,
                harvestReqID: harvestReq._id
            };
            if (harvestReq.url) projectData.resourceURL = harvestReq.url;
            let notes = `**Harvest Request Information (do not remove)**\n*Email:* ${harvestReq.email}\n`;
            if (harvestReq.name && !isEmptyString(harvestReq.name)) {
                notes += `*Requester Name:* ${harvestReq.name}\n`;
            }
            if (harvestReq.institution && !isEmptyString(harvestReq.institution)) {
                notes += `*Requester Institution:* ${harvestReq.institution}\n`;
            }
            if (harvestReq.resourceUse && !isEmptyString(harvestReq.resourceUse)) {
                notes += `*Intended Use:* *${getTextUse(harvestReq.resourceUse)}*\n`;
            }
            if (harvestReq.dateIntegrate && typeof(harvestReq.dateIntegrate) === 'object') {
                notes += `*Requested Integration Date:* ${harvestReq.dateIntegrate.toDateString()}\n`;
            }
            if (harvestReq.comments && !isEmptyString(harvestReq.comments)) {
                notes += `*Comments:* ${harvestReq.comments}`;
            }
            projectData.notes = notes;
            if (harvestReq.submitter && uuidValidate(harvestReq.submitter) && harvestReq.submitter !== req.decoded.uuid) {
                userLookup = true;
                return User.findOne({
                    uuid: harvestReq.submitter
                });
            } else {
                return {};
            }
        } else {
            throw(new Error('notfound'))
        }
    }).then((user) => {
        if (userLookup && Object.keys(user).length > 0) {
            if (typeof(harvestReq.addToProject) !== 'undefined' && harvestReq.addToProject === true) {
                projectData.members = [user.uuid];
            }
            userData = user;
        }
        return new Project(projectData).save();
    }).then((projectRes) => {
        if (projectRes) {
            return HarvestingRequest.updateOne({
                _id: harvestReq._id
            }, {
                status: 'converted'
            });
        } else {
            throw(new Error('createfail'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            let requesterName = null;
            if (userLookup && Object.keys(userData).length > 0) {
                if (userData.firstName && !isEmptyString(userData.firstName)) {
                    requesterName = userData.firstName;
                }
            } else if (harvestReq.name && !isEmptyString(harvestReq.name)) {
                requesterName = harvestReq.name;
            }
            return mailAPI.sendOERIntRequestApproval(requesterName, harvestReq.email, harvestReq.title);
        } else {
            throw(new Error('updatefail'))
        }
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            projectID: projectData.projectID,
            msg: 'OER Integration Request successfully converted to project.'
        });
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.msg === 'notfound') errMsg = conductorErrors.err11;
        else if (err.msg === 'createfail' || err.msg === 'updateFail') errMsg = conductorErrors.err3;
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


const validate = (method) => {
    switch (method) {
        case 'addRequest':
            return [
                body('email', conductorErrors.err1).optional({ checkFalsy: true }).isEmail(),
                body('title', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('library', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('license', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('dateIntegrate').optional({ checkFalsy: true }).custom(threePartDateStringValidator),
                body('addToProject').optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
        case 'getRequests':
            return [
                query('startDate', conductorErrors.err1).exists().custom(threePartDateStringValidator),
                query('endDate', conductorErrors.err1).exists().custom(threePartDateStringValidator)
            ]
        case 'deleteRequest':
            return [
                body('requestID', conductorErrors.err1).exists().isMongoId()
            ]
        case 'convertRequest':
            return [
                body('requestID', conductorErrors.err1).exists().isMongoId()
            ]
    }
};

export default {
    addRequest,
    getRequests,
    deleteRequest,
    convertRequest,
    validate
}
