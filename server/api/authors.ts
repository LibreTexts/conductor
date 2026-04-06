import { z } from "zod";
import { debugError } from "../debug.js";
import Author from "../models/author.js";
import {
  CreateAuthorValidator,
  DeleteAuthorValidator,
  GetAuthorsValidator,
  GetAuthorAssetsValidator,
  GetAuthorValidator,
  UpdateAuthorValidator,
  GetCXOnePageContentTemplateValidator,
  GetAuthorByNameKeyValidator,
} from "./validators/authors.js";
import { Response } from "express";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";
import ProjectFile from "../models/projectfile.js";
import AuthorService from "./services/author-service.js";
import { readFile } from "fs/promises";
import { join } from "path";

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

    const author = await authorService.getAuthorByNameKey(req.params.key);
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

async function getCXOnePageContentTemplate(
  req: z.infer<typeof GetCXOnePageContentTemplateValidator>,
  res: Response
) {
  try {
    const { type } = req.params;

    const authorService = new AuthorService();
    const authors = await authorService.getAllAuthors();

    const formattedAuthorsString = authorService.formatAuthorsForTemplate(authors);
    if (!formattedAuthorsString) {
      throw new Error("Failed to format authors for template.");
    }

    let templateFilePath: string;
    if (type === "header") {
      templateFilePath = "util/cxone-page-content-header.html";
    } else if (type === "footer") {
      templateFilePath = "util/cxone-page-content-footer.html";
    } else {
      return res.status(400).send({
        err: true,
        errMsg: "Invalid template type requested. Must be 'header' or 'footer'.",
      });
    }

    const templateContent = await readFile(join(process.cwd(), templateFilePath), "utf-8");
    const finalContent = templateContent.replace("REPLACE_WITH_AUTHORS_JSON", formattedAuthorsString);

    res.send({
      err: false,
      template: finalContent,
    });
  } catch (err: any) {
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
  getCXOnePageContentTemplate,
};
