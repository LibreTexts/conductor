import { z } from "zod";
import { debugError } from "../debug.js";
import Author from "../models/author.js";
import {
  BulkCreateAuthorsValidator,
  CreateAuthorValidator,
  DeleteAuthorValidator,
  GetAllAuthorsValidator,
  GetAuthorAssetsValidator,
  GetAuthorValidator,
  UpdateAuthorValidator,
} from "./validators/authors.js";
import { Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";
import ProjectFile from "../models/projectfile.js";

async function getAuthors(
  req: z.infer<typeof GetAllAuthorsValidator>,
  res: Response
) {
  try {
    const limit = req.query.limit || 10;
    const offset = getPaginationOffset(req.query.page, limit);

    const queryObj: Record<any, any> = {
      $and: [{ isAdminEntry: true }, { orgID: process.env.ORG_ID }],
    };

    if (req.query.query) {
      queryObj.$and.push({
        $or: [
          { firstName: { $regex: req.query.query, $options: "i" } },
          { lastName: { $regex: req.query.query, $options: "i" } },
          { email: { $regex: req.query.query, $options: "i" } },
        ],
      });
    }

    const authorsPromise = Author.find(queryObj)
      .skip(offset)
      .limit(limit)
      .sort(req.query.sort || "lastName")
      .lean();

    const totalPromise = Author.countDocuments(queryObj);

    const [authors, total] = await Promise.allSettled([
      authorsPromise,
      totalPromise,
    ]);

    if (authors.status === "rejected" || total.status === "rejected") {
      return conductor500Err(res);
    }

    res.send({
      err: false,
      authors: authors.value,
      totalCount: total.value,
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
    const author = await Author.findOne({
      _id: req.params.id,
      isAdminEntry: true,
      orgID: process.env.ORG_ID,
    })
      .orFail()
      .lean();

    res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
    }
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
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
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
    const {
      firstName,
      lastName,
      email,
      primaryInstitution,
      url,
      isAdminEntry,
    } = req.body;
    const author = await Author.create({
      firstName,
      lastName,
      primaryInstitution,
      ...(email && { email }),
      ...(url && { url }),
      isAdminEntry: true, // only Campus Admins use this endpoint so set to true
      orgID: process.env.ORG_ID,
    });

    res.send({
      err: false,
      author,
    });
  } catch (err: any) {
    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).send({
        err: true,
        message: "Author with that email already exists",
      });
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function bulkCreateAuthors(
  req: z.infer<typeof BulkCreateAuthorsValidator>,
  res: Response
) {
  try {
    const existingAuthorEmails = (await Author.find().lean()).map(
      (author) => author.email
    );

    // Ignore duplicates (email)
    const noDuplicates = req.body.authors.filter(
      (author) => !existingAuthorEmails.includes(author.email)
    );

    const withAdminFlag = noDuplicates.map((author) => ({
      ...author,
      isAdminEntry: true,
      orgID: process.env.ORG_ID,
    }));

    const insertRes = await Author.insertMany(withAdminFlag);

    return res.send({
      err: false,
      authors: insertRes,
    });
  } catch (err: any) {
    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).send({
        err: true,
        message: "Author with that email already exists",
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
    const { firstName, lastName, email, primaryInstitution, url } = req.body;
    await Author.updateOne(
      { _id: req.params.id },
      {
        firstName,
        lastName,
        primaryInstitution,
        ...(email && { email }),
        ...(url && { url }),
        orgID: process.env.ORG_ID,
      }
    ).orFail();

    const updated = await Author.findById(req.params.id).orFail().lean();

    return res.send({
      err: false,
      author: updated,
    });
  } catch (err: any) {
    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(409).send({
        err: true,
        message: "Author with that email already exists",
      });
    }
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
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
    await Author.deleteOne({
      _id: req.params.id,
      orgID: process.env.ORG_ID,
    }).orFail();

    return res.send({
      err: false,
      deleted: true,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).send({
        err: true,
        message: "Author not found",
      });
    }
    debugError(err);
    return conductor500Err(res);
  }
}

export default {
  getAuthors,
  getAuthor,
  getAuthorAssets,
  createAuthor,
  bulkCreateAuthors,
  updateAuthor,
  deleteAuthor,
};
