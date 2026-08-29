import { Response } from "express";
import { z } from "zod";
import AdmZip from "adm-zip";
import { ZodReqWithUser } from "../types";
import {
  BookScopedValidator,
  CreateJobValidator,
  GetJobsValidator,
  WebhookValidator,
} from "./validators/shapeshift";
import ShapeshiftService from "./services/shapeshift-service";
import {
  BookExportProbe,
  getBookExportManifest,
  getExportDefinition,
} from "./services/book-export-service.js";
import Book from "../models/book.js";
import Project, { ProjectInterfaceRaw } from "../models/project.js";
import projectsAPI from "./projects.js";
import conductorErrors from "../conductor-errors.js";
import logger from "../logger.js";
import { getLibraryAndPageFromBookID } from "../util/bookutils.js";

export async function createJob(
  req: ZodReqWithUser<z.infer<typeof CreateJobValidator>>,
  res: Response
) {
  const service = new ShapeshiftService();
  const jobId = await service.createJob({
    highPriority: req.body.highPriority,
    url: req.body.url,
  });
  if (!jobId) {
    return res.status(500).json({
      err: true,
      errMsg: 'Error creating job',
    });
  }

  return res.status(200).json({
    err: false,
    msg: 'Created job.',
    jobId,
  });
}

export async function getJobs(
  req: ZodReqWithUser<z.infer<typeof GetJobsValidator>>,
  res: Response
) {
  const service = new ShapeshiftService();
  const { jobs, meta } = await service.getOpenJobs(req.query);
  return res.status(200).json({
    err: false,
    msg: 'Retrieved jobs.',
    meta,
    jobs,
  });
}

export async function handleWebhook(
  req: z.infer<typeof WebhookValidator>,
  res: Response
) {
  const service = new ShapeshiftService();
  const result = await service.handleWebhook(req.body);

  if (result === 'accepted') {
    return res.status(202).json({
      err: false,
      msg: 'Webhook accepted. Book is not yet known to Commons; a library sync was queued.',
    });
  }

  if (result === 'invalid_timestamp') {
    return res.status(400).json({
      err: true,
      msg: 'Invalid timestamp for webhook.',
    });
  }

  if (result === 'stale') {
    return res.status(200).json({
      err: false,
      msg: 'Webhook ignored, newer compilation data already recorded.',
    });
  }

  if (result === 'error') {
    return res.status(500).json({
      err: true,
      msg: 'Error processing webhook.',
    });
  }

  return res.status(200).json({
    err: false,
    msg: 'Webhook processed.',
  });
}

/**
 * Resolves the Project that owns a book and confirms the requesting user is on
 * its team.
 *
 * Compiling is open to any project member (not just admins), so membership is
 * the whole check. Returns `null` after responding, so callers can `if (!x) return;`.
 */
async function authorizeBookAccess(
  req: ZodReqWithUser<{ params: { bookID: string } }>,
  res: Response
): Promise<ProjectInterfaceRaw | null> {
  const { bookID } = req.params;
  const [library, coverID] = getLibraryAndPageFromBookID(bookID);
  if (!library || !coverID) {
    res.status(400).send({ err: true, errMsg: conductorErrors.err1 });
    return null;
  }

  const project = await Project.findOne({
    libreLibrary: library,
    libreCoverID: coverID,
  }).lean();

  if (!project) {
    res.status(404).send({
      err: true,
      errMsg: "No project found for this book.",
    });
    return null;
  }

  if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
    res.status(403).send({ err: true, errMsg: conductorErrors.err8 });
    return null;
  }

  return project as unknown as ProjectInterfaceRaw;
}

/**
 * The URL Shapeshift is asked to compile.
 *
 * A project earns the compile action either by carrying an explicit
 * `projectURL` or by being linked to a library book, in which case the book's
 * live page is the target.
 */
function resolveCompileURL(project: ProjectInterfaceRaw): string | null {
  if (project.projectURL) return project.projectURL;
  if (project.libreLibrary && project.libreCoverID) {
    return `https://${project.libreLibrary}.libretexts.org/@go/page/${project.libreCoverID}`;
  }
  return null;
}

/**
 * Returns every export the downloads service holds for a book, with sizes and
 * generation dates, alongside the Book's stored compilation info.
 *
 * Both halves ship together so the drawer's status bar and export rail render
 * from one request.
 */
export async function getBookExports(
  req: ZodReqWithUser<z.infer<typeof BookScopedValidator>>,
  res: Response
) {
  const project = await authorizeBookAccess(req, res);
  if (!project) return;

  const { bookID } = req.params;
  const [book, exports] = await Promise.all([
    Book.findOne({ bookID: { $eq: bookID } }).lean(),
    getBookExportManifest(bookID),
  ]);

  return res.status(200).json({
    err: false,
    msg: "Retrieved book exports.",
    exports,
    exportInfo: book?.exportInfo ?? null,
  });
}

/**
 * Reports the status of the most recent compile submitted from Conductor.
 *
 * `job` is null when the book has never been compiled from here, which the
 * client reads as the never-compiled state.
 */
export async function getBookCompileJob(
  req: ZodReqWithUser<z.infer<typeof BookScopedValidator>>,
  res: Response
) {
  const project = await authorizeBookAccess(req, res);
  if (!project) return;

  const { bookID } = req.params;
  const book = await Book.findOne({ bookID: { $eq: bookID } }).lean();
  const jobID = book?.exportInfo?.lastJobID;

  if (!jobID) {
    return res.status(200).json({
      err: false,
      msg: "No compile job on record for this book.",
      job: null,
      exportInfo: book?.exportInfo ?? null,
    });
  }

  const service = new ShapeshiftService();
  const job = await service.getJob(jobID);

  return res.status(200).json({
    err: false,
    msg: "Retrieved compile job.",
    job,
    exportInfo: book?.exportInfo ?? null,
  });
}

/**
 * Submits a compile for a project's book.
 *
 * Open to any project member. There is no debounce: Shapeshift de-duplicates
 * concurrent submissions for the same resource and returns the in-flight job's
 * ID, so a double click costs nothing.
 */
export async function compileBook(
  req: ZodReqWithUser<z.infer<typeof BookScopedValidator>>,
  res: Response
) {
  const project = await authorizeBookAccess(req, res);
  if (!project) return;

  const url = resolveCompileURL(project);
  if (!url) {
    return res.status(400).send({
      err: true,
      errMsg:
        "This project has no linked URL or library book, so it cannot be compiled.",
    });
  }

  // Refuse before submitting rather than after. The job ID is recorded on the
  // Book, so a project whose book Commons has not synced yet would get a job
  // running with nowhere to store its ID, and the drawer would report the book
  // as never compiled while a compile was in flight.
  const { bookID } = req.params;
  const bookExists = await Book.exists({ bookID: { $eq: bookID } });
  if (!bookExists) {
    return res.status(409).send({
      err: true,
      errMsg:
        "This book has not been published to the Commons yet, so it cannot be compiled from here.",
    });
  }

  const service = new ShapeshiftService();
  const jobId = await service.createJob({ url });
  if (!jobId) {
    return res.status(500).send({ err: true, errMsg: "Error creating job." });
  }

  await Book.updateOne(
    { bookID: { $eq: bookID } },
    {
      $set: {
        "exportInfo.lastJobID": jobId,
        "exportInfo.lastJobSubmittedAt": new Date(),
        "exportInfo.lastJobSubmittedBy": req.user.decoded.uuid,
      },
    }
  );

  return res.status(200).json({
    err: false,
    msg: "Compile job submitted.",
    jobId,
  });
}

/**
 * Total bytes this endpoint will hold in memory before giving up.
 *
 * The archive is assembled in-process, so an unbounded book could otherwise
 * take the worker down. Well past any real book, small enough to be a ceiling.
 */
const DOWNLOAD_ALL_MAX_BYTES = 500 * 1024 * 1024;

const DOWNLOAD_ALL_FILE_TIMEOUT_MS = 60_000;

/**
 * Streams every available export for a book as one zip.
 *
 * Done server-side because the downloads host sends no CORS headers, so the
 * browser cannot fetch the artifacts to zip them itself.
 */
export async function downloadAllBookExports(
  req: ZodReqWithUser<z.infer<typeof BookScopedValidator>>,
  res: Response
) {
  const project = await authorizeBookAccess(req, res);
  if (!project) return;

  const { bookID } = req.params;
  const manifest = await getBookExportManifest(bookID);
  const available = manifest.filter((e: BookExportProbe) => e.available);

  if (available.length === 0) {
    return res.status(404).send({
      err: true,
      errMsg:
        "No exports are available for this book yet. Try compiling it again.",
    });
  }

  const zip = new AdmZip();
  let totalBytes = 0;

  for (const entry of available) {
    const definition = getExportDefinition(entry.key);
    if (!definition) continue;

    if (totalBytes + (entry.sizeBytes ?? 0) > DOWNLOAD_ALL_MAX_BYTES) {
      logger.warn(
        { bookID, exportKey: entry.key, totalBytes },
        "Download-all size cap reached, omitting remaining exports"
      );
      break;
    }

    try {
      const fileRes = await fetch(entry.downloadURL, {
        signal: AbortSignal.timeout(DOWNLOAD_ALL_FILE_TIMEOUT_MS),
      });
      if (!fileRes.ok) {
        logger.warn(
          { bookID, exportKey: entry.key, status: fileRes.status },
          "Skipping export in download-all, fetch was not OK"
        );
        continue;
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      totalBytes += buffer.byteLength;
      zip.addFile(`${bookID}-${entry.key}.${definition.extension}`, buffer);
    } catch (err) {
      // One unreachable artifact should not cost the user the other six.
      logger.warn(
        { err, bookID, exportKey: entry.key },
        "Skipping export in download-all, fetch failed"
      );
    }
  }

  if (zip.getEntries().length === 0) {
    return res.status(502).send({
      err: true,
      errMsg:
        "None of this book's exports could be retrieved. Try again in a few minutes.",
    });
  }

  const archive = zip.toBuffer();
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${bookID}-exports.zip"`
  );
  res.setHeader("Content-Length", archive.byteLength.toString());
  return res.status(200).send(archive);
}
