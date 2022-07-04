//
// LibreTexts Conductor
// organizations.js
//

'use strict';
import express from 'express';
import { body, query } from 'express-validator';
import Organization from '../models/organization.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';

/**
 * Attempts to retrieve basic information about an Organization given its identifier.
 * NOTE: For internal use only. Does not provide a REST response.
 *
 * @param {string} orgID - The internal identifier.
 * @returns {Promise<object|null>} The Organization info object, or null if not found.
 */
async function lookupOrganization(orgID) {
  if (!orgID || typeof (orgID) !== 'string') {
    return null;
  }
  try {
    const org = await Organization.findOne(
      { orgID },
      { _id: 0, aliases: 0, defaultProjectLead: 0 },
    ).lean();
    if (org) {
      return org;
    }
  } catch (e) {
    debugError(e);
  }
  return null;
}

/**
 * Retrieves information about the Organization identified in the request query.
 * VALIDATION: 'getinfo'.
 *
 * @param {express.Request} req - The incoming request object.
 * @param {express.Response} res - The outgoing response object. 
 */
async function getOrganizationInfo(req, res) {
  const org = await lookupOrganization(req.query.orgID);
  if (!org) {
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err11,
    });
  }
  return res.send({
    err: false,
    ...org,
  });
}

/**
 * Retrieves information about the Organization the server is currently configured for.
 *
 * @param {express.Request} req - The incoming request object.
 * @param {express.Response} res - The outgoing response object.
 */
async function getCurrentOrganization(_req, res) {
  const org = await lookupOrganization(process.env.ORG_ID);
  if (!org) {
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
  return res.send({
    err: false,
    org,
  });
}

/**
 * Retrieves basic information about
 * all known Organizations. Method
 * should be restricted to users with
 * elevated privileges.
 */
const getAllOrganizations = (req, res) => {
    Organization.aggregate([
        {
            $match: {}
        }, {
            $project: {
                _id: 0,
                aliases: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((orgs) => {
        return res.send({
            err: false,
            orgs: orgs
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
 * Updates the Organization identified
 * by @orgID in the request body. Method
 * should be restricted to users with
 * elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'updateinfo'
 */
const updateOrganizationInfo = (req, res) => {
    var updateObj = {};
    if (req.body.hasOwnProperty('coverPhoto')) updateObj.coverPhoto = req.body.coverPhoto;
    if (req.body.hasOwnProperty('largeLogo')) updateObj.largeLogo = req.body.largeLogo;
    if (req.body.hasOwnProperty('mediumLogo')) updateObj.mediumLogo = req.body.mediumLogo;
    if (req.body.hasOwnProperty('smallLogo')) updateObj.smallLogo = req.body.smallLogo;
    if (req.body.hasOwnProperty('aboutLink')) updateObj.aboutLink = req.body.aboutLink;
    if (req.body.hasOwnProperty('commonsHeader')) updateObj.commonsHeader = req.body.commonsHeader;
    if (req.body.hasOwnProperty('commonsMessage')) updateObj.commonsMessage = req.body.commonsMessage;
    if (req.body.hasOwnProperty('mainColor')) updateObj.mainColor = req.body.mainColor;
    Organization.findOneAndUpdate({ orgID: req.body.orgID }, updateObj, {
        new: true, lean: true
    }).then((updatedOrg) => {
        if (updatedOrg) {
            // prune Org info before returning
            delete updatedOrg._id;
            delete updatedOrg.createdAt;
            delete updatedOrg.updatedAt;
            delete updatedOrg.aliases;
            return res.send({
                err: false,
                updatedOrg: updatedOrg
            });
        } else {
            throw(new Error('notfound'));
        }
    }).catch((err) => {
        if (err.message === 'notfound') {
            return res.send({
                err: true,
                errMsg: conductorErrors.err11
            });
        } else {
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method) => {
    switch (method) {
        case 'getinfo':
            return [
                query('orgID', conductorErrors.err1).exists().isLength({ min: 2 })
            ]
        case 'updateinfo':
            return [
                body('orgID', conductorErrors.err1).exists().isLength({ min: 2 }),
                body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('largeLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('mediumLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('smallLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('aboutLink', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('commonsHeader', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('commonsMessage', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('mainColor', conductorErrors.err1).optional({ checkFalsy: true }).isString().isHexColor()
            ]
    }
};

export default {
    getOrganizationInfo,
    getCurrentOrganization,
    getAllOrganizations,
    updateOrganizationInfo,
    validate
}
