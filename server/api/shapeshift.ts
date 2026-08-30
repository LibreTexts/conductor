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
 * Resolves the Project that owns a book, by the library and cover page its ID
 * encodes.
 *
 * Shared by the request-scoped {@link authorizeBookAccess} and by background
 * callers (the store auto-heal reconciler) that need the same lookup without a
 * user or a response to write to. Returns `null` for a malformed book ID as well
 * as for a book no project owns — neither is actionable, and the difference does
 * not change what any caller does next.
 */
export async function findProjectForBookID(
  bookID: string
): Promise<ProjectInterfaceRaw | null> {
  const [library, coverID] = getLibraryAndPageFromBookID(bookID);
  if (!library || !coverID) return null;

  const project = await Project.findOne({
    libreLibrary: library,
    libreCoverID: coverID,
  }).lean();

  return (project as unknown as ProjectInterfaceRaw) ?? null;
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

  const project = await findProjectForBookID(bookID);

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
export function resolveCompileURL(project: ProjectInterfaceRaw): string | null {
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

export type SubmitCompileResult =
  | { ok: true; jobId: string }
  | { ok: false; status: 400 | 409 | 500; errMsg: string };

/**
 * Submits a compile for a project's book and records the job on the Book.
 *
 * Shared by the compile route and the publishing flow's compile step so both
 * resolve the URL, apply the same refusals, and stamp `exportInfo` identically.
 * Returns a discriminated result rather than writing a response, because the
 * two callers report failure differently.
 */
export async function submitCompileForBook(
  project: ProjectInterfaceRaw,
  bookID: string,
  actorUUID: string
): Promise<SubmitCompileResult> {
  const url = resolveCompileURL(project);
  if (!url) {
    return {
      ok: false,
      status: 400,
      errMsg:
        "This project has no linked URL or library book, so it cannot be compiled.",
    };
  }

  // Refuse before submitting rather than after. The job ID is recorded on the
  // Book, so a project whose book Commons has not synced yet would get a job
  // running with nowhere to store its ID, and the drawer would report the book
  // as never compiled while a compile was in flight.
  const bookExists = await Book.exists({ bookID: { $eq: bookID } });
  if (!bookExists) {
    return {
      ok: false,
      status: 409,
      errMsg:
        "This book has not been published to the Commons yet, so it cannot be compiled from here.",
    };
  }

  const service = new ShapeshiftService();
  const jobId = await service.createJob({ url });
  if (!jobId) {
    return { ok: false, status: 500, errMsg: "Error creating job." };
  }

  await Book.updateOne(
    { bookID: { $eq: bookID } },
    {
      $set: {
        "exportInfo.lastJobID": jobId,
        "exportInfo.lastJobSubmittedAt": new Date(),
        "exportInfo.lastJobSubmittedBy": actorUUID,
      },
    }
  );

  return { ok: true, jobId };
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

  const result = await submitCompileForBook(
    project,
    req.params.bookID,
    req.user.decoded.uuid
  );
  if (!result.ok) {
    return res.status(result.status).send({ err: true, errMsg: result.errMsg });
  }

  return res.status(200).json({
    err: false,
    msg: "Compile job submitted.",
    jobId: result.jobId,
  });
}

/**
 * Total export bytes this endpoint will pull into memory.
 *
 * The archive is assembled in-process, and `zip.toBuffer()` renders a second
 * copy of everything, so peak usage is roughly twice this number. 250 MB keeps
 * that peak near half a gigabyte while still being well past any real book's
 * combined exports.
 */
const DOWNLOAD_ALL_MAX_BYTES = 250 * 1024 * 1024;

const DOWNLOAD_ALL_FILE_TIMEOUT_MS = 60_000;

/**
 * Reads a response body into a buffer, giving up once it passes `maxBytes`.
 *
 * The manifest's `sizeBytes` comes from a HEAD probe, so it is a hint and not a
 * promise: the downloads host may omit `Content-Length`, report a stale value
 * from before a recompile, or serve a chunked response with no length at all.
 * A cap that only reads that number does not cap anything. This one holds
 * against bytes actually received.
 *
 * Returns `null` on overflow, cancelling the stream rather than draining it, so
 * an oversized artifact costs a few chunks instead of its full size. The
 * partial buffer is dropped: half a PDF in the zip is worse than no PDF.
 */
async function readBodyCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<Buffer | null> {
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, received);
}

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

    const remaining = DOWNLOAD_ALL_MAX_BYTES - totalBytes;

    // The probed size is only a hint, so this skips a fetch that clearly cannot
    // fit rather than deciding anything. `readBodyCapped` is what enforces.
    if ((entry.sizeBytes ?? 0) > remaining) {
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

      const buffer = await readBodyCapped(fileRes.body, remaining);
      if (!buffer) {
        // Dropped rather than fatal: the other exports are still worth zipping,
        // and a book whose PDF alone blows the budget should still hand back
        // its LMS packages.
        logger.warn(
          { bookID, exportKey: entry.key, totalBytes, remaining },
          "Skipping export in download-all, response exceeded the size cap"
        );
        continue;
      }

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
