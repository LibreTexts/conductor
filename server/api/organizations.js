/**
 * @file Defines functions for interacting with Organizations (institutions with a
 *  LibreTexts-hosted Conductor instance).
 * @author LibreTexts <info@libretexts.org>
 */

'use strict';
import express from 'express';
import { body, param } from 'express-validator';
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
 *
 * @param {express.Request} req - The incoming request object.
 * @param {express.Response} res - The outgoing response object. 
 */
async function getOrganizationInfo(req, res) {
  const org = await lookupOrganization(req.params.orgID);
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
 * Retrieves basic information about all known Organizations.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object. 
 */
async function getAllOrganizations(_req, res) {
  try {
    const orgs = await Organization.aggregate([
      {
        $project: {
          _id: 0,
          aliases: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);
    return res.send({
      orgs,
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
 * Updates an Organization's information.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateOrganizationInfo(req, res) {
  try {
    const { orgID } = req.params;

    // Build update object
    const updateObj = {};

    const addToUpdateIfPresent = (key) => {
      if (Object.hasOwn(req.body, key)) {
        updateObj[key] = req.body[key];
      }
    };

    addToUpdateIfPresent('coverPhoto');
    addToUpdateIfPresent('largeLogo');
    addToUpdateIfPresent('mediumLogo');
    addToUpdateIfPresent('smallLogo');
    addToUpdateIfPresent('aboutLink');
    addToUpdateIfPresent('commonsHeader');
    addToUpdateIfPresent('commonsMessage');
    addToUpdateIfPresent('mainColor');

    // Save updates
    const updated = await Organization.findOneAndUpdate({ orgID }, updateObj, {
      new: true,
      lean: true,
      projection: { _id: 0, createdAt: 0, updatedAt: 0, aliases: 0 },
    });
    if (!updated) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    return res.send({
      err: false,
      updatedOrg: updated,
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
 * Middleware(s) to verify that requests contain necessary and/or valid fields.
 *
 * @param {string} method - Method name to validate request for.
 */
function validate(method) {
  switch (method) {
    case 'getinfo':
      return [
        param('orgID', conductorErrors.err1).exists().isLength({ min: 2, max: 50 }),
      ];
    case 'updateinfo':
      return [
        param('orgID', conductorErrors.err1).exists().isLength({ min: 2, max: 50 }),
        body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 2 }),
        body('largeLogo', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 2 }),
        body('mediumLogo', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 2 }),
        body('smallLogo', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 2 }),
        body('aboutLink', conductorErrors.err1).optional({ checkFalsy: true }).isURL(),
        body('commonsHeader', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ max: 200 }),
        body('commonsMessage', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ max: 500 }),
        body('mainColor', conductorErrors.err1).optional({ checkFalsy: true }).isHexColor(),
      ];
  }
}

export default {
    getOrganizationInfo,
    getCurrentOrganization,
    getAllOrganizations,
    updateOrganizationInfo,
    validate
}
