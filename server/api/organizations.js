/**
 * @file Defines functions for interacting with Organizations (institutions with a
 *  LibreTexts-hosted Conductor instance).
 * @author LibreTexts <info@libretexts.org>
 */

'use strict';
import express from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Organization from '../models/organization.js';
import { ensureUniqueStringArray } from '../util/helpers.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';
import authAPI from './auth.js';

const assetStorage = multer.memoryStorage();

/**
 * Returns a Multer handler to process and validate organization brand asset uploads.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next function run in the middleware chain.
 * @returns {function} The asset upload handler.
 */
function assetUploadHandler(req, res, next) {
  const assetUploadConfig = multer({
    storage: assetStorage,
    fileFilter: (_req, file, cb) => {
      if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
        return cb(null, false);
      }
      return cb(null, true);
    },
    limits: {
      files: 1,
      fileSize: 5242880,
    },
  }).single('assetFile');
  return assetUploadConfig(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        errMsg = conductorErrors.err79;
      }
      return res.send({
        errMsg,
        err: true,
      });
    }
    next();
  });
}

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
 * Retrieves a basic list of all Organizations participating in the
 * LibreGrid/Campus Commons network.
 *
 * @param {express.Request} _req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getLibreGridOrganizations(_req, res) {
  try {
    const orgs = await Organization.aggregate([
      {
        $match: {
          addToLibreGridList: true,
        },
      }, {
        $project: {
          _id: 0,
          orgID: 1,
          name: 1,
          domain: 1,
        },
      }, {
        $sort: {
          name: 1,
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

    addToUpdateIfPresent('aboutLink');
    addToUpdateIfPresent('commonsHeader');
    addToUpdateIfPresent('commonsMessage');
    addToUpdateIfPresent('mainColor');
    addToUpdateIfPresent('catalogMatchingTags');

    if (
      Object.hasOwn(req.body, 'addToLibreGridList')
      && orgID !== 'libretexts'
      && Array.isArray(req.user?.roles)
    ) {
      const isCampusAdmin = authAPI.checkHasRole(
        { roles: req.user.roles },
        process.env.ORG_ID,
        'campusadmin',
      );
      if (isCampusAdmin) {
        updateObj.addToLibreGridList = req.body.addToLibreGridList;
      }
    }

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
 * Uploads a branding asset image to S3 and updates the specified Organization's record.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateBrandingImageAsset(req, res) {
  try {
    const { orgID, assetName } = req.params;

    if (typeof (req.file) !== 'object') {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const org = await Organization.findOne({ orgID }).lean();
    if (!org) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const fileExtension = req.file.mimetype?.split('/')[1];
    const fileKey = `assets/${orgID}_${assetName}.${fileExtension}`;
    if (typeof (fileExtension) !== 'string') {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }
    
    let assetVersion = 1;
    if (org[assetName].includes(process.env.AWS_ORGDATA_DOMAIN)) {
      const assetURLSplit = org[assetName].split('?v=');
      if (Array.isArray(assetURLSplit) && assetURLSplit.length > 1) {
        const currAssetVersion = Number.parseInt(assetURLSplit[1]);
        if (!Number.isNaN(currAssetVersion)) {
          assetVersion = currAssetVersion + 1;
        }
      }
    }

    const storageClient = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ORGDATA_ACCESS_KEY,
        secretAccessKey: process.env.AWS_ORGDATA_SECRET_KEY,
      },
      region: process.env.AWS_ORGDATA_REGION,
    });
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_ORGDATA_BUCKET,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    const uploadResponse = await storageClient.send(uploadCommand);
    if (uploadResponse['$metadata']?.httpStatusCode !== 200) {
      throw new Error('Error uploading asset to S3');
    }
    const assetURL = `https://${process.env.AWS_ORGDATA_DOMAIN}/${fileKey}?v=${assetVersion}`;

    const updateRes = await Organization.updateOne({ orgID }, {
      [assetName]: assetURL,
    });
    if (updateRes.modifiedCount !== 1) {
      throw new Error('Failed to update Organization');
    }

    return res.send({
      err: false,
      msg: 'Successfully updated branding asset.',
      url: assetURL,
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
 * Validates the provided branding asset image name against the list of allowed image fields.
 *
 * @param {string} assetName - The name of the asset field to update.
 * @returns {boolean} True if asset type is valid, false otherwise.
 */
function validateBrandingAssetName(assetName) {
  const assetFields = ['coverPhoto', 'largeLogo', 'mediumLogo', 'smallLogo'];
  return assetFields.includes(assetName);
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
        body('aboutLink', conductorErrors.err1).optional({ checkFalsy: true }).isURL(),
        body('commonsHeader', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ max: 200 }),
        body('commonsMessage', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ max: 500 }),
        body('mainColor', conductorErrors.err1).optional({ checkFalsy: true }).isHexColor(),
        body('addToLibreGridList', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
        body('catalogMatchingTags', conductorErrors.err1).optional({ checkFalsy: true }).isArray().customSanitizer(ensureUniqueStringArray),
      ];
    case 'updateBrandingImageAsset':
      return [
        param('orgID', conductorErrors.err1).exists().isLength({ min: 2, max: 50 }),
        param('assetName', conductorErrors.err1).exists().isString().custom(validateBrandingAssetName),
      ];
  }
}

export default {
  assetUploadHandler,
  getOrganizationInfo,
  getCurrentOrganization,
  getAllOrganizations,
  getLibreGridOrganizations,
  updateOrganizationInfo,
  updateBrandingImageAsset,
  validate
}
