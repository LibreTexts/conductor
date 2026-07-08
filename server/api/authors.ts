import { z } from "zod";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { debugError } from "../debug.js";
import Author from "../models/author.js";
import {
  CreateAuthorValidator,
  DeleteAuthorValidator,
  GetAuthorsValidator,
  GetAuthorAssetsValidator,
  GetAuthorValidator,
  UpdateAuthorValidator,
  UploadAuthorPictureValidator,
  GetAuthorByNameKeyValidator,
} from "./validators/authors.js";
import conductorErrors from "../conductor-errors.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";
import ProjectFile from "../models/projectfile.js";
import AuthorService from "./services/author-service.js";

const ALLOWED_PICTURE_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];
const authorPictureStorage = multer.memoryStorage();

/**
 * Multer middleware that processes and validates an author picture upload.
 * Accepts a single JPEG/PNG/WebP image (<= 5 MB) on the "file" field.
 */
function authorPictureUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const config = multer({
    storage: authorPictureStorage,
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_PICTURE_MIMETYPES.includes(file.mimetype)) {
        return cb(null, false);
      }
      return cb(null, true);
    },
    limits: {
      files: 1,
      fileSize: 5242880, // 5 MB
    },
  }).single("file");
  return config(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        errMsg = conductorErrors.err54;
      }
      return res.send({
        errMsg,
        err: true,
      });
    }
    next();
  });
}

async function getAuthors(
  req: z.infer<typeof GetAuthorsValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();
    const data = await authorService.getAuthors(req.query);

    res.send({
      err: false,
      ...data,
    });
  } catch (error) {
    debugError(error);
    return conductor500Err(res);
  }
}

async function getAuthor(
  req: z.infer<typeof GetAuthorValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();
    const author = await authorService.getAuthorByID(req.params.id);

    if (!author) {
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
    }

    res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAuthorByNameKey(
  req: z.infer<typeof GetAuthorByNameKeyValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();

    const author = await authorService.getAuthorByNameKey(req.params.key, req.query.includeProjects);
    if (!author) {
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
    }

    res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAuthorAssets(
  req: z.infer<typeof GetAuthorAssetsValidator>,
  res: Response
) {
  try {
    const page = parseInt(req.query.page?.toString()) || 1;
    const limit = parseInt(req.query.limit?.toString()) || 10;
    const offset = getPaginationOffset(page, limit);

    const author = await Author.findOne({
      _id: req.params.id,
      orgID: process.env.ORG_ID,
    })
      .orFail()
      .lean();

    const aggRes = await ProjectFile.aggregate([
      {
        $match: {
          access: "public",
          storageType: "file",
          $or: [
            {
              authors: {
                $in: [author._id],
              },
            },
            {
              primaryAuthor: author._id,
            },
            {
              correspondingAuthor: author._id,
            },
          ],
        },
      },
      {
        $lookup: {
          from: "projects",
          let: {
            searchID: "$projectID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$projectID", "$$searchID"],
                },
                visibility: "public",
                orgID: process.env.ORG_ID,
              },
            },
            {
              $project: {
                title: 1,
                thumbnail: 1,
                description: 1,
                projectURL: 1,
              },
            },
          ],
          as: "projectInfo",
        },
      },
      {
        $set: {
          projectInfo: {
            $arrayElemAt: ["$projectInfo", 0],
          },
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "tags",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assettagkeys",
                localField: "key",
                foreignField: "_id",
                as: "key",
              },
            },
            {
              $set: {
                key: {
                  $arrayElemAt: ["$key", 0],
                },
              },
            },
          ],
          as: "tags",
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "authors",
          foreignField: "_id",
          as: "authors",
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "primaryAuthor",
          foreignField: "_id",
          as: "primaryAuthor",
        },
      },
      {
        $set: {
          primaryAuthor: {
            $arrayElemAt: ["$primaryAuthor", 0],
          },
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "correspondingAuthor",
          foreignField: "_id",
          as: "correspondingAuthor",
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
          },
        },
      },
      {
        $match: {
          // Filter where project was not public or does not exist, so projectInfo wasn't set
          projectInfo: {
            $exists: true,
            $ne: [null, {}],
          },
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);

    const paginated = aggRes.slice(offset, offset + limit);
    const total = aggRes.length;

    res.send({
      err: false,
      assets: paginated,
      total,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function createAuthor(
  req: z.infer<typeof CreateAuthorValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();
    const author = await authorService.createAuthor(req.body);

    res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).send({
        err: true,
        errMsg: "An author with that nameKey already exists.",
      });
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateAuthor(
  req: z.infer<typeof UpdateAuthorValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();
    const author = await authorService.updateAuthor(req.params.id, req.body);

    return res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).send({
        err: true,
        errMsg: "An author with that nameKey already exists.",
      });
    }
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteAuthor(
  req: z.infer<typeof DeleteAuthorValidator>,
  res: Response
) {
  try {
    const authorService = new AuthorService();
    await authorService.deleteAuthor(req.params.id);

    return res.send({
      err: false,
      deleted: true,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function uploadAuthorPicture(
  req: z.infer<typeof UploadAuthorPictureValidator>,
  res: Response
) {
  try {

    console.log("USING BUCKET: ", process.env.AWS_AUTHOR_IMAGES_BUCKET);
    console.log("USING DOMAIN: ", process.env.AWS_AUTHOR_IMAGES_DOMAIN);

    if (typeof (req as any).file !== "object") {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }
    const file = (req as any).file as Express.Multer.File;

    const author = await Author.findOne({
      _id: req.params.id,
      orgID: process.env.ORG_ID,
    }).lean();
    if (!author) {
      return conductor404Err(res);
    }

    const extension = file.mimetype.split("/")[1];
    if (!extension) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const fileKey = `${author.nameKey}.${extension}`;

    // Cache-bust: bump ?v=N off the existing picture URL when it points at our bucket domain.
    let version = 1;
    if (
      author.pictureURL &&
      process.env.AWS_AUTHOR_IMAGES_DOMAIN &&
      author.pictureURL.includes(process.env.AWS_AUTHOR_IMAGES_DOMAIN)
    ) {
      const [, versionPart] = author.pictureURL.split("?v=");
      const currentVersion = Number.parseInt(versionPart);
      if (!Number.isNaN(currentVersion)) {
        version = currentVersion + 1;
      }
    }

    const storageClient = new S3Client({ region: process.env.AWS_REGION });
    const uploadResponse = await storageClient.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_AUTHOR_IMAGES_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    if (uploadResponse.$metadata?.httpStatusCode !== 200) {
      throw new Error("Error uploading author picture to S3.");
    }

    const pictureURL = `https://${process.env.AWS_AUTHOR_IMAGES_DOMAIN}/${fileKey}?v=${version}`;

    const authorService = new AuthorService();
    const updated = await authorService.updateAuthor(req.params.id, {
      pictureURL,
    });

    // Remove the previous object if this upload changed the key (e.g. format change PNG -> JPEG),
    // otherwise the old file is orphaned in the bucket. Best-effort: the new image is already saved,
    // so a cleanup failure must not fail the request.
    if (
      author.pictureURL &&
      process.env.AWS_AUTHOR_IMAGES_DOMAIN &&
      author.pictureURL.includes(process.env.AWS_AUTHOR_IMAGES_DOMAIN)
    ) {
      try {
        const previousKey = new URL(author.pictureURL).pathname.replace(
          /^\/+/,
          ""
        );
        if (previousKey && previousKey !== fileKey) {
          await storageClient.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_AUTHOR_IMAGES_BUCKET,
              Key: previousKey,
            })
          );
        }
      } catch (cleanupErr) {
        debugError(cleanupErr);
      }
    }

    return res.send({
      err: false,
      url: pictureURL,
      author: updated,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

export default {
  getAuthors,
  getAuthor,
  getAuthorByNameKey,
  getAuthorAssets,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  authorPictureUploadHandler,
  uploadAuthorPicture,
};
