//
// LibreTexts Conductor
// accountrequests.js
//

'use strict';
const User = require('../models/user.js');
const AccountRequest = require('../models/accountrequest.js');
const { body } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString, ensureUniqueStringArray } = require('../util/helpers.js');
const { debugError } = require('../debug.js');
const LibrariesMap = require('../util/librariesmap.js');

const mailAPI = require('./mail.js');


/**
 * Creates and saves a new AccountRequest with the data
 * in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'submitRequest'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const submitRequest = (req, res) => {
    let userLookup = false;
    let userEmail = '';
    let userName = 'Unknown';
    let requestData = {
        ...req.body,
        status: 'open'
    };
    new Promise((resolve, reject) => {
        if (req.user?.decoded?.uuid) { // user is logged in
            userLookup = true;
            resolve(User.findOne({
                uuid: req.user.decoded.uuid
            }));
        } else if (req.body.email && req.body.name
            && !isEmptyString(req.body.email) && !isEmptyString(req.body.name)) {
            // 'anon' submission
            userEmail = req.body.email;
            userName = req.body.name;
            resolve({});
        } else reject(new Error('missingfield'));
    }).then((user) => {
        if (userLookup && Object.keys(user).length > 0) {
            userEmail = user.email;
            userName = `${user.firstName} ${user.lastName}`;
            requestData = {
                ...requestData,
                email: userEmail,
                name: userName,
                requester: user.uuid
            };
        }
        var newRequest = new AccountRequest(requestData);
        return newRequest.save();
    }).then((newDoc) => {
        if (newDoc) return mailAPI.sendAccountRequestAdminNotif(); // send notification to LibreTexts team
        else throw(conductorErrors.err3);
    }).then(() => {
        // ignore return value of Mailgun call
        return mailAPI.sendAccountRequestConfirmation(userName, userEmail); // send confirmation to user
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: "Account Request successfully submitted."
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
 * Returns all open Account Requests.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getRequests = (_req, res) => {
    AccountRequest.aggregate([
        {
            $match: {
                status: 'open'
            }
        }, {
            $lookup: {
                from: 'users',
                let: { requester: '$requester' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ['$uuid', '$$requester']
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
                as: 'requester'
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
};


/**
 * Marks an Account Request as completed.
 * VALIDATION: 'completeRequest'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const completeRequest = (req, res) => {
    let userEmail = '';
    let userName = 'Unknown';
    AccountRequest.findOne({ _id: req.body.requestID }).then((reqData) => {
        if (reqData) {
            userEmail = reqData.email;
            userName = reqData.name;
            return AccountRequest.updateOne({
                _id: req.body.requestID
            }, {
                status: 'completed'
            })
        } else throw(new Error('notfound'));
    }).then((updateData) => {
        if (updateData.modifiedCount === 1) {
            return mailAPI.sendAccountRequestApprovalNotification(userName, userEmail); // send notification to user
        } else throw(new Error('updatefail'));
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: "Successfully marked Account Request as complete."
        });
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.msg === 'notfound') errMsg = conductorErrors.err11;
        else if (err.msg === 'updatefail') errMsg = conductorErrors.err3;
        return res.send({
            err: false,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes the AccountRequest identified by the requestID
 * in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteRequest'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteRequest = (req, res) => {
    AccountRequest.deleteOne({ _id: req.body.requestID }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: "Account Request successfully deleted.",
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
    })
};


/**
 * Checks if a provided Account Request 'Purpose' is valid.
 * @param {String} purpose - the purpose string to validate.
 * @returns {Boolean} true if valid purpose, false otherwise.
 */
const validateRequestPurpose = (purpose) => {
    let validPurposes = ['contribute', 'else'];
    if (typeof(purpose) === 'string') return validPurposes.includes(purpose);
    return false;
};


/**
 * Checks if a provided Account Request Libraries array is valid.
 * @param {String[]} libraries - the array of library identifiers to validate.
 * @returns {Boolean} true if valid array, false otherwise.
 */
const validateRequestLibraries = (libraries) => {
    if (Array.isArray(libraries)) {
        if (libraries.length > 0) {
            let validArray = true;
            libraries.forEach((item) => {
                if (validArray) { // quasi-early stopping
                    let foundLibrary = LibrariesMap.find(lib => lib.key === item);
                    if (foundLibrary === undefined) validArray = false;
                }
            });
            return validArray;
        }
    }
    return false;
};


/**
 * Sets up the validation chains for methods/routes in this file.
 * @param {String} method - the method name to validate for.
 * @returns {Boolean} true if the validation checks passed, false otherwise.
 */
const validate = (method) => {
    switch (method) {
        case 'submitRequest':
            return [
                body('email', conductorErrors.err1).optional({ checkFalsy: true }).isEmail(),
                body('name', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 100 }),
                body('institution', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 150 }),
                body('purpose', conductorErrors.err1).exists().isString().custom(validateRequestPurpose),
                body('facultyURL', conductorErrors.err1).exists().isString().isURL(),
                body('libraries', conductorErrors.err1).exists().custom(validateRequestLibraries).customSanitizer(ensureUniqueStringArray),
                body('moreInfo', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
        case 'completeRequest':
            return [
                body('requestID', conductorErrors.err1).exists().isMongoId()
            ]
        case 'deleteRequest':
            return [
                body('requestID', conductorErrors.err1).exists().isMongoId()
            ]
    }
};

module.exports = {
    submitRequest,
    getRequests,
    completeRequest,
    deleteRequest,
    validate
};
