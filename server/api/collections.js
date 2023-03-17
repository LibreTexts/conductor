//
// LibreTexts Conductor
// collections.js
//

"use strict";
import { body, query, param } from "express-validator";
import b62 from "base62-random";
import Collection from "../models/collection.js";
import conductorErrors from "../conductor-errors.js";
import { isEmptyString, ensureUniqueStringArray } from "../util/helpers.js";
import { debugError } from "../debug.js";
import { checkBookIDFormat } from "../util/bookutils.js";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const assetStorage = multer.memoryStorage();

/**
 * Returns a Multer handler to process and validate collection image asset uploads.
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
      if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
        return cb(null, false);
      }
      return cb(null, true);
    },
    limits: {
      files: 1,
      fileSize: 5242880,
    },
  }).single("assetFile");
  return assetUploadConfig(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
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
 * Uploads a collection asset image to S3 and updates the specified Collection's record.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateCollectionImageAsset(req, res) {
  try {
    const { collID, assetName } = req.params;

    if (typeof req.file !== "object") {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const coll = await Collection.findOne({ collID }).lean();
    if (!coll) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const fileExtension = req.file.mimetype?.split("/")[1];
    const fileKey = `assets/${collID}_${assetName}.${fileExtension}`;
    if (typeof fileExtension !== "string") {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    let assetVersion = 1;
    if (coll[assetName].includes(process.env.AWS_COLLECTIONDATA_DOMAIN)) {
      const assetURLSplit = coll[assetName].split("?v=");
      if (Array.isArray(assetURLSplit) && assetURLSplit.length > 1) {
        const currAssetVersion = Number.parseInt(assetURLSplit[1]);
        if (!Number.isNaN(currAssetVersion)) {
          assetVersion = currAssetVersion + 1;
        }
      }
    }

    const storageClient = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_COLLECTIONDATA_ACCESS_KEY,
        secretAccessKey: process.env.AWS_COLLECTIONDATA_SECRET_KEY,
      },
      region: process.env.AWS_COLLECTIONDATA_REGION,
    });
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_COLLECTIONDATA_BUCKET,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    const uploadResponse = await storageClient.send(uploadCommand);
    if (uploadResponse["$metadata"]?.httpStatusCode !== 200) {
      throw new Error("Error uploading asset to S3");
    }
    const assetURL = `https://${process.env.AWS_COLLECTIONDATA_DOMAIN}/${fileKey}?v=${assetVersion}`;

    const updateRes = await Collection.updateOne(
      { collID },
      {
        [assetName]: assetURL,
      }
    );
    if (updateRes.modifiedCount !== 1) {
      throw new Error("Failed to update Collection");
    }

    return res.send({
      err: false,
      msg: "Successfully updated Collection asset.",
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
 * Creates and saves a new Collection with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'createCollection'
 */
const createCollection = (req, res) => {
  const collectionData = {
    orgID: process.env.ORG_ID,
    collID: b62(8),
    title: req.body.title,
  };
  if (
    req.body.coverPhoto !== undefined &&
    req.body.coverPhoto !== null &&
    !isEmptyString(req.body.coverPhoto)
  ) {
    collectionData.coverPhoto = req.body.coverPhoto;
  }
  if (
    req.body.privacy !== undefined &&
    req.body.privacy !== null &&
    !isEmptyString(req.body.privacy)
  ) {
    collectionData.privacy = req.body.privacy;
  } else {
    collectionData.privacy = "public";
  }
  if (typeof req.body.autoManage === "boolean") {
    collectionData.autoManage = req.body.autoManage;
  }
  if (req.body.program) {
    collectionData.program = req.body.program;
  }
  if (Array.isArray(req.body.locations)) {
    collectionData.locations = req.body.locations;
  }
  new Collection(collectionData)
    .save()
    .then((newDoc) => {
      if (newDoc) {
        return res.send({
          err: false,
          msg: "Collection successfully created.",
          collID: newDoc.collID,
        });
      } else {
        throw conductorErrors.err3;
      }
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Updates the Collection identified
 * by the colID in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'editCollection'
 */
const editCollection = (req, res) => {
  const updateData = {};
  if (req.body.title) {
    updateData.title = req.body.title;
  }
  if (req.body.coverPhoto) {
    updateData.coverPhoto = req.body.coverPhoto;
  }
  if (req.body.privacy) {
    updateData.privacy = req.body.privacy;
  }
  if (typeof req.body.autoManage === "boolean") {
    updateData.autoManage = req.body.autoManage;
  }
  if (req.body.program) {
    updateData.program = req.body.program;
  }
  if (Array.isArray(req.body.locations)) {
    updateData.locations = req.body.locations;
  }
  if (Object.keys(updateData).length === 0) {
    return res.send({
      err: false,
      msg: "No changes to save.",
    });
  }
  Collection.updateOne({ collID: req.body.collID }, updateData)
    .then((updateRes) => {
      console.log(updateRes);
      if (updateRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Collection successfully updated.",
        });
      } else {
        throw new Error("updatefailed");
      }
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Deletes the Collection identified by
 * the colID in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteCollection'
 */
const deleteCollection = (req, res) => {
  Collection.deleteOne({ collID: req.body.collID })
    .then((deleteRes) => {
      if (deleteRes.deletedCount === 1) {
        return res.send({
          err: false,
          msg: "Collection successfully deleted.",
        });
      } else {
        throw conductorErrors.err3;
      }
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Returns all PUBLIC Collections for the
 * organization handled by the
 * current server instance.
 * Requests are safe to be anonymous/
 * public.
 */
const getCommonsCollections = (_req, res) => {
  Collection.aggregate([
    {
      $match: {
        orgID: process.env.ORG_ID,
        privacy: "public",
      },
    },
    {
      $sort: {
        title: 1,
      },
    },
    {
      $project: {
        _id: 0,
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    },
    {
      $project: {
        orgID: 1,
        collID: 1,
        title: 1,
        coverPhoto: 1,
        resources: {
          $size: "$resources",
        },
      },
    },
  ])
    .then((colls) => {
      return res.send({
        err: false,
        colls: colls,
      });
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Returns all collections for the
 * organization handled by the
 * current server instance, including
 * the full stored array of resources.
 * NOTE: Returns all Collections in the
 *   organization, regardless of privacy
 *   setting. Method should be placed
 *   after role validation.
 * OPTIONAL QUERY PARAMS:
 *   detailed: "true" disables the default
 *             collapsing of the resources
 *             list to its length.
 */
const getAllCollections = (req, res) => {
  let projectObj = {
    orgID: 1,
    collID: 1,
    title: 1,
    coverPhoto: 1,
    privacy: 1,
    program: 1,
    locations: 1,
    autoManage: 1,
  };
  if (req.query.detailed === "true") {
    projectObj.resources = 1;
  } else {
    // collapse resources field to list length by default
    projectObj.resources = {
      $size: {$match: 
        {'$resource.resourceType': 'resource'}

    }
  }
  }
  Collection.aggregate([
    {
      $match: {
        orgID: process.env.ORG_ID,
      },
    },
    {
      $sort: {
        title: -1,
      },
    },
    {
      $project: {
        _id: 0,
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    },
    {
      $project: projectObj,
    },
  ])
    .then((colls) => {
      return res.send({
        err: false,
        colls: colls,
      });
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Returns all books for the
 * collection specified by
 * the @collID parameter.
 * Requests are safe to be anonymous/
 * public.
 */
const getCollection = (req, res) => {
  Collection.aggregate([
    {
      $match: {
        $or: [
          {
            collID: req.params.collID,
          },
          {
            title: req.body.title,
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$resources",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "books",
        let: {
          bookID: "$bookID",
          resourceID: "$resources.resourceID",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$bookID", "$$resourceID"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              __v: 0,
            },
          },
          {
            $sort: {
              bookID: 1,
            },
          },
        ],
        as: "bookResults",
      },
    },
    {
      $lookup: {
        from: "collections",
        let: {
          collID: "$collID",
          resourceID: "$resources.resourceID",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$collID", "$$resourceID"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              __v: 0,
            },
          },
          {
            $sort: {
              collID: 1,
            },
          },
        ],
        as: "collectionResults",
      },
    },
    {
      $project: {
        _id: 0,
        orgID: 1,
        collID: 1,
        title: 1,
        coverPhoto: 1,
        privacy: 1,
        resources: {
            $concatArrays: [ "$bookResults", "$collectionResults" ] 
            }
         }
    }
  ])
    .then((collections) => {
      let combinedResources = [];
      collections.forEach((coll) => {
        combinedResources.push(coll.resources)
      })
      collections[0].resources = combinedResources;
      if (collections.length > 0) {
        return res.send({
          err: false,
          coll: collections[0],
        });
      } else {
        return res.send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      }
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Adds the Book identified by the
 * body's @bookID to the Collection
 * identified by the body's @colID.
 * If the Book is already in the Collection,
 * no change is made (unique entries).
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'addCollResource'
 */
const addResourceToCollection = (req, res) => {
  Collection.updateOne(
    { collID: req.body.collID },
    {
      $addToSet: {
        resources: req.body.bookID,
      },
    }
  )
    .then((updateRes) => {
      if (updateRes.matchedCount === 1 && updateRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Resource successfully added to Collection.",
        });
      } else if (updateRes.n === 0) {
        throw new Error("notfound");
      } else {
        throw new Error("updatefailed");
      }
    })
    .catch((err) => {
      if (err.message === "notfound") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      } else {
        debugError(err);
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err6,
        });
      }
    });
};

/**
 * Removes the Book identified by the
 * body's @bookID to the Collection identified
 * by the body's @colID. If the Book is not
 * in the Collection, no change is made. All
 * instances of the @bookID are removed from
 * the Collection to combat duplicate entries.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'remCollResource'
 */
const removeResourceFromCollection = (req, res) => {
  Collection.updateOne(
    { collID: req.body.collID },
    {
      $pullAll: {
        resources: [req.body.bookID],
      },
    }
  )
    .then((updateRes) => {
      if (updateRes.matchedCount === 1 && updateRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Resource successfully removed from Collection.",
        });
      } else if (updateRes.n === 0) {
        throw new Error("notfound");
      } else {
        throw new Error("updatefailed");
      }
    })
    .catch((err) => {
      if (err.message === "notfound") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      } else {
        debugError(err);
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err6,
        });
      }
    });
};

/**
 * Verifies that a specified collection privacy setting is an allowed value.
 *
 * @param {string} privSetting - The specified privacy setting.
 * @returns {boolean} True if valid, false otherwise.
 */
const checkValidPrivacy = (privSetting) => {
  const allowedPrivacies = ["public", "private", "campus"];
  return allowedPrivacies.includes(privSetting);
};

/**
 * Sanitizes an array of Collection auto-management search locations to only
 * include allowed values.
 *
 * @param {string[]} locations - An array of search location strings.
 * @returns {string[]} The santized search locations array.
 */
const collectionLocationsSanitizer = (locations) => {
  const allowedLocs = ["central", "campus"];
  const sanitizedLocs = [];
  if (Array.isArray(locations)) {
    for (let i = 0, n = locations.length; i < n; i += 1) {
      if (allowedLocs.includes(locations[i])) {
        sanitizedLocs.push(locations[i]);
      }
    }
  }
  return sanitizedLocs;
};

/**
 * Validates the provided collection asset image name against the list of allowed image fields.
 *
 * @param {string} assetName - The name of the asset field to update.
 * @returns {boolean} True if asset type is valid, false otherwise.
 */
function validateCollectionAssetName(assetName) {
  const assetFields = ["coverPhoto"];
  return assetFields.includes(assetName);
}

/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
  switch (method) {
    case "createCollection":
      return [
        body("title", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 3 }),
        body("coverPhoto", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .isLength({ min: 2 }),
        body("privacy", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .custom(checkValidPrivacy),
        body("autoManage", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .toBoolean()
          .isBoolean(),
        body("program", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString(),
        body("locations", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isArray()
          .customSanitizer(ensureUniqueStringArray)
          .customSanitizer(collectionLocationsSanitizer),
      ];
    case "editCollection":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 8, max: 8 }),
        body("title", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .isLength({ min: 3 }),
        body("coverPhoto", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .isLength({ min: 2 }),
        body("privacy", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .custom(checkValidPrivacy),
        body("autoManage", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .toBoolean()
          .isBoolean(),
        body("program", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString(),
        body("locations", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isArray()
          .customSanitizer(ensureUniqueStringArray)
          .customSanitizer(collectionLocationsSanitizer),
      ];
    case "deleteCollection":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 8, max: 8 }),
      ];
    case "getCollection":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 8, max: 8 }),
      ];
    case "addCollResource":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 8, max: 8 }),
        body("bookID", conductorErrors.err1).exists().custom(checkBookIDFormat),
      ];
    case "remCollResource":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 8, max: 8 }),
        body("bookID", conductorErrors.err1).exists().custom(checkBookIDFormat),
      ];
    case "updateCollectionImageAsset":
      return [
        param("collID", conductorErrors.err1)
          .exists()
          .isLength({ min: 8, max: 8 }),
        param("assetName", conductorErrors.err1)
          .exists()
          .isString()
          .custom(validateCollectionAssetName),
      ];
  }
};

export default {
  assetUploadHandler,
  updateCollectionImageAsset,
  createCollection,
  editCollection,
  deleteCollection,
  getCommonsCollections,
  getAllCollections,
  getCollection,
  addResourceToCollection,
  removeResourceFromCollection,
  validate,
};
