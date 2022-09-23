/**
 * @file Defines functions for managing Account Requests for other LibreTexts services.
 * @author LibreTexts <info@libretexts.org>
 */

'use strict';
import express from 'express';
import { body, param } from 'express-validator';
import User from '../models/user.js';
import AccountRequest from '../models/accountrequest.js';
import conductorErrors from '../conductor-errors.js';
import { ensureUniqueStringArray } from '../util/helpers.js';
import { debugError } from '../debug.js';
import LibrariesMap from '../util/librariesmap.js';
import mailAPI from './mail.js';

/**
 * Creates a new AccountRequest and notifies the LibreTexts team.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function submitRequest(req, res) {
  try {
    const foundUser = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
    if (!foundUser) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err9,
      });
    }

    const instructorProfile = foundUser.instructorProfile;
    if (!instructorProfile && (!req.body.institution || !req.body.facultyURL)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err74,
      });
    }

    // Add instructor profile to user record
    if (!instructorProfile) {
      const updateRes = await User.updateOne({ uuid: req.user.decoded.uuid }, {
        instructorProfile: {
          institution: req.body.institution,
          facultyURL: req.body.facultyURL,
        },
      });
      if (updateRes.modifiedCount !== 1) {
        throw (new Error("Couldn't update User instructor profile"));
      }
    }

    await new AccountRequest({
      requester: foundUser.uuid,
      status: 'open',
      purpose: req.body.purpose,
      libraries: req.body.libraries,
      moreInfo: req.body.moreInfo,
    }).save();
  
    // Notify LibreTexts team
    mailAPI.sendAccountRequestAdminNotif();
    // Send confirmation to user
    mailAPI.sendAccountRequestConfirmation(
      `${foundUser.firstName} ${foundUser.lastName}`,
      foundUser.email,
    );
  
    return res.send({
      err: false,
      msg: 'Account Request successfully submitted.',
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
 * Retrieves all Account Requests.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
async function getRequests(_req, res) {
  try {
    const requests = await AccountRequest.aggregate([
      {
        $lookup: {
          from: 'users',
          let: { requester: '$requester' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$uuid', '$$requester'],
              },
            },
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
              email: 1,
              instructorProfile: 1,
            },
          }],
          as: 'requester',
        },
      }, {
        $addFields: {
          requester: {
            $cond: [
              { $gt: [{ $size: '$requester' }, 0] },
              { $arrayElemAt: ['$requester', 0] },
              '$$REMOVE',
            ],
          }
        },
      }, {
        $addFields: {
          name: {
            $cond: [
              { 
                $and: [
                  { $ne: [{ $type: '$requester.firstName' }, 'missing'] },
                  { $ne: [{ $type: '$requester.lastName' }, 'missing'] },
                ],
              },
              { $concat: ['$requester.firstName', ' ', '$requester.lastName'] },
              '$name',
            ],
          },
          email: {
            $cond: [
              { $ne: [{ $type: '$requester.email' }, 'missing'] },
              '$requester.email',
              '$email',
            ],
          },
          institution: {
            $cond: [
              { $ne: [{ $type: '$requester.instructorProfile.institution' }, 'missing'] },
              '$requester.instructorProfile.institution',
              '$institution',
            ],
          },
          facultyURL: {
            $cond: [
              { $ne: [{ $type: '$requester.instructorProfile.facultyURL' }, 'missing'] },
              '$requester.instructorProfile.facultyURL',
              '$facultyURL',
            ],
          },
        },
      }, {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
    return res.send({
      requests,
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
 * Marks an Account Request as completed.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function completeRequest(req, res) {
  try {
    const { requestID } = req.params;
    const foundRequest = await AccountRequest.findOne({ _id: requestID }).lean();
    if (!foundRequest) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const updateRes = await AccountRequest.updateOne(
      { _id: requestID },
      { status: 'completed' },
    );
    if (updateRes.modifiedCount === 1) {
      mailAPI.sendAccountRequestApprovalNotification(foundRequest.name, foundRequest.email);
    }
    return res.send({
      err: false,
      msg: 'Succesfully marked Account Request as complete.',
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
 * Deletes an AccountRequest.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function deleteRequest(req, res) {
  try {
    const { requestID } = req.params;
    const deleteRes = await AccountRequest.deleteOne({ _id: requestID });
    if (deleteRes.deletedCount === 1) {
      return res.send({
        err: false,
        msg: 'Account Request successfully deleted.',
      });
    }
    return res.status(404).send({
      err: true,
      errMsg: conductorErrors.err11,
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
 * Validates the provided "purpose" field of a submitted request. If the request if for LibreTexts
 * libraries access, the `libraries` field is also validated.
 *
 * @param {string} purpose - Purpose of Account Request. 
 * @param {object} data - Data passed from the validation library.
 * @param {object} data.req - Information about the original network request, including body.
 * @returns {boolean} True if valid purpose (and libraries, if applicable), false otherwise.
 * @throws Throws error message if the request is for LibreTexts libraries access and an invalid
 *  list of libraries were provided.
 */
function validateRequestPurpose(purpose, { req }) {
  const validPurposes = ['oer', 'h5p', 'adapt'];
  if (typeof (purpose) !== 'string') {
    return false;
  }
  const isValidPurpose = validPurposes.includes(purpose);
  if (!isValidPurpose) {
    return false;
  }
  if (purpose !== 'oer') {
    return true;
  }
  if (
    isValidPurpose
    && Array.isArray(req.body.libraries)
    && req.body.libraries.length > 0
    && req.body.libraries.length < 4
  ) {
    let validArray = true;
    req.body.libraries.forEach((item) => {
      const foundLibrary = LibrariesMap.find((lib) => lib.key === item);
      if (!foundLibrary) {
        validArray = false;
      }
    });
    if (validArray) {
      return true;
    }
  }
  throw (new Error(conductorErrors.err73));
}

/**
 * Middleware(s) to verify that requests contain necessary and/or valid fields.
 *
 * @param {string} method - Method name to validate request for. 
 */
function validate(method) {
  switch (method) {
    case 'submitRequest':
      return [
        body('purpose', conductorErrors.err1).exists().custom(validateRequestPurpose),
        body('institution', conductorErrors.err1).optional().isLength({ min: 2, max: 100 }),
        body('facultyURL', conductorErrors.err1).optional().isURL(),
        body('libraries', conductorErrors.err1).optional().customSanitizer(ensureUniqueStringArray),
        body('moreInfo', conductorErrors.err1).optional().isBoolean().toBoolean(),
      ];
    case 'completeRequest':
      return [
        param('requestID', conductorErrors.err1).exists().isMongoId(),
      ];
    case 'deleteRequest':
      return [
        param('requestID', conductorErrors.err1).exists().isMongoId(),
      ];
  }
}

export default {
    submitRequest,
    getRequests,
    completeRequest,
    deleteRequest,
    validate
}
