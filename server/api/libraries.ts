import logger from "../logger.js";
import Library from "../models/library.js";
import { Request, Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { z } from "zod";
import {
  FindShelfAcrossLibrariesSchema,
  GetLibraryFromSubdomainSchema,
  GetLibraryShelvesSchema,
} from "./validators/libraries.js";
import LibraryService from "./services/library-service.js";

export async function getLibraries(req: Request, res: Response) {
  try {
    const libraries = await Library.find({ hidden: false });
    return res.send({
      err: false,
      libraries,
    });
  } catch (err) {
    logger.error({ err }, "getLibraries failed");
    return conductor500Err(res);
  }
}

export async function getLibraryFromSubdomain(
  req: z.infer<typeof GetLibraryFromSubdomainSchema>,
  res: Response,
) {
  try {
    const includeHidden =
      req.query.includeHidden?.toString() === "true" || req.query.includeHidden === true;
    const library = await Library.findOne({
      subdomain: req.params.subdomain,
      ...(includeHidden ? {} : { hidden: false }),
    });
    if (!library) {
      return res.status(404).send({
        err: true,
        message: "Library not found",
      });
    }

    return res.send({
      err: false,
      library,
    });
  } catch (err) {
    logger.error({ err }, "getLibraryFromSubdomain failed");
    return conductor500Err(res);
  }
}

/**
 * Lists the shelves one level beneath `path` on a library, for the Collections
 * Manager's shelf picker. Omitting `path` returns the library's sync roots.
 *
 * A listing failure is reported as a 502 rather than an empty array: an admin
 * reading an empty tree would conclude the shelf does not exist.
 */
export async function getLibraryShelves(
  req: z.infer<typeof GetLibraryShelvesSchema>,
  res: Response,
) {
  const { subdomain } = req.params;
  const path = req.query.path?.toString() || undefined;

  const library = await Library.findOne({ subdomain: { $eq: subdomain } }).lean();
  if (!library) {
    return res.status(404).send({
      err: true,
      errMsg: "Library not found",
    });
  }

  try {
    const shelves = await new LibraryService().listShelves(subdomain, path);
    return res.send({
      err: false,
      shelves,
    });
  } catch (err) {
    logger.error({ err, subdomain, path }, "getLibraryShelves failed");
    return res.status(502).send({
      err: true,
      errMsg: "Could not reach the library to list its shelves. Please try again.",
    });
  }
}

/**
 * Reports which libraries carry a shelf path, so the Collections Manager can add
 * the same shelf across all of them in one action.
 *
 * Libraries that don't have the path are omitted rather than reported as
 * failures — most libraries not having a given campus or subject shelf is the
 * expected shape of this answer.
 */
export async function findShelfAcrossLibraries(
  req: z.infer<typeof FindShelfAcrossLibrariesSchema>,
  res: Response,
) {
  const path = req.query.path.toString();

  try {
    const { matches, checked } = await new LibraryService().findShelfAcrossLibraries(
      path,
    );
    return res.send({
      err: false,
      path,
      matches,
      checked,
    });
  } catch (err) {
    logger.error({ err, path }, "findShelfAcrossLibraries failed");
    return conductor500Err(res);
  }
}

export async function getLibraryNameKeys(
  includeHidden = false,
  includeSyncUnsupported = true,
): Promise<string[] | undefined> {
  try {
    const libraries = await Library.find({
      ...(includeHidden ? {} : { hidden: false }),
      ...(includeSyncUnsupported ? {} : { syncSupported: true }),
    });

    return libraries?.map((l) => l.subdomain);
  } catch (err) {
    logger.error({ err }, "getLibraryNameKeys failed");
    return undefined;
  }
}

export default {
  getLibraries,
  getLibraryFromSubdomain,
  getLibraryShelves,
  findShelfAcrossLibraries,
  getLibraryNameKeys,
};
