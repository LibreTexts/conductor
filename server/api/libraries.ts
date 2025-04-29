import Library from "../models/library.js";
import { Request, Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { debugError } from "../debug.js";
import { z } from "zod";
import { GetLibraryFromSubdomainSchema } from "./validators/libraries.js";

export async function getLibraries(req: Request, res: Response) {
  try {
    const libraries = await Library.find({ hidden: false });
    return res.send({
      err: false,
      libraries,
    });
  } catch (err) {
    debugError(err);
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
    debugError(err);
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
    debugError(err);
    return undefined;
  }
}

export default {
  getLibraries,
  getLibraryFromSubdomain,
  getLibraryNameKeys,
};
