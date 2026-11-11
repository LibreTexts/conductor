import type { Response } from "express";
import { childLogger } from "../logger.js";
import Project from "../models/project.js";
import type { ZodReqWithUser } from "../types/Express.js";
import {
  ProjectContext,
  ProjectError,
  returnProjectError,
} from "./services/project-context.js";
import {
  getContentPageLineage,
  getContentSourcesOverview,
  getSourceChangeRevisions,
  listContentPages,
  markSourceChangeReviewed,
} from "./services/content-sources-service.js";
import type {
  GetContentPageLineageRequest,
  GetContentPagesRequest,
  GetContentSourcesRequest,
  ReviewSourceChangeRequest,
  UpdateContentSourcesNotificationsRequest,
} from "./validators/content-sources.js";

/**
 * Project Content Sources: where a project's book takes its content from,
 * who reuses it, and what changed. Every read requires project membership
 * (hidden pages are included); changing the email setting requires a lead
 * or other project admin.
 */

const log = childLogger("content-sources");

const NO_BOOK_MSG = "This project isn't linked to a book.";

/** Loads the project, checks the user may read it, and returns its book. */
const loadForMember = async (projectID: string, user: unknown) => {
  const ctx = await ProjectContext.load(projectID, { select: ["notifySourceChanges"] });
  if (!ctx.canMember(user)) throw new ProjectError("unauthorized");
  return { ctx, bookID: ctx.getLinkedBook() };
};

const sendError = (res: Response, err: unknown, context: string) => {
  if (err instanceof ProjectError) return returnProjectError(res, err);
  log.error({ err }, `${context} failed`);
  return res.status(500).send({ err: true, errMsg: "Internal server error" });
};

async function getContentSources(
  req: ZodReqWithUser<GetContentSourcesRequest>,
  res: Response,
) {
  try {
    const { ctx, bookID } = await loadForMember(req.params.projectID, req.user);
    if (!bookID) return res.status(400).send({ err: true, errMsg: NO_BOOK_MSG });

    const overview = await getContentSourcesOverview(bookID);
    return res.send({
      err: false,
      data: {
        ...overview,
        notifySourceChanges: ctx.doc.notifySourceChanges !== false,
        canManage: ctx.canAdmin(req.user),
      },
    });
  } catch (err) {
    return sendError(res, err, "getContentSources");
  }
}

async function getContentPages(
  req: ZodReqWithUser<GetContentPagesRequest>,
  res: Response,
) {
  try {
    const { bookID } = await loadForMember(req.params.projectID, req.user);
    if (!bookID) return res.status(400).send({ err: true, errMsg: NO_BOOK_MSG });

    const { kind, attention } = req.query;
    const data = await listContentPages(bookID, { kind, attention });
    return res.send({ err: false, data });
  } catch (err) {
    return sendError(res, err, "getContentPages");
  }
}

async function getContentPageLineageHandler(
  req: ZodReqWithUser<GetContentPageLineageRequest>,
  res: Response,
) {
  try {
    const { bookID } = await loadForMember(req.params.projectID, req.user);
    if (!bookID) return res.status(400).send({ err: true, errMsg: NO_BOOK_MSG });

    const data = await getContentPageLineage(
      bookID,
      req.params.pageID,
      req.query.direction,
    );
    if (!data) {
      return res.status(404).send({ err: true, errMsg: "Page not found in this book." });
    }
    return res.send({ err: false, data });
  } catch (err) {
    return sendError(res, err, "getContentPageLineage");
  }
}

/** The library revisions a source change spans, with the diff. Any member. */
async function getChangeRevisions(
  req: ZodReqWithUser<ReviewSourceChangeRequest>,
  res: Response,
) {
  try {
    const { bookID } = await loadForMember(req.params.projectID, req.user);
    if (!bookID) return res.status(400).send({ err: true, errMsg: NO_BOOK_MSG });

    const data = await getSourceChangeRevisions(bookID, req.params.eventID);
    if (!data) {
      return res.status(404).send({ err: true, errMsg: "Change not found for this book." });
    }
    return res.send({ err: false, data });
  } catch (err) {
    return sendError(res, err, "getChangeRevisions");
  }
}

/** Marks a source change reviewed for the project's book. Leads and liaisons only. */
async function reviewSourceChange(
  req: ZodReqWithUser<ReviewSourceChangeRequest>,
  res: Response,
) {
  try {
    const { projectID, eventID } = req.params;
    const ctx = await ProjectContext.load(projectID, { select: [] });
    if (!ctx.canAdmin(req.user)) throw new ProjectError("unauthorized");
    const bookID = ctx.getLinkedBook();
    if (!bookID) return res.status(400).send({ err: true, errMsg: NO_BOOK_MSG });

    const reviewer = req.user?.decoded?.uuid ?? "";
    const result = await markSourceChangeReviewed(bookID, eventID, reviewer);
    if (!result) {
      return res.status(404).send({ err: true, errMsg: "Change not found for this book." });
    }
    log.info({ projectID, eventID, ...result }, "Source change marked reviewed");
    return res.send({ err: false, data: result });
  } catch (err) {
    return sendError(res, err, "reviewSourceChange");
  }
}

async function updateContentSourcesNotifications(
  req: ZodReqWithUser<UpdateContentSourcesNotificationsRequest>,
  res: Response,
) {
  try {
    const { projectID } = req.params;
    const ctx = await ProjectContext.load(projectID, { select: [] });
    if (!ctx.canAdmin(req.user)) throw new ProjectError("unauthorized");

    const { enabled } = req.body;
    await Project.updateOne(
      { projectID: { $eq: projectID } },
      { $set: { notifySourceChanges: enabled } },
    );
    log.info({ projectID, enabled }, "Source-change emails setting changed");
    return res.send({ err: false, data: { notifySourceChanges: enabled } });
  } catch (err) {
    return sendError(res, err, "updateContentSourcesNotifications");
  }
}

export default {
  getContentSources,
  getContentPages,
  getContentPageLineage: getContentPageLineageHandler,
  reviewSourceChange,
  getChangeRevisions,
  updateContentSourcesNotifications,
};
