import type { Request, Response } from "express";
import Project from "../models/project.js";
import PrejectRemixer from "../models/projectremixer.js";
import { authKeys } from "./services/authkey.js";
import remixerService from "./services/remixer-service.js";
import PrejectRemixerJob from "../models/projectremixerjob.js";
import base62 from "base62-random";
import CXOnePageAPIEndpoints from "../util/CXOne/CXOnePageAPIEndpoints.js";
import {
  extractPagePath,
  getUserWorkbenchProjects,
} from "../util/remixerutils.js";
import { generateAPIRequestHeaders } from "../util/librariesclient.js";

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

const buildConductorCookieHeader = (req: Request): string | undefined => {
  const accessCookie = req.cookies?.conductor_access_v2;
  const signedCookie = req.cookies?.conductor_signed_v2;
  const cookieParts = [
    accessCookie
      ? `conductor_access_v2=${encodeURIComponent(accessCookie)}`
      : "",
    signedCookie
      ? `conductor_signed_v2=${encodeURIComponent(signedCookie)}`
      : "",
  ].filter(Boolean);
  if (cookieParts.length === 0) return undefined;
  return cookieParts.join("; ");
};

const getRemixerProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  // Only select specific fields for remixer: libreCoverID, libreLibrary, projectID, and title
  const projection = {
    libreCoverID: 1,
    libreLibrary: 1,
    projectID: 1,
    title: 1,
    _id: 0,
  };
  const project = await Project.findOne({ projectID: id }, projection);
  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }
  res.send({
    err: false,
    project: project,
  });
};

const saveRemixerProjectState = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentBook, autoNumbering, copyModeState, pathLevelFormats } =
    req.body as {
      currentBook: unknown[];
      autoNumbering?: boolean;
      copyModeState?: string;
      pathLevelFormats?: unknown[];
    };
  const actorUUID = (req as any).user?.decoded?.uuid ?? "";

  const project = await Project.findOne(
    { projectID: id },
    { projectID: 1, _id: 0 },
  );

  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }
  // Check for an existing pending or running remixer job before allowing state save
  const existingJob = await PrejectRemixerJob.findOne({
    projectID: id,
    status: { $in: ["pending", "running"] },
  });
  if (existingJob) {
    return res.status(400).send({
      err: true,
      errMsg: "A remixer job is already pending or running for this project.",
    });
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
};
const publishRemixerProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentBook, autoNumbering, copyModeState, pathLevelFormats } =
    req.body as {
      currentBook: unknown[];
      autoNumbering?: boolean;
      copyModeState?: string;
      pathLevelFormats?: unknown[];
    };
  const actorUUID = (req as any).user?.decoded?.uuid ?? "";
  const existingJob = await PrejectRemixerJob.findOne({
    projectID: id,
    status: { $in: ["pending", "running"] },
  });
  if (existingJob) {
    return res.status(400).send({
      err: true,
      errMsg: "A remixer job is already pending or running for this project.",
    });
  }

  const project = await Project.findOne(
    { projectID: id },
    { projectID: 1, libreLibrary: 1, libreCoverID: 1, _id: 0 },
  );

  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }
  const subdomain = project.libreLibrary;
  if (!subdomain) {
    return res.status(400).send({
      err: true,
      errMsg: "Project libreLibrary is missing",
    });
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
  const bookAPIURL: string = `https://${subdomain}.libretexts.org/@api/deki/pages/${project.libreCoverID ?? "home"}/${CXOnePageAPIEndpoints.GET_Page_Info}`;
  const bookDetailsResponse = await fetch(bookAPIURL, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "x-deki-token": authKeys[subdomain as keyof typeof authKeys],
    },
  });
  const bookDetails = await bookDetailsResponse.json();

  let bookURL = bookDetails["uri.ui"];
  bookURL = bookURL.replace(/\/+$/, "");
  if (!bookURL) {
    return res.status(400).send({
      err: true,
      errMsg: "Book URL not found",
    });
  }

  const bookPath = extractPagePath(bookURL);

  remixerService
    .runRemixerJob({
      jobID: job.jobID,
      projectID: id,
      subdomain,
    })
    .catch((error: unknown) => {
      console.error("Failed to run remixer job", error);
    });

  return res.send({
    err: false,
    projectID: project.projectID,
    currentBook: remixerState?.remixerCurrentBook ?? [],
  });
};

const getRemixerJobStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = await PrejectRemixerJob.findOne(
    { projectID: id },
    { status: 1, messages: 1, errorMessage: 1, _id: 0 },
  ).sort({ _id: -1 });
  return res.send({
    err: false,
    job: job,
  });
};

const getRemixerProjectState = async (req: Request, res: Response) => {
  const { id } = req.params;
  const project = await Project.findOne(
    { projectID: id },
    {
      projectID: 1,
      _id: 0,
    },
  );

  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
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
      _id: 0,
    },
  )
    .sort({ updatedAt: -1 })
    .exec();

  return res.send({
    err: false,
    projectID: project.projectID,
    currentBook: remixerState?.archived
      ? []
      : (remixerState?.remixerCurrentBook ?? []),
    autoNumbering: remixerState?.autoNumbering,
    copyModeState: remixerState?.copyModeState,
    pathLevelFormats: remixerState?.pathLevelFormats ?? [],
  });
};

const deleteRemixerProjectState = async (req: Request, res: Response) => {
  const { id } = req.params;
  const project = await Project.findOne(
    { projectID: id },
    { projectID: 1, _id: 0 },
  );

  if (!project) {
    return res.status(404).send({
      err: true,
      errMsg: "Project not found",
    });
  }

  await PrejectRemixer.deleteOne({ projectID: id });

  return res.send({
    err: false,
    projectID: project.projectID,
    currentBook: [],
  });
};

// Zod validator ensures body/params shape; use it as the request body type.
const fetchPage = async (req: Request, res: Response) => {
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

    const url = `https://${subdomain}.libretexts.org/@api/deki/pages/${
      pathPrefix
    }${normalizedPath}${pageDetails ? pageDetailsApi : subpageApi}`;
    const conductorCookieHeader = buildConductorCookieHeader(req);

    const options = {
      headers: {
        ...((await generateAPIRequestHeaders(subdomain)) ?? {}),
        ...(conductorCookieHeader ? { Cookie: conductorCookieHeader } : {}),
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
      const detailsUrl = `https://${subdomain}.libretexts.org/@api/deki/pages/${
        pathPrefix
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

    const userId = (req as any).user?.decoded?.uuid as string | undefined;
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
