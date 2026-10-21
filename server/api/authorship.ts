import logger from "../logger.js";
import { Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { conductor500Err } from "../util/errorutils.js";
import Project, { ProjectInterface } from "../models/project.js";
import Author from "../models/author.js";
import Authorship, { AuthorshipAuthorRef, AuthorshipPage } from "../models/authorship.js";
import { ZodReqWithUser } from "../types/index.js";
import * as AuthorshipValidators from "./validators/Authorship.js";
import { NAME_KEY_LOOKUP_REGEX } from "./validators/authors.js";
import projectsAPI from "./projects.js";
import BookService from "./services/book-service.js";
import AuthorshipService, { replaceAuthorTag } from "../util/Authorshiputil.js";
import { isAuthorGroup } from "../util/author-groups.js";

const BUSY_MSG =
  "Authorship data is being refreshed or another update is running. Try again when it finishes.";

/** Max number of concurrent page-tag updates sent to the library during a bulk change. */
const BULK_CONCURRENCY = 5;

type ProjectReq = { params: { projectID: string }; user: ZodReqWithUser<unknown>["user"] };

/** A project known to have a library book. */
type BookProject = ProjectInterface & { libreLibrary: string; libreCoverID: string };

/**
 * Loads the project and checks the caller may work on it and that it has a library book. Sends
 * the error response and returns null when any of that fails.
 */
async function loadProject(req: ProjectReq, res: Response): Promise<BookProject | null> {
  const project = await Project.findOne({ projectID: { $eq: req.params.projectID } });
  if (!project) {
    res.status(404).send({ err: true, errMsg: "Project not found" });
    return null;
  }
  if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
    res.status(403).send({
      err: true,
      errMsg: "You do not have permission to access this project",
    });
    return null;
  }
  if (!project.libreLibrary || !project.libreCoverID) {
    res.status(400).send({
      err: true,
      errMsg: "Project does not have access to a LibreTexts book",
    });
    return null;
  }
  return project as BookProject;
}

const bookServiceFor = (project: ProjectInterface) =>
  new BookService({ bookID: `${project.libreLibrary}-${project.libreCoverID}` });

/** The book cover followed by every page in TOC order, each queued for a scan. */
async function buildPageList(project: ProjectInterface): Promise<AuthorshipPage[]> {
  const toc = await bookServiceFor(project).getBookTOCNew();
  const flatten = (pages: typeof toc.children): AuthorshipPage[] =>
    pages?.flatMap((page) => [
      { id: page.id, title: page.title, url: page.url, status: "pending" as const },
      ...flatten(page.children ?? []),
    ]) ?? [];
  return [
    { id: toc.id, title: toc.title, url: toc.url, status: "pending" },
    ...flatten(toc.children ?? []),
  ];
}

const getAuthorshipToc = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.GetAuthorshipSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { projectID } = req.params;

    const toc = await bookServiceFor(project).getBookTOCNew();
    let doc = await Authorship.findOne({ projectID: { $eq: projectID } });
    if (!doc) {
      doc = await Authorship.create({
        projectID,
        createdBy: req.user.decoded.uuid,
        updatedBy: req.user.decoded.uuid,
        pages: await buildPageList(project),
      });
    }

    const service = new AuthorshipService();
    const status = service.getStatus(doc);
    // Start a fresh scan, or resume one whose run died (pending pages, stale lock). The run takes
    // the lock atomically, so concurrent requests can't start two.
    if (status.statusCode === "pending" && !status.processing) {
      service
        .run(projectID, project.libreLibrary, project.libreCoverID)
        .catch((err) => logger.error({ err, projectID }, "Authorship scan failed"));
    }

    return res.send({ err: false, toc, status: status.statusCode });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getAuthorshipToc failed");
    return conductor500Err(res);
  }
};

const reloadAuthorship = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.AuthorshipReloadSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { projectID } = req.params;

    if (!(await Authorship.exists({ projectID: { $eq: projectID } }))) {
      return res.status(404).send({ err: true, errMsg: "Authorship not found" });
    }
    // Take the lock before resetting pages so a concurrent /toc request can't start a second run.
    const lockID = await AuthorshipService.acquireLock(projectID);
    if (!lockID) return res.status(409).send({ err: true, errMsg: BUSY_MSG });

    try {
      await Authorship.updateOne(
        { projectID: { $eq: projectID }, processingLockID: { $eq: lockID } },
        { $set: { pages: await buildPageList(project), updatedBy: req.user.decoded.uuid } },
      );
    } catch (err) {
      await AuthorshipService.releaseLock(projectID, lockID);
      throw err;
    }

    new AuthorshipService()
      .run(projectID, project.libreLibrary, project.libreCoverID, lockID)
      .catch((err) => logger.error({ err, projectID }, "Authorship rescan failed"));

    return res.send({ err: false, status: "pending" });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "reloadAuthorship failed");
    return conductor500Err(res);
  }
};

type ResolvedAuthor = {
  nameKey: string;
  name: string;
  nameURL?: string;
  campusName?: string;
  isGroup: boolean;
};

/** Looks up the authors that tag values refer to by key. Values that aren't keys are ignored. */
async function resolveAuthorKeys(values: string[]): Promise<Map<string, ResolvedAuthor>> {
  const keys = [...new Set(values)].filter((v) => NAME_KEY_LOOKUP_REGEX.test(v));
  if (keys.length === 0) return new Map();
  const authors = await Author.find(
    { orgID: process.env.ORG_ID, nameKey: { $in: keys } },
    { _id: 0, nameKey: 1, name: 1, nameURL: 1, campusName: 1, groupMembers: 1 },
  ).lean();
  return new Map(
    authors.map((a) => [
      a.nameKey,
      {
        nameKey: a.nameKey,
        name: a.name,
        nameURL: a.nameURL,
        campusName: a.campusName,
        isGroup: isAuthorGroup(a),
      },
    ]),
  );
}

const getAuthorship = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.GetAuthorshipSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;

    const doc = await Authorship.findOne({ projectID: { $eq: req.params.projectID } }).lean();
    if (!doc) return res.status(404).send({ err: true, errMsg: "Authorship not found" });

    const allRefs = doc.pages.flatMap((p) => [
      ...(p.pageAuthors ?? []),
      ...(p.sourceAuthor ? [p.sourceAuthor] : []),
      ...(p.contentAuthors ?? []),
    ]);
    const authors = await resolveAuthorKeys(allRefs.map((r) => r.value));
    // An unresolved ref is shown as its raw text (e.g. an older `author@<Name>` tag).
    const resolve = (ref: AuthorshipAuthorRef) => ({ ...ref, author: authors.get(ref.value) });

    return res.send({
      err: false,
      bookPageID: project.libreCoverID,
      pages: doc.pages.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        status: p.status,
        pageAuthors: (p.pageAuthors ?? []).map(resolve),
        sourceAuthor: p.sourceAuthor ? resolve(p.sourceAuthor) : undefined,
        contentAuthors: (p.contentAuthors ?? []).map(resolve),
      })),
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getAuthorship failed");
    return conductor500Err(res);
  }
};

const getAuthorshipStatus = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.GetAuthorshipSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;

    const doc = await Authorship.findOne({ projectID: { $eq: req.params.projectID } });
    const status = new AuthorshipService().getStatus(doc);
    // A job still "running" after its lock went stale died with the server.
    const bulkJob = doc?.bulkJob
      ? {
          ...doc.toObject().bulkJob,
          status:
            doc.bulkJob.status === "running" && !AuthorshipService.isLockActive(doc)
              ? ("failed" as const)
              : doc.bulkJob.status,
        }
      : undefined;

    return res.send({
      err: false,
      status: status.statusCode,
      processing: "processing" in status ? status.processing : false,
      total: "total" in status ? status.total : 0,
      completed: "completed" in status ? status.completed : 0,
      failed: "failed" in status ? status.failed : 0,
      pending: "pending" in status ? status.pending : 0,
      bulkJob,
    });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "getAuthorshipStatus failed");
    return conductor500Err(res);
  }
};

/** Checks the author exists and has a key. Returns an error message, or null when it is fine. */
async function checkAuthorKey(authorKey: string | null): Promise<string | null> {
  if (authorKey === null) return null;
  const exists = await Author.exists({ orgID: process.env.ORG_ID, nameKey: authorKey });
  return exists ? null : `No author has the key "${authorKey}".`;
}

/** Writes the author tag on one library page, leaving every non-`author@` tag in place. */
async function writePageAuthor(
  bookService: BookService,
  pageID: string,
  authorKey: string | null,
): Promise<void> {
  const current = (await bookService.getPageTags(pageID)).map((t) => t["@value"]);
  const [error, success] = await bookService.updatePageDetails(
    pageID,
    undefined,
    replaceAuthorTag(current, authorKey),
  );
  if (error || !success) throw new Error(error ?? "Failed to update page tags");
}

/** Records the new author on the stored page entries, so the table reflects it without a rescan. */
async function setStoredPageAuthor(projectID: string, pageIDs: string[], authorKey: string | null) {
  if (pageIDs.length === 0) return;
  const path = "pages.$[page].pageAuthors";
  await Authorship.updateOne(
    { projectID: { $eq: projectID } },
    authorKey
      ? { $set: { [path]: [{ tag: "author@", value: authorKey }] } }
      : { $unset: { [path]: "" } },
    { arrayFilters: [{ "page.id": { $in: pageIDs } }] },
  );
}

/** The page already carries exactly this author, so writing it would change nothing. */
const isUnchanged = (page: AuthorshipPage, authorKey: string | null) => {
  const ownTags = (page.pageAuthors ?? []).filter((r) => r.tag === "author@");
  return authorKey === null
    ? ownTags.length === 0
    : ownTags.length === 1 && ownTags[0].value === authorKey;
};

const updateAuthorshipAuthor = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.UpdateAuthorshipAuthorSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { projectID } = req.params;
    const { pageID, authorKey } = req.body;

    const doc = await Authorship.findOne({ projectID: { $eq: projectID } });
    if (!doc) return res.status(404).send({ err: true, errMsg: "Authorship not found" });
    // A running scan periodically rewrites every page entry, which would undo this edit.
    if (AuthorshipService.isLockActive(doc)) {
      return res.status(409).send({ err: true, errMsg: BUSY_MSG });
    }

    const authorError = await checkAuthorKey(authorKey);
    if (authorError) return res.status(400).send({ err: true, errMsg: authorError });

    const bookService = bookServiceFor(project);
    if (!(await bookService.canAccessPage(req.user.decoded.uuid, pageID))) {
      return res.status(403).send({
        err: true,
        errMsg: "You do not have permission to update this page",
      });
    }

    await writePageAuthor(bookService, pageID, authorKey);
    await setStoredPageAuthor(projectID, [pageID], authorKey);

    return res.send({ err: false, pageID, authorKey });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "updateAuthorshipAuthor failed");
    return conductor500Err(res);
  }
};

type BulkSkipReason = "not-found" | "unchanged" | "no-access";

/**
 * Applies one author to many pages. Runs in the background (two library calls per page take
 * minutes for a large book) while holding the scan lock, and the client polls /status.
 */
const bulkUpdateAuthorshipAuthor = async (
  req: ZodReqWithUser<z.infer<typeof AuthorshipValidators.BulkUpdateAuthorshipAuthorSchema>>,
  res: Response,
) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const { projectID } = req.params;
    const { pageIDs, authorKey } = req.body;

    const doc = await Authorship.findOne({ projectID: { $eq: projectID } });
    if (!doc) return res.status(404).send({ err: true, errMsg: "Authorship not found" });
    if (AuthorshipService.isLockActive(doc)) {
      return res.status(409).send({ err: true, errMsg: BUSY_MSG });
    }

    const authorError = await checkAuthorKey(authorKey);
    if (authorError) return res.status(400).send({ err: true, errMsg: authorError });

    const bookService = bookServiceFor(project);
    const bookPageIDs = new Set(await bookService.getBookPageIDs(false));
    const pagesById = new Map(doc.pages.map((p) => [p.id, p]));

    const skipped: { pageID: string; reason: BulkSkipReason }[] = [];
    const toUpdate: string[] = [];
    for (const pageID of new Set(pageIDs)) {
      const page = pagesById.get(pageID);
      if (!page) skipped.push({ pageID, reason: "not-found" });
      else if (isUnchanged(page, authorKey)) skipped.push({ pageID, reason: "unchanged" });
      else if (!bookPageIDs.has(pageID)) skipped.push({ pageID, reason: "no-access" });
      else toUpdate.push(pageID);
    }

    if (toUpdate.length === 0) {
      return res.send({ err: false, queued: 0, skipped });
    }

    const lockID = await AuthorshipService.acquireLock(projectID);
    if (!lockID) return res.status(409).send({ err: true, errMsg: BUSY_MSG });

    const jobID = randomUUID();
    try {
      await Authorship.updateOne(
        { projectID: { $eq: projectID } },
        {
          $set: {
            bulkJob: {
              jobID,
              status: "running",
              total: toUpdate.length,
              processed: 0,
              updated: 0,
              failed: 0,
              skipped: skipped.length,
            },
          },
        },
      );
    } catch (err) {
      await AuthorshipService.releaseLock(projectID, lockID);
      throw err;
    }

    AuthorshipService.withLock(projectID, lockID, () =>
      runBulkJob({ projectID, jobID, bookService, pageIDs: toUpdate, authorKey }),
    ).catch(async (err) => {
      logger.error({ err, projectID, jobID }, "Bulk authorship update job failed");
      await Authorship.updateOne(
        { projectID: { $eq: projectID }, "bulkJob.jobID": { $eq: jobID } },
        { $set: { "bulkJob.status": "failed" } },
      ).catch((updateErr) =>
        logger.error({ err: updateErr, projectID, jobID }, "Failed to mark bulk job failed"),
      );
    });

    return res.send({ err: false, jobID, queued: toUpdate.length, skipped });
  } catch (err) {
    logger.error({ err, projectID: req.params.projectID }, "bulkUpdateAuthorshipAuthor failed");
    return conductor500Err(res);
  }
};

async function runBulkJob(params: {
  projectID: string;
  jobID: string;
  bookService: BookService;
  pageIDs: string[];
  authorKey: string | null;
}) {
  const { projectID, jobID, bookService, pageIDs, authorKey } = params;
  const jobFilter = { projectID: { $eq: projectID }, "bulkJob.jobID": { $eq: jobID } };
  let updated = 0;
  let failed = 0;

  const updatePage = async (pageID: string) => {
    let ok = false;
    try {
      await writePageAuthor(bookService, pageID, authorKey);
      await setStoredPageAuthor(projectID, [pageID], authorKey);
      ok = true;
    } catch (err) {
      logger.warn({ err, projectID, pageID }, "Bulk authorship update failed for page");
    }
    if (ok) updated += 1;
    else failed += 1;
    await Authorship.updateOne(jobFilter, {
      $inc: { "bulkJob.processed": 1, [ok ? "bulkJob.updated" : "bulkJob.failed"]: 1 },
    }).catch((err) => logger.warn({ err, projectID, jobID }, "Failed to record bulk progress"));
  };

  const queue = [...pageIDs];
  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await updatePage(next);
      }
    }),
  );

  // Counters are set outright at the end in case a progress write was lost.
  await Authorship.updateOne(jobFilter, {
    $set: {
      "bulkJob.status": "completed",
      "bulkJob.processed": pageIDs.length,
      "bulkJob.updated": updated,
      "bulkJob.failed": failed,
    },
  });
  logger.info({ projectID, updated, failed }, "Bulk authorship update finished");
}

export default {
  getAuthorshipToc,
  reloadAuthorship,
  getAuthorship,
  getAuthorshipStatus,
  updateAuthorshipAuthor,
  bulkUpdateAuthorshipAuthor,
};
