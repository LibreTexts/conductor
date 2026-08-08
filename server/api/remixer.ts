import type { Response } from "express";
import { z } from "zod";
import { ZodReqWithUser } from "../types/Express.js";
import {
  GetRemixerPageSchema,
  GetRemixerProjectStateSchema,
  SaveRemixerProjectStateSchema,
} from "./validators/remixer.js";
import PrejectRemixer from "../models/projectremixer.js";
import remixerService from "./services/remixer-service.js";
import PrejectRemixerJob from "../models/projectremixerjob.js";
import base62 from "base62-random";
import CXOnePageAPIEndpoints from "../util/CXOne/CXOnePageAPIEndpoints.js";
import {
  findUnownedRemixerPageIDs,
  getUserWorkbenchProjects,
} from "../util/remixerutils";
import { generateAPIRequestHeaders } from "../util/librariesclient.js";
import User from "../models/user.js";
import BookService from "./services/book-service.js";
import type { RemixerSubPageState } from "../models/projectremixer.js";
import { ProjectContext, ProjectError, returnProjectError } from "./services/project-context.js";
import { debug } from "../debug.js";
import { conductor500Err } from "../util/errorutils.js";

class FetchPageError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "FetchPageError";
    this.statusCode = statusCode;
  }
}

const getFetchPageErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Failed to fetch remixer page.";
};

const normalizeUpstreamErrorMessage = (message: string): string => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return "";

  // LibreTexts can sometimes return full HTML for errors.
  if (
    trimmedMessage.startsWith("<!DOCTYPE") ||
    trimmedMessage.startsWith("<html")
  ) {
    return "";
  }

  return trimmedMessage.slice(0, 300);
};

/**
 * Verifies that a proposed remixer book only touches pages belonging to the
 * project's own book (`${libreLibrary}-${libreCoverID}`). Returns a
 * user-facing error message when the payload references content outside the
 * book, or `null` when it is clean. Resolving the owned page set requires a
 * live TOC lookup, so callers should treat a thrown/failed lookup as a reason
 * to refuse (fail closed) rather than proceed.
 */
const validateRemixerBookOwnership = async (
  libreLibrary: string | undefined,
  libreCoverID: string | undefined,
  currentBook: unknown,
): Promise<string | null> => {
  if (!libreLibrary || !libreCoverID) {
    return "Project is not attached to a library book; cannot verify remixer permissions.";
  }
  if (!Array.isArray(currentBook)) {
    return "Malformed remixer book payload; cannot verify remixer permissions.";
  }
  if (currentBook.length === 0) return null;

  // The Zod schema accepts `record<string, any>` entries, so the shape the
  // ownership check relies on is not yet guaranteed. Validate it here (rather
  // than trusting the cast) so a malformed node fails closed with a clear
  // authorization error instead of throwing a 500 deep inside the check.
  const isValidNode = (node: unknown): node is RemixerSubPageState => {
    if (typeof node !== "object" || node === null) return false;
    const record = node as Record<string, unknown>;
    if (typeof record["@id"] !== "string" || record["@id"].length === 0) {
      return false;
    }
    if (record.parentID !== undefined && typeof record.parentID !== "string") {
      return false;
    }
    return true;
  };
  if (!currentBook.every(isValidNode)) {
    return "Remixer book contains malformed pages; cannot verify remixer permissions.";
  }
  const pages = currentBook as RemixerSubPageState[];

  let ownedPageIDs: string[];
  try {
    const bookService = new BookService({
      bookID: `${libreLibrary}-${libreCoverID}`,
    });
    ownedPageIDs = await bookService.getBookPageIDs();
  } catch (error) {
    console.error("[remixer] failed to resolve owned book pages:", error);
    return "Unable to verify remixer permissions against the project's book.";
  }
  if (ownedPageIDs.length === 0) {
    return "Unable to verify remixer permissions against the project's book.";
  }

  const { mutated, grafted } = findUnownedRemixerPageIDs(
    pages,
    new Set(ownedPageIDs),
  );
  if (mutated.length === 0 && grafted.length === 0) return null;

  const count = mutated.length + grafted.length;
  return `This remix references ${count} page(s) that do not belong to this project's book and cannot be saved or published.`;
};

const getRemixerProject = async (
  req: ZodReqWithUser<z.infer<typeof GetRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;

    const ctx = await ProjectContext.load(id, { select: ["libreCoverID", "libreLibrary", "projectID", "title"] });
    if (!ctx.canMember(req.user)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    // Extract the fields we want to return
    const { libreCoverID, libreLibrary, projectID, title } = ctx.doc;

    res.send({
      err: false,
      project: {
        libreCoverID,
        libreLibrary,
        projectID,
        title,
      },
    });
  } catch (error) {
    if (error instanceof ProjectError) {
      return returnProjectError(res, error);
    }

    debug("[remixer] getRemixerProject unexpected error:", error);
    return conductor500Err(res);
  }
};

const saveRemixerProjectState = async (
  req: ZodReqWithUser<z.infer<typeof SaveRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { currentBook, autoNumbering, copyModeState, pathLevelFormats } =
      req.body;
    const actorUUID = req.user.decoded.uuid;

    const ctx = await ProjectContext.load(id);
    const project = ctx.doc;

    if (!ctx.canMember(req.user)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    // Never persist a book that references pages outside this project's book.
    const ownershipError = await validateRemixerBookOwnership(
      project.libreLibrary,
      project.libreCoverID,
      currentBook,
    );
    if (ownershipError) {
      return res.status(403).send({ err: true, errMsg: ownershipError });
    }

    // Check for an existing pending or running remixer job before allowing state save
    const existingJob = await PrejectRemixerJob.findOne({
      projectID: { $eq: id },
      status: { $in: ["pending", "running"] },
    });
    if (existingJob) {
      return res.status(400).send({
        err: true,
        errMsg: "A remixer job is already pending or running for this project.",
      });
    }

    const remixerState = await PrejectRemixer.findOneAndUpdate(
      { projectID: { $eq: id }, archived: false },
      {
        $set: {
          remixerCurrentBook: currentBook,
          ...(autoNumbering !== undefined && { autoNumbering }),
          ...(copyModeState !== undefined && { copyModeState }),
          ...(pathLevelFormats !== undefined && { pathLevelFormats }),
          updatedBy: actorUUID,
        },
        $setOnInsert: {
          remixerID: base62(10),
          createdBy: actorUUID,
          archived: false,
          projectID: project.projectID,
        },
      },
      {
        new: true,
        upsert: true,
        projection: {
          projectID: 1,
          remixerCurrentBook: 1,
          remixerID: 1,
          autoNumbering: 1,
          copyModeState: 1,
          pathLevelFormats: 1,
          _id: 0,
        },
      },
    );

    return res.send({
      err: false,
      projectID: project.projectID,
      currentBook: remixerState?.remixerCurrentBook ?? [],
      autoNumbering: remixerState?.autoNumbering,
      copyModeState: remixerState?.copyModeState,
      pathLevelFormats: remixerState?.pathLevelFormats ?? [],
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      return returnProjectError(res, err);
    }

    debug("[remixer] saveRemixerProjectState unexpected error:", err);
    return conductor500Err(res);
  }
};

const publishRemixerProject = async (
  req: ZodReqWithUser<z.infer<typeof SaveRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { currentBook, autoNumbering, copyModeState, pathLevelFormats } =
      req.body;
    const actorUUID = req.user?.decoded?.uuid ?? "";

    const ctx = await ProjectContext.load(id);
    const project = ctx.doc;

    if (!ctx.canMember(req.user)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    const existingJob = await PrejectRemixerJob.findOne({
      projectID: { $eq: id },
      status: { $in: ["pending", "running"] },
    });
    if (existingJob) {
      return res.status(400).send({
        err: true,
        errMsg: "A remixer job is already pending or running for this project.",
      });
    }

    const subdomain = project.libreLibrary;
    if (!subdomain) {
      return res.status(400).send({
        err: true,
        errMsg: "Project libreLibrary is missing",
      });
    }

    // Refuse before creating any state/job if the payload touches pages outside
    // this project's book. runRemixerJob re-checks this authoritatively; doing it
    // here gives immediate feedback and avoids spawning a doomed job.
    const ownershipError = await validateRemixerBookOwnership(
      subdomain,
      project.libreCoverID,
      currentBook,
    );
    if (ownershipError) {
      return res.status(403).send({ err: true, errMsg: ownershipError });
    }

    const remixerState = await PrejectRemixer.findOneAndUpdate(
      { projectID: id, archived: false },
      {
        $set: {
          remixerCurrentBook: currentBook,
          ...(autoNumbering !== undefined && { autoNumbering }),
          ...(copyModeState !== undefined && { copyModeState }),
          ...(pathLevelFormats !== undefined && { pathLevelFormats }),
          updatedBy: actorUUID,
          archived: true,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdBy: actorUUID,
          remixerID: base62(10),
          createdAt: new Date(),
          projectID: project.projectID,
        },
      },
      {
        new: true,
        upsert: true,
        projection: { projectID: 1, remixerCurrentBook: 1, remixerID: 1, _id: 0 },
      },
    );
    const job = await PrejectRemixerJob.create({
      jobID: base62(10),
      projectID: id,
      userID: actorUUID,
      remixerID: remixerState?.remixerID ?? "",
      status: "pending",
      messages: ["Remixer job created."],
    });

    remixerService
      .runRemixerJob({
        jobID: job.jobID,
        projectID: id,
        subdomain,
        coverId: project.libreCoverID ?? "",
      })
      .catch((error: unknown) => {
        console.error("Failed to run remixer job", error);
      });

    return res.send({
      err: false,
      projectID: project.projectID,
      currentBook: remixerState?.remixerCurrentBook ?? [],
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      return returnProjectError(res, err);
    }

    debug("[remixer] publishRemixerProject unexpected error:", err);
    return conductor500Err(res);
  }
};

const getRemixerJobStatus = async (
  req: ZodReqWithUser<z.infer<typeof GetRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const job = await PrejectRemixerJob.findOne(
      { projectID: id },
      { status: 1, messages: 1, errorMessage: 1, _id: 0 },
    ).sort({ _id: -1 });
    return res.send({
      err: false,
      job: job,
    });
  } catch (err) {
    debug("[remixer] getRemixerJobStatus unexpected error:", err);
    return conductor500Err(res);
  }
};

const getRemixerProjectState = async (
  req: ZodReqWithUser<z.infer<typeof GetRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;

    const ctx = await ProjectContext.load(id);
    if (!ctx.canMember(req.user)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    const remixerState = await PrejectRemixer.findOne(
      { projectID: id },
      {
        projectID: 1,
        archived: 1,
        remixerCurrentBook: 1,
        autoNumbering: 1,
        copyModeState: 1,
        pathLevelFormats: 1,
        updatedAt: 1,
        updatedBy: 1,
        _id: 0,
      },
    )
      .sort({ updatedAt: -1 })
      .exec();
    // find user by updatedBy
    const updatedByUser = await User.findOne(
      { uuid: { $eq: remixerState?.updatedBy } },
      { name: 1, email: 1, _id: 0 },
    );

    return res.send({
      err: false,
      projectID: id,
      currentBook: remixerState?.archived
        ? []
        : (remixerState?.remixerCurrentBook ?? []),
      autoNumbering: remixerState?.autoNumbering,
      copyModeState: remixerState?.copyModeState,
      pathLevelFormats: remixerState?.pathLevelFormats ?? [],
      updatedAt: remixerState?.updatedAt,
      updatedBy: updatedByUser
        ? `${updatedByUser.firstName ? updatedByUser.firstName : ""} ${updatedByUser?.lastName ? updatedByUser.lastName : ""} ${updatedByUser?.email ? updatedByUser.email : ""}`
        : "",
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      return returnProjectError(res, err);
    }

    debug("[remixer] getRemixerProjectState unexpected error:", err);
    return conductor500Err(res);
  }
};

const deleteRemixerProjectState = async (
  req: ZodReqWithUser<z.infer<typeof GetRemixerProjectStateSchema>>,
  res: Response,
) => {
  try {
    const { id } = req.params;

    const ctx = await ProjectContext.load(id);
    if (!ctx.canMember(req.user)) {
      return returnProjectError(res, new ProjectError("unauthorized"));
    }

    await PrejectRemixer.deleteOne({ projectID: { $eq: id } });

    return res.send({
      err: false,
      projectID: id,
      currentBook: [],
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      return returnProjectError(res, err);
    }

    debug("[remixer] deleteRemixerProjectState unexpected error:", err);
    return conductor500Err(res);
  }
};

const fetchPage = async (
  req: ZodReqWithUser<z.infer<typeof GetRemixerPageSchema>>,
  res: Response,
) => {
  try {
    const pageDetailsApi = CXOnePageAPIEndpoints.DREAM_OUT_FORMAT_LIMIT(1000);
    const subpageApi = CXOnePageAPIEndpoints.GET_Subpages;
    const { subdomain, path, option, pageDetails, currentbook } = req.body;
    const {
      includeMatter = false,
      linkTitle = false,
      full = false,
    } = option ?? {};

    const numericPath = Number(path);
    const isNumber = !isNaN(numericPath);
    let normalizedPath = path;
    if (isNumber && numericPath <= 0) {
      normalizedPath = "home";
    }

    if (!normalizedPath.endsWith("/")) {
      normalizedPath += "/";
    }

    const isHomePath = String(normalizedPath).toLowerCase() === "home";
    const pathPrefix = isNumber || isHomePath ? "" : "=";

    const url = `https://${subdomain}.libretexts.org/@api/deki/pages/${pathPrefix
      }${normalizedPath}${pageDetails ? pageDetailsApi : subpageApi}`;

    const options = {
      headers: {
        ...((await generateAPIRequestHeaders(subdomain)) ?? {}),
      },
    };
    const response = await fetch(url, options);
    if (response.status !== 200) {
      const errorBody = await response.text();
      let upstreamMessage = "";

      try {
        const parsedBody = JSON.parse(errorBody) as {
          message?: string;
          error?: string;
        };
        upstreamMessage = parsedBody.message ?? parsedBody.error ?? "";
      } catch {
        upstreamMessage = errorBody;
      }

      const statusMessage = response.statusText || "Request failed";
      const cleanUpstreamMessage =
        normalizeUpstreamErrorMessage(upstreamMessage);
      const messageSuffix = cleanUpstreamMessage
        ? `: ${cleanUpstreamMessage}`
        : "";
      throw new FetchPageError(
        `Failed to fetch remixer page (${response.status} ${statusMessage})${messageSuffix}`,
        response.status,
      );
    }
    const text = await response.text();
    if (pageDetails) {
      const responseData = JSON.parse(text);

      const remixerPageDetails = remixerService.mapToRemixerPageDetailsResponse(
        responseData,
        currentbook,
      );
      return res.send({
        err: false,
        response: remixerPageDetails,
      });
    }
    let parentID: string | undefined = isNumber ? path : undefined;

    if (!parentID) {
      const detailsUrl = `https://${subdomain}.libretexts.org/@api/deki/pages/${pathPrefix
        }${normalizedPath}${pageDetailsApi}`;
      const detailsRes = await fetch(detailsUrl, options);
      if (detailsRes.ok) {
        const detailsData = (await detailsRes.json()) as Record<
          string,
          unknown
        >;
        parentID = String(detailsData["@id"] ?? "");
      }
    }

    let responseData = remixerService.mapToRemixerSubPageResponse(
      JSON.parse(text),
      parentID,
    );
    // console.log(responseData.length);

    const userId = req.user?.decoded?.uuid;
    const isWorkbenchRoot =
      String(path).toLowerCase() === "home" || (isNumber && numericPath <= 0);

    if (path.toLowerCase().includes("workbench") && userId) {
      const allowedCoverIDs = await getUserWorkbenchProjects(subdomain, userId);
      if (allowedCoverIDs.length > 0) {
        const allowedSet = new Set(allowedCoverIDs);
        responseData = responseData.filter((page) =>
          allowedSet.has(page["@id"]),
        );
      }
    }

    return res.send({
      err: false,
      response: responseData,
    });
  } catch (error) {
    const statusCode = error instanceof FetchPageError ? error.statusCode : 500;
    return res.status(statusCode).send({
      err: true,
      errMsg: getFetchPageErrorMessage(error),
    });
  }
};

export default {
  getRemixerProject,
  saveRemixerProjectState,
  publishRemixerProject,
  getRemixerJobStatus,
  getRemixerProjectState,
  deleteRemixerProjectState,
  fetchPage,
};
