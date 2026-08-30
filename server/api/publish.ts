import { Response } from "express";
import { z } from "zod";
import logger from "../logger.js";
import { ZodReqWithUser } from "../types";
import { ProjectInterfaceRaw } from "../models/project.js";
import {
  ProjectContext,
  ProjectError,
  returnProjectError,
} from "./services/project-context.js";
import PublishService, {
  PublishStepError,
} from "./services/publish-service.js";
import {
  ListDestinationsValidator,
  MoveBookValidator,
  PublishStatusValidator,
  PublishStepValidator,
} from "./validators/publish.js";

/**
 * Loads the project for a publishing action.
 *
 * Every route here is already gated on the LibreTexts superadmin role, so
 * membership is not re-checked; what this adds is the refusal a project without
 * a linked library book needs, since every step targets that book.
 *
 * Returns `null` after responding, so callers can `if (!p) return;`.
 */
async function loadPublishableProject(
  projectID: string,
  res: Response
): Promise<ProjectInterfaceRaw | null> {
  let project: ProjectInterfaceRaw;
  try {
    const ctx = await ProjectContext.load(projectID);
    project = ctx.doc;
  } catch (err) {
    if (err instanceof ProjectError) {
      returnProjectError(res, err);
      return null;
    }
    throw err;
  }

  if (!project.libreLibrary || !project.libreCoverID) {
    res.status(400).send({
      err: true,
      errMsg:
        "This project is not linked to a library book, so it cannot be published.",
    });
    return null;
  }

  return project;
}

/**
 * Translates a step failure into a response.
 *
 * A {@link PublishStepError} is something the user can act on — a taken path, a
 * book Commons has not synced — and is reported verbatim. Anything else is an
 * internal failure: it goes to the log with its stack, and the browser gets a
 * fixed message. MindTouch, Mongo, and axios all put hostnames, URLs, and
 * occasionally credentials in `err.message`, so that text does not leave the
 * server.
 */
function respondToStepError(res: Response, err: unknown, context: string) {
  if (err instanceof PublishStepError) {
    return res.status(err.status).send({ err: true, errMsg: err.message });
  }
  logger.error({ err }, `${context} failed`);
  return res.status(500).send({
    err: true,
    errMsg: "An unexpected error occurred. Please try again.",
  });
}

export async function getPublishStatus(
  req: ZodReqWithUser<z.infer<typeof PublishStatusValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  const status = await new PublishService().getStatus(project);
  return res.status(200).json({
    err: false,
    msg: "Retrieved publishing status.",
    status,
  });
}

export async function listPublishDestinations(
  req: ZodReqWithUser<z.infer<typeof ListDestinationsValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    const destinations = await new PublishService().listDestinations(
      project.libreLibrary as string,
      req.query.path
    );
    return res.status(200).json({
      err: false,
      msg: "Retrieved destinations.",
      destinations,
    });
  } catch (err) {
    return respondToStepError(res, err, "listPublishDestinations");
  }
}

export async function submitPublishPreprocess(
  req: ZodReqWithUser<z.infer<typeof PublishStepValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    const jobID = await new PublishService().submitPreprocess(
      project,
      req.user.decoded.uuid
    );
    return res
      .status(202)
      .json({ err: false, msg: "Preprocess job submitted.", jobID });
  } catch (err) {
    return respondToStepError(res, err, "submitPublishPreprocess");
  }
}

export async function setPublishBookSecurity(
  req: ZodReqWithUser<z.infer<typeof PublishStepValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    await new PublishService().setBookPublic(project, req.user.decoded.uuid);
    return res
      .status(200)
      .json({ err: false, msg: "Book set to public on the library." });
  } catch (err) {
    return respondToStepError(res, err, "setPublishBookSecurity");
  }
}

export async function movePublishedBook(
  req: ZodReqWithUser<z.infer<typeof MoveBookValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    const path = await new PublishService().moveBook(
      project,
      req.body.to,
      req.user.decoded.uuid
    );
    return res.status(200).json({ err: false, msg: "Book moved.", path });
  } catch (err) {
    return respondToStepError(res, err, "movePublishedBook");
  }
}

export async function setPublishVisibility(
  req: ZodReqWithUser<z.infer<typeof PublishStepValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    await new PublishService().setVisibilityPublic(
      project,
      req.user.decoded.uuid
    );
    return res.status(200).json({ err: false, msg: "Project set to public." });
  } catch (err) {
    return respondToStepError(res, err, "setPublishVisibility");
  }
}

export async function submitPublishCompile(
  req: ZodReqWithUser<z.infer<typeof PublishStepValidator>>,
  res: Response
) {
  const project = await loadPublishableProject(req.params.projectID, res);
  if (!project) return;

  try {
    const jobID = await new PublishService().submitCompile(
      project,
      req.user.decoded.uuid
    );
    return res
      .status(200)
      .json({ err: false, msg: "Compile job submitted.", jobID });
  } catch (err) {
    return respondToStepError(res, err, "submitPublishCompile");
  }
}
