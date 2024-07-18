import b62 from "base62-random";
import { BookInterface } from "../models/book";
import Collection, { CollectionInterface } from "../models/collection.js";
import conductorErrors from "../conductor-errors.js";
import {
  addCollectionResourceSchema,
  createCollectionSchema,
  deleteCollectionSchema,
  editCollectionSchema,
  getAllCollectionsSchema,
  getCollectionResourcesSchema,
  getCollectionSchema,
  getCommonsCollectionsSchema,
  removeCollectionResourceSchema,
  updateCollectionImageAssetSchema
} from "./validators/collections";
import { debugError } from "../debug.js";
import { FilterQuery } from "mongoose";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response, NextFunction } from 'express';
import { ResourceInterface } from "../models/resource";
import { z } from "zod";

const assetStorage = multer.memoryStorage();

/**
 * Returns a Multer handler to process and validate collection image asset uploads.
 *
 * @returns The asset upload handler.
 */
function assetUploadHandler(req: Request, res: Response, next: NextFunction) {
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
 */
async function updateCollectionImageAsset(req: z.infer<typeof updateCollectionImageAssetSchema> & { file: Express.Multer.File }, res: Response) {
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
    const collectionDataDomain = process.env.AWS_COLLECTIONDATA_DOMAIN;
    if (collectionDataDomain && coll[assetName].includes(collectionDataDomain)) {
      const assetURLSplit = coll[assetName].split("?v=");
      if (Array.isArray(assetURLSplit) && assetURLSplit.length > 1) {
        const currAssetVersion = Number.parseInt(assetURLSplit[1]);
        if (!Number.isNaN(currAssetVersion)) {
          assetVersion = currAssetVersion + 1;
        }
      }
    }

    const accessKeyId = process.env.AWS_COLLECTIONDATA_ACCESS_KEY;
    const secretAccessKey = process.env.AWS_COLLECTIONDATA_SECRET_KEY;
    const region = process.env.AWS_COLLECTIONDATA_REGION;
    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error('Missing S3 configuration for asset upload.')
    }
    const storageClient = new S3Client({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region,
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
 * Creates and saves a new Collection with the data in the request body.
 */
async function createCollection(req: z.infer<typeof createCollectionSchema>, res: Response) {
  try {
    const { coverPhoto, locations, parentID, program, ...body } = req.body;
    const newCollection = await Collection.create({
      autoManage: body.autoManage ?? false,
      collID: b62(8),
      orgID: process.env.ORG_ID,
      privacy: body.privacy ?? 'public',
      title: body.title,
      ...(coverPhoto && { coverPhoto }),
      ...(locations && { locations }),
      ...(parentID && { parentID }),
      ...(program && { program }),
    });
    const collectionToAdd = { resourceId: newCollection.collID, resourceType: 'collection' };
    if (parentID) {
      await Collection.updateOne(
          { collID: parentID },
          {
            $addToSet: {
              resources: collectionToAdd,
            }
          }
      );
    }
    return res.send({
      err: false,
      msg: "Collection successfully created.",
      collID: newCollection.collID,
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
 * Updates the Collection identified by the collID in the request params.
 */
async function editCollection(req: z.infer<typeof editCollectionSchema>, res: Response) {
  try {
    const foundCollection = await Collection.findOne({ collID: req.params.collID });
    if (!foundCollection) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }
    const existParentId = foundCollection.parentID;
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
      return res.send({
        err: false,
        msg: 'No changes to save.',
      });
    }

    await Collection.updateOne({ collID: req.params.collID }, updateData);
    if (existParentId && updateData.parentID && existParentId !== updateData.parentID) {
      const resourceToModify = { resourceId: req.params.collID, resourceType: 'collection' };
      await Promise.all([
        // remove from existing parent
        Collection.updateOne(
            { collID: existParentId },
            {
              $pull: {
                resources: resourceToModify
              }
            }
        ),
        // add to new parent
        Collection.updateOne(
          { collID: updateData.parentID },
          {
            $addToSet: {
              resources: resourceToModify,
            }
          }
        ),
      ]);
    }

    return res.send({
      err: false,
      msg: "Collection successfully updated.",
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
 * Deletes the Collection identified by the collID in the request params.
 */
async function deleteCollection(req: z.infer<typeof deleteCollectionSchema>, res: Response) {
  try {
    const collToDelete = await Collection.findOne({
      collID: req.params.collID,
    }).lean();
    if (!collToDelete) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }
    if (collToDelete.parentID) {
      await Collection.updateOne(
        { collID: collToDelete.parentID },
        {
          $pull: {
            resources: { resourceID: req.params.collID, resourceType: 'collection' },
          },
        }
      )
    }
    await Collection.deleteOne({ collID: req.params.collID });
    return res.send({
      err: false,
      msg: "Collection successfully deleted.",
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
 * Returns all PUBLIC Collections for the organization handled by the current server instance. Requests are safe to be
 * anonymous/public.
 */
async function getCommonsCollections(req: z.infer<typeof getCommonsCollectionsSchema>, res: Response) {
  try {
    const { detailed, limit, page, query, sort, sortDirection } = req.query;
    const projectObj = {
      orgID: 1,
      collID: 1,
      title: 1,
      coverPhoto: 1,
      resourceCount: { $size: "$resources" },
      ...(detailed && { resources: 1 }),
    };
    const matchConds: FilterQuery<any>[] = [
      {
        $expr: {
          $eq: ["$orgID", process.env.ORG_ID],
        },
      },
      {
        $expr: {
          $eq: ["$privacy", "public"],
        },
      },
      {
        $or: [
          {
            $expr: {
              $eq: ["$parentID", ""],
            },
          },
          {
            parentID: { $exists: false },
          },
        ],
      },
    ];
    if (query) {
      matchConds.push({
        $or: [
          {
            program: {
              $regex: query,
              $options: 'i',
            },
          },
          {
            title: {
              $regex: query,
              $options: 'i',
            },
          }
        ]
      });
    }
    const collections = await Collection.aggregate([
      {
        $match: { $and: matchConds },
      },
      {
        $sort: {
          [sort]: sortDirection === 'ascending' ? 1 : -1,
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
    ]).limit(limit).skip((page - 1) * limit);
    return res.send({
      err: false,
      collections,
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
 * Returns all collections for the organization handled by the current server instance (regardless of privacy setting),
 * optionally including the full stored array of resources.
 */
async function getAllCollections(req: z.infer<typeof getAllCollectionsSchema>, res: Response) {
  try {
    const { detailed, limit, page, query, sort, sortDirection } = req.query;
    const projectObj = {
      orgID: 1,
      collID: 1,
      title: 1,
      coverPhoto: 1,
      privacy: 1,
      program: 1,
      locations: 1,
      autoManage: 1,
      resourceCount: { $size: "$resources" },
      ...(detailed && { resources: 1 }),
    };
    const matchConds: FilterQuery<any>[] = [
      {
        $expr: {
          $eq: ["$orgID", process.env.ORG_ID],
        },
      },
      {
        $or: [
          {
            $expr: {
              $eq: ["$parentID", ""],
            },
          },
          {
            parentID: { $exists: false },
          },
        ],
      },
    ];
    if (query) {
      matchConds.push({
        $or: [
          {
            program: {
              $regex: query,
              $options: 'i',
            },
          },
          {
            title: {
              $regex: query,
              $options: 'i',
            },
          }
        ]
      });
    }
    const collections = await Collection.aggregate([
      {
        $match: { $and: matchConds },
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
        $project: projectObj,
      },
    ]);
    return res.send({
      err: false,
      collections,
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
 * Returns the collection specified by the @collID parameter (ID or uri-encoded title). Does NOT include resources.
 * Requests are safe to be anonymous/public.
 */
async function getCollection(req: z.infer<typeof getCollectionSchema>, res: Response) {
  try {
    const collection = await Collection.findOne(
        {
          $or: [
            { collID: req.params.collID },
            { title: decodeURIComponent(req.params.collID) },
          ],
        },
        { resources: 0 },
    );
    if (!collection) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }
    return res.send({
      err: false,
      collection,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getCollectionResources(req: z.infer<typeof getCollectionResourcesSchema>, res: Response) {
  try {

    const { limit, page, query, sort, sortDirection } = req.query;
    const bookMatchConds: FilterQuery<any>[] = [
      {
        $eq: ["$$resourceType", "resource"],
      },
      {
        $eq: ["$bookID", "$$resourceID"],
      },
    ];
    const collMatchConds: FilterQuery<any>[] = [
      {
        $eq: ["$$resourceType", "collection"],
      },
      {
        $eq: ["$collID", "$$resourceID"],
      },
    ];
    if (query) {
      bookMatchConds.push({
        $or: [
          {
            title: {
              $regex: query,
              $options: 'i',
            },
          },
          {
            author: {
              $regex: query,
              $options: 'i',
            },
          },
        ],
      });
      collMatchConds.push({
        $or: [
          {
            program: {
              $regex: query,
              $options: 'i',
            },
          },
          {
            title: {
              $regex: query,
              $options: 'i',
            },
          }
        ],
      });
    }
    const collections = await Collection.aggregate([
      {
        $match: {
          $or: [
            { collID: req.params.collID },
            { title: decodeURIComponent(req.params.collID) },
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
            resourceType: "$resources.resourceType",
            resourceID: "$resources.resourceID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: bookMatchConds,
                },
              },
            },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "bookRes",
        },
      },
      {
        $addFields: {
          "resources.book": {
            $arrayElemAt: ["$bookRes", 0],
          },
        },
      },
      {
        $lookup: {
          from: "collections",
          let: {
            resourceType: "$resources.resourceType",
            resourceID: "$resources.resourceID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: collMatchConds,
                },
              },
            },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "collectionRes",
        },
      },
      {
        $addFields: {
          "resources.collection": {
            $arrayElemAt: ["$collectionRes", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          orgID: {
            $first: "$orgID",
          },
          collID: {
            $first: "$collID",
          },
          title: {
            $first: "$title",
          },
          coverPhoto: {
            $first: "$coverPhoto",
          },
          privacy: {
            $first: "$privacy",
          },
          resources: {
            $push: "$resources",
          },
          autoManage: {
            $first: "$autoManage",
          },
          program: {
            $first: "$program",
          },
          locations: {
            $first: "$locations",
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0
        },
      },
      {
        $sort: {
          [sort]: sortDirection === 'ascending' ? 1 : -1,
        }
      }
    ]).limit(limit).skip((page - 1) * limit);
    if (collections.length < 1) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }
    const collection = collections[0];
    const resources = Array.isArray(collection.resources) ? collection.resources.map((item: ResourceInterface & { book?: BookInterface; collection?: CollectionInterface }) => ({
      resourceType: item.resourceType,
      resourceID: item.resourceID,
      resourceData: item.book || item.collection,
    })) : [];
    return res.send({
      err: false,
      collID: collection.collID,
      resources,
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
 * Adds the Book(s) identified in the request body to the Collection. If the Book(s) are already in the Collection, no
 * change is made (unique entries).
 */
async function addResourcesToCollection(req: z.infer<typeof addCollectionResourceSchema>, res: Response) {
  try {
    const { collID } = req.params;
    const { books } = req.body;
    const resourcesToAdd = books.map((resourceID) => ({
      resourceID,
      resourceType: 'resource',
    }));
    const collection = await Collection.findOne({ collID }).lean();
    if (!collection) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }

    await Collection.updateOne(
      { collID },
      {
        $addToSet: {
          resources: {
            $each: resourcesToAdd,
          },
        },
      },
    );
    return res.send({
      err: false,
      msg: "Resource(s) successfully added to Collection.",
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
 * Removes the resource identified in the request params from the Collection identified. If the resource is not in the
 * Collection, no change is made. All instances of the resource are removed from the Collection to combat
 * duplicate entries.
 */
async function removeResourceFromCollection(req: z.infer<typeof removeCollectionResourceSchema>, res: Response) {
  try {
    const { collID, resourceID } = req.params;
    const collection = await Collection.findOne({ collID }).lean();
    if (!collection) {
      return res.status(404).send({
        err: true,
        msg: conductorErrors.err11,
      });
    }

    await Collection.updateOne(
      { collID: req.params.collID },
      {
        $pull: {
          resources: { resourceID },
        },
      }
    );
    return res.send({
      err: false,
      msg: "Resource successfully removed from Collection.",
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export default {
  addResourcesToCollection,
  assetUploadHandler,
  createCollection,
  deleteCollection,
  editCollection,
  getAllCollections,
  getCollection,
  getCollectionResources,
  getCommonsCollections,
  removeResourceFromCollection,
  updateCollectionImageAsset,
};
