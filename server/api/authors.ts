import { z } from "zod";
import { debugError } from "../debug.js";
import Author from "../models/author.js";
import {
  CreateAuthorValidator,
  DeleteAuthorValidator,
  GetAllAuthorsValidator,
  GetAuthorValidator,
  UpdateAuthorValidator,
} from "./validators/authors.js";
import { Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { getPaginationOffset } from "../util/helpers.js";

async function getAuthors(
  req: z.infer<typeof GetAllAuthorsValidator>,
  res: Response
) {
  try {
    const limit = req.query.limit || 10;
    const offset = getPaginationOffset(req.query.page, limit);

    const authors = await Author.find({
      ...(req.query.search && {
        $or: [
          { firstName: { $regex: req.query.search, $options: "i" } },
          { lastName: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }),
    })
      .skip(offset)
      .limit(limit)
      .sort(req.query.sort || "lastName")
      .lean();

    const total = await Author.countDocuments();

    res.send({
      err: false,
      authors,
      totalCount: total,
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
    const author = await Author.findById(req.params.id).orFail().lean();
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

async function createAuthor(
  req: z.infer<typeof CreateAuthorValidator>,
  res: Response
) {
  try {
    const author = await Author.create(req.body);
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

async function updateAuthor(
  req: z.infer<typeof UpdateAuthorValidator>,
  res: Response
) {
  try {
    await Author.updateOne({ _id: req.params.id }, req.body).orFail();

    const updated = await Author.findById(req.params.id).orFail().lean();

    return res.send({
      err: false,
      author: updated,
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

async function deleteAuthor(
  req: z.infer<typeof DeleteAuthorValidator>,
  res: Response
) {
  try {
    await Author.deleteOne({ _id: req.params.id }).orFail();

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
  createAuthor,
  updateAuthor,
  deleteAuthor,
};
