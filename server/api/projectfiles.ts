import { NextFunction, Request, Response } from "express";
import conductorErrors from "../conductor-errors.js";
import ProjectFile, {
  ProjectFileInterface,
  ProjectFileInterfaceAccess,
  RawProjectFileInterface,
} from "../models/projectfile.js";
import multer from "multer";
import Project from "../models/project.js";
import Organization from "../models/organization.js";
import {
  computeStructureAccessSettings,
  downloadProjectFiles,
  getFolderContents,
  getProjectFiles,
  parseAndZipS3Objects,
  retrieveAllProjectFiles,
  updateProjectFiles as updateProjectFilesUtil,
} from "../util/projectutils.js";
import { isObjectIdOrHexString } from "mongoose";
import async from "async";
import {
  assembleUrl,
  getPaginationOffset,
  getRandomOffset,
} from "../util/helpers.js";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { v4 } from "uuid";
import { debugError } from "../debug.js";
import * as MiscValidators from "./validators/misc.js";
import {
  conductor400Err,
  conductor404Err,
  conductor500Err,
} from "../util/errorutils.js";
import projectsAPI from "./projects.js";
import { upsertAssetTags } from "./assettagging.js";
import { Types } from "mongoose";
import { z } from "zod";
import {
  addProjectFileSchema,
  bulkDownloadProjectFilesSchema,
  getProjectFileSchema,
  getProjectFolderContentsSchema,
  getPublicProjectFilesSchema,
  getProjectFileDownloadURLSchema,
  moveProjectFileSchema,
  removeProjectFileSchema,
  updateProjectFileAccessSchema,
  updateProjectFileSchema,
  addProjectFileFolderSchema,
  createProjectFileStreamUploadURLSchema,
  videoDataSchema,
  updateProjectFileCaptionsSchema,
  getProjectFileCaptionsSchema,
  getProjectFileEmbedHTMLSchema,
  bulkUpdateProjectFilesSchema,
  bulkUpdateProjectFileMetadataSchema,
} from "./validators/projectfiles.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import { ZodReqWithFiles } from "../types/Express";
import Author from "../models/author.js";
import { isAuthorObject } from "../util/typeHelpers.js";
import { Schema } from "mongoose";
import User from "../models/user.js";
import VideoUploadGrant from "../models/videoUploadGrant.js";
import { generateVideoStreamURL } from "../util/videoutils.js";
import axios from "axios";
import mime from "mime";

const filesStorage = multer.memoryStorage();
const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_SIZE = 100000000; // 100mb
const LIBRETEXTS_ALLOWED_ORIGINS = ["*.libretexts.org", "*.libretexts.net"];
/** How long a Cloudflare Stream upload slot stays valid before it can be swept. */
const VIDEO_UPLOAD_GRANT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/**
 * How long the grant record itself is retained. Deliberately much longer than
 * VIDEO_UPLOAD_GRANT_TTL_MS so Mongo's TTL index cannot reap a record before the
 * cleanup job has had the chance to delete its Cloudflare video.
 */
const VIDEO_UPLOAD_GRANT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Maximum number of orphaned videos deleted in a single cleanup run. */
const ORPHANED_VIDEO_CLEANUP_BATCH_SIZE = 200;
const ALLOWED_MIME_TYPES = [
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv", // .csv
  "application/json", // .json
  "text/plain", // .txt
  "text/html", // .html
  "text/markdown", // .md
  "application/vnd.oasis.opendocument.text", // .odt
  "image/*",
  "video/*",
  "application/pdf", // .pdf
  "model/gltf-binary", // .glb
  "model/obj", // .obj
  "model/stl", // .stl
  "application/zip", // .zip
  "application/x-zip-compressed", // .zip (sometimes used on Windows)
  "text/x-tex", // .tex
  "text/vtt", // .vtt
]

/**
 * Multer handler to process and validate Project File uploads.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next middleware to call.
 * @returns {function} The Project File upload handler.
 */
function fileUploadHandler(req: Request, res: Response, next: NextFunction) {
  // If the 'file' is a URL, skip multer
  if (req.body.isURL && req.body.fileURL) {
    return next();
  }
  const fileUploadConfig = multer({
    storage: filesStorage,
    limits: {
      files: MAX_UPLOAD_FILES,
      fileSize: MAX_UPLOAD_FILE_SIZE,
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes("/")) {
        // @ts-ignore
        return cb(new Error("filenameslash"), false);
      }
      if (file.originalname.endsWith(".tex")) {
        file.mimetype = "text/x-tex";
      }
      if (file.originalname.endsWith(".vtt")) {
        file.mimetype = "text/vtt";
      }
      if (file.originalname.endsWith(".obj")) {
        file.mimetype = "model/obj";
      }
      if (file.originalname.endsWith(".stl")) {
        file.mimetype = "model/stl";
      }
      if (file.originalname.endsWith(".glb")) {
        file.mimetype = "model/gltf-binary";
      }
      if (file.originalname.endsWith(".zip")) {
        file.mimetype = "application/zip"; // Normalize .zip to application/zip for consistency
      }
      const isAllowed = ALLOWED_MIME_TYPES.some((allowed) =>
        allowed.endsWith("/*")
          ? file.mimetype.startsWith(allowed.slice(0, -1)) // "image/" etc.
          : file.mimetype === allowed
      );
      // @ts-ignore
      if (!isAllowed) return cb(new Error("filetype"), false);
      return cb(null, true);
    },
  }).array("files", req.method === "POST" ? MAX_UPLOAD_FILES : 1);
  return fileUploadConfig(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        errMsg = conductorErrors.err60;
      }
      if (err.message === "filenameslash") {
        errMsg = conductorErrors.err61;
      }
      if (err.message === "filetype") {
        errMsg = conductorErrors.err2;
      }
      return res.status(400).send({
        err: true,
        errMsg,
      });
    }
    return next();
  });
}

/**
 * Uploads Files linked to a Project to the corresponding folder
 * in S3 and updates the Files list.
 */
export async function addProjectFile(
  req: ZodReqWithFiles<ZodReqWithUser<z.infer<typeof addProjectFileSchema>>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    // Set the file license to the project default if it exists
    const licenseObj = project.defaultFileLicense || undefined;

    // Set default authors if present
    const defaultPrimary = project.defaultPrimaryAuthorID;

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      throw new Error("retrieveerror");
    }

    let parent = "";
    let accessSetting: ProjectFileInterfaceAccess = "team"; // default to team (private)
    if (req.body.parentID && req.body.parentID !== "") {
      const foundParent = files.find((obj) => obj.fileID === req.body.parentID);
      if (!foundParent || foundParent.storageType === "file") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err64,
        });
      }
      parent = req.body.parentID;
      if (foundParent.access !== "mixed") {
        accessSetting = foundParent.access ?? "team"; // assume same setting as parent, else default to team
      }
    }

    // Add a file
    const storageClient = new S3Client({ region: process.env.AWS_PROJECTFILES_REGION || process.env.AWS_REGION });
    const providedFiles = Array.isArray(req.files) && req.files.length > 0;
    const filesToCreate: RawProjectFileInterface[] = [];

    const parsedVideoData =
      typeof req.body.videoData === "string"
        ? JSON.parse(req.body.videoData)
        : req.body.videoData;

    if (parsedVideoData && parsedVideoData.length) {
      // Only videos this user was granted an upload slot for, on this project, may be attached.
      const submittedVideoIDs = parsedVideoData.map(
        (videoData: z.infer<typeof videoDataSchema>) => videoData.videoID
      );
      const grants = await VideoUploadGrant.find({
        videoID: { $in: submittedVideoIDs },
        projectID,
        createdBy: req.user.decoded.uuid,
        claimed: false,
      }).lean();

      const grantedVideoIDs = new Set(grants.map((grant) => grant.videoID));
      const hasUnknownVideo = submittedVideoIDs.some(
        (videoID: string) => !grantedVideoIDs.has(videoID)
      );
      const hasDuplicateVideo =
        new Set<string>(submittedVideoIDs).size !== submittedVideoIDs.length;
      if (hasUnknownVideo || hasDuplicateVideo) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err2,
        });
      }

      // Claim the grants before the Project Files are written, and roll the
      // claim back if any downstream step fails. Claiming afterwards leaves a
      // live video looking abandoned to the cleanup sweep whenever the claim
      // write is the thing that fails. Grants are claimed one at a time, with
      // `claimed: false` as the concurrency latch, so the rollback targets
      // exactly the slots this request won and never one a concurrent request
      // is legitimately holding.
      const claimedVideoIDs: string[] = [];
      const releaseClaims = async () => {
        if (claimedVideoIDs.length === 0) return;
        await VideoUploadGrant.updateMany(
          { videoID: { $in: claimedVideoIDs } },
          { $set: { claimed: false } }
        );
      };

      for (const videoID of submittedVideoIDs as string[]) {
        const claimed = await VideoUploadGrant.findOneAndUpdate(
          {
            videoID,
            projectID,
            createdBy: req.user.decoded.uuid,
            claimed: false,
          },
          { $set: { claimed: true } }
        ).lean();
        if (!claimed) break;
        claimedVideoIDs.push(videoID);
      }

      if (claimedVideoIDs.length !== submittedVideoIDs.length) {
        // A concurrent request took one of these slots between the find above
        // and the claim, so the batch is no longer trustworthy.
        await releaseClaims();
        return res.status(409).send({
          err: true,
          errMsg: conductorErrors.err2,
        });
      }

      const cloudflareUpdates: Promise<any>[] = [];
      parsedVideoData.forEach((videoData: z.infer<typeof videoDataSchema>) => {
        const newID = v4();
        filesToCreate.push({
          projectID,
          fileID: newID,
          name: videoData.videoName,
          access: accessSetting,
          size: 0,
          createdBy: req.user.decoded.uuid,
          downloadCount: 0,
          storageType: "file",
          parent,
          license: licenseObj,
          mimeType: "video/*",
          primaryAuthor: defaultPrimary
            ? (defaultPrimary as unknown as Schema.Types.ObjectId)
            : undefined,
          originalPublisher: req.body.originalPublisher,
          isVideo: true,
          videoStorageID: videoData.videoID,
          version: 1, // initial version
        });

        // Set allowedOrigins on Cloudflare Stream
        const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${videoData.videoID}`;
        cloudflareUpdates.push(
          axios.post(
            ENDPOINT,
            {
              allowedOrigins: LIBRETEXTS_ALLOWED_ORIGINS,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          )
        );
      });

      try {
        await Promise.all(cloudflareUpdates);
        await ProjectFile.insertMany(filesToCreate);
      } catch (err) {
        // Hand the slots back to the cleanup sweep rather than stranding a
        // billed upload. A partially-applied insertMany would release a slot
        // whose Project File does exist; the sweep re-checks Project Files
        // before deleting anything, so that case reconciles instead of losing
        // the video.
        await releaseClaims().catch((releaseErr) =>
          debugError(
            `Failed to release video upload grants after a failed attach: ${releaseErr}`
          )
        );
        throw err;
      }

      filesToCreate.length = 0; // clear array for use by standard files below
    }

    // Adding a file
    if (providedFiles) {
      const uploadCommands: any[] = [];
      req.files.forEach((file) => {
        const newID = v4();
        const fileKey = assembleUrl([projectID, newID]);

        // Prefer mime type from "mime" package, or fall back to multer's detected type, or finally default
        const contentType = mime.getType(file.originalname) || file.mimetype || "application/octet-stream";

        uploadCommands.push(
          new PutObjectCommand({
            Bucket: process.env.AWS_PROJECTFILES_BUCKET,
            Key: fileKey,
            Body: file.buffer,
            ContentDisposition: `inline; filename=${file.originalname}`,
            ContentType: contentType,
          })
        );

        filesToCreate.push({
          projectID,
          fileID: newID,
          name: _checkExistingNames(files, _removeExtension(file.originalname)),
          access: accessSetting,
          size: file.size,
          createdBy: req.user.decoded.uuid,
          downloadCount: 0,
          storageType: "file",
          parent,
          license: licenseObj,
          mimeType: file.mimetype,
          primaryAuthor: defaultPrimary
            ? (defaultPrimary as unknown as Schema.Types.ObjectId)
            : undefined,
          originalPublisher: req.body.originalPublisher,
          version: 1, // initial version
        });
      });
      await async.eachLimit(uploadCommands, 2, async (command) =>
        storageClient.send(command)
      );

      await ProjectFile.insertMany(filesToCreate);
    } else if (req.body.isURL && req.body.fileURL) {
      // Adding a file from URL
      await ProjectFile.create({
        projectID,
        fileID: v4(),
        name: "URL: " + req.body.fileURL.toString(),
        isURL: true,
        url: req.body.fileURL,
        size: 0,
        createdBy: req.user.decoded.uuid,
        storageType: "file",
        parent,
        access: accessSetting,
        license: licenseObj
          ? { ...licenseObj, sourceURL: req.body.fileURL }
          : {
            sourceURL: req.body.fileURL, // Set Source url as url
          },
        primaryAuthor: defaultPrimary,
        originalPublisher: req.body.originalPublisher,
      });
    } else if (!providedFiles && !req.body.isURL && !parsedVideoData) {
      // If not file, URL, or video data, return error
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err65,
      });
    }

    return res.send({
      err: false,
      msg: "Succesfully uploaded files!",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Creates a folder in a Project's file system.
 */
export async function addProjectFileFolder(
  req: ZodReqWithUser<z.infer<typeof addProjectFileFolderSchema>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    let parent = "";
    let accessSetting = "public" as ProjectFileInterfaceAccess; // default
    if (req.body.parentID && req.body.parentID !== "") {
      const foundParent = await ProjectFile.findOne({
        projectID,
        fileID: req.body.parentID,
      }).lean();

      if (!foundParent) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err64,
        });
      }
      parent = req.body.parentID;
      if (foundParent.access !== "mixed") {
        accessSetting = foundParent.access ?? "team"; // assume same setting as parent, else default to team
      }
    }

    await ProjectFile.create({
      projectID,
      fileID: v4(),
      name: req.body.name,
      size: 0,
      createdBy: req.user.decoded.uuid,
      storageType: "folder",
      parent,
      access: accessSetting,
    });

    return res.send({
      err: false,
      msg: "Succesfully uploaded files!",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a download URL for a single File linked to a Project.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectFileDownloadURL(
  req: ZodReqWithOptionalUser<z.infer<typeof getProjectFileDownloadURLSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const { shouldIncrement = true } = req.query;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const downloadURLs = await downloadProjectFiles(
      projectID,
      [fileID],
      undefined,
      req.user?.decoded?.uuid,
      shouldIncrement
    );
    if (
      downloadURLs === null ||
      !Array.isArray(downloadURLs) ||
      downloadURLs.length === 0
    ) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    return res.send({
      err: false,
      msg: "Successfully generated download link!",
      url: downloadURLs[0], // Only first index because we only requested one file
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getPermanentLink(
  req: ZodReqWithOptionalUser<z.infer<typeof getProjectFileDownloadURLSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (!req.user) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { orgID } = project;
    const organization = await Organization.findOne({ orgID }).lean();
    if (!organization) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    const projectFile = await ProjectFile.findOne({
      projectID,
      fileID,
    }).lean();

    if (!projectFile) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (projectFile.access !== "public") {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err29
      });
    }
    const domain = organization.domain;
    const permanentLink = `${domain}/permalink/${projectID}/${fileID}`;
    return res.status(200).send({
      error: false,
      url: permanentLink,
    });

  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function redirectPermanentLink(
  req: ZodReqWithOptionalUser<z.infer<typeof getProjectFileDownloadURLSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const { direct } = req.query;
    const project = await Project.findOne({ projectID }).lean();

    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!direct) {
      return res.redirect('https://commons.libretexts.org/download/' + projectID + '/' + fileID);
    }

    const downloadURLs = await downloadProjectFiles(
      projectID,
      [fileID],
      undefined,
      req.user?.decoded?.uuid,
      false
    );

    if (
      downloadURLs === null ||
      !Array.isArray(downloadURLs) ||
      downloadURLs.length === 0
    ) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    return res.redirect(downloadURLs[0]);
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function bulkDownloadProjectFiles(
  req: ZodReqWithOptionalUser<z.infer<typeof bulkDownloadProjectFilesSchema>>,
  res: Response
) {
  try {
    // 150mb limit 
    const MAX_COMBINED_SIZE = 157286400; // 150 * 1024 * 1024

    // @ts-ignore
    const rawIds = req.query.fileIDs as string;
    const projectID = req.params.projectID;
    const split = rawIds.split("&");
    const parsed = split.map((item: string) => item.split("=")[1]);
    const fileIDs = parsed.filter(
      (item) => item !== undefined && MiscValidators.isUUID(item)
    );

    if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err62,
      });
    }

    const foundFiles = await getProjectFiles(
      projectID,
      fileIDs,
      false,
      req.user?.decoded.uuid
    );
    if (!foundFiles || foundFiles.length === 0) {
      throw new Error("retrieveerror");
    }

    const storageClient = new S3Client({ region: process.env.AWS_PROJECTFILES_REGION || process.env.AWS_REGION });
    const downloadCommands: any[] = [];

    if (foundFiles.length === 0) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    let totalSize = 0;
    foundFiles.forEach((file) => {
      totalSize += file.size;
    });

    // If over limit, return error instead of email notification
    if (totalSize > MAX_COMBINED_SIZE) {
      return res.status(400).send({
        err: true,
        errMsg: "Too many files were requested. Please select fewer files.",
      });
    }

    // create zip file
    foundFiles.forEach(async (file) => {
      const fileKey = assembleUrl([projectID, file.fileID]);
      downloadCommands.push(
        new GetObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: fileKey,
        })
      );
    });

    const downloadRes = await Promise.all(
      downloadCommands.map((command) => storageClient.send(command))
    );

    const zipBuff = await parseAndZipS3Objects(downloadRes, foundFiles);
    if (!zipBuff) {
      throw new Error("ziperror");
    }

    //TODO: update download count
    const base64File = zipBuff.toString("base64");

    return res.send({
      err: false,
      msg: "Successfully requested download!",
      file: base64File,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves the contents of a Project (Files/Assets) Folder.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectFolderContents(
  req: ZodReqWithOptionalUser<z.infer<typeof getProjectFolderContentsSchema>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const folderID = req.params.folderID;
    const publicOnly = req.query.publicOnly;

    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    let foundUser;
    if (req.user?.decoded?.uuid) {
      foundUser = await User.findOne({ uuid: { $eq: req.user.decoded.uuid } }).lean();
    }

    if (
      !projectsAPI.checkProjectGeneralPermission(
        project,
        foundUser ?? undefined
      )
    ) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [files, path] = await getFolderContents(
      projectID,
      folderID ?? "",
      publicOnly ? true : req.user ? false : true,
      req.user?.decoded.uuid
    );
    if (!files) {
      // error encountered
      throw new Error("retrieveerror");
    }

    return res.send({
      err: false,
      msg: "Successfully retrieved files!",
      files,
      path,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a single Project File/Folder.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getProjectFile(
  req: ZodReqWithOptionalUser<z.infer<typeof getProjectFileSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    if (
      (!req.user?.decoded && project.visibility !== "public") ||
      (req.user?.decoded &&
        !projectsAPI.checkProjectGeneralPermission(project, req.user))
    ) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const files = await getProjectFiles(
      projectID,
      [fileID],
      req.user?.decoded.uuid ? undefined : true,
      req.user?.decoded.uuid
    );

    const file = files && files?.length > 0 ? files[0] : null;

    if (!file) {
      // error encountered
      return conductor404Err(res);
    }

    let videoStreamURL: string | null = null;
    if (file.isVideo && file.videoStorageID) {
      videoStreamURL = await generateVideoStreamURL(file.videoStorageID);
    }

    return res.send({
      err: false,
      msg: "Successfully retrieved file!",
      file,
      ...(videoStreamURL && { videoStreamURL }),
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates file metadata (including name) and/or replaces the file body.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateProjectFile(
  req: ZodReqWithFiles<ZodReqWithUser<z.infer<typeof updateProjectFileSchema>>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;

    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const {
      name,
      description,
      license,
      primaryAuthor,
      originalPublisher,
      tags,
      isURL,
      fileURL,
      overwriteName,
    } = req.body;

    const shouldOverwriteName = overwriteName === true; // TODO: Check this

    const allFiles =
      (await retrieveAllProjectFiles(
        projectID,
        false,
        req.user.decoded.uuid
      )) ?? [];

    const foundFiles = await getProjectFiles(
      projectID,
      [fileID],
      false,
      req.user.decoded.uuid
    );

    const file = foundFiles && foundFiles.length > 0 ? foundFiles[0] : null;
    if (!file) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    let processedName: string | undefined = "";

    if (!name) {
      // If replacing file and overwriteName is true, use the 'originalname' of replacement file
      if (req.files?.length > 0 && shouldOverwriteName) {
        processedName = req.files[0].originalname;
      } else {
        processedName = name; // fallback to undefined
      }
    } else {
      processedName = name;
    }

    if (processedName) {
      processedName = _checkExistingNames(
        allFiles,
        _removeExtension(processedName),
        true
      );
    }

    // update tags
    if (tags) {
      await upsertAssetTags(file, tags, "replace");
    }

    const updateObj = {} as RawProjectFileInterface;
    if (processedName) {
      updateObj.name = processedName;
    }
    if (typeof description === "string") {
      // account for unsetting
      updateObj.description = description;
    }
    if (license) {
      updateObj.license = license;
    }
    if (primaryAuthor) {
      const parsed = await _parseAndSaveAuthors([primaryAuthor]);
      updateObj.primaryAuthor = parsed[0] ?? undefined;
    }
    if (originalPublisher) {
      updateObj.originalPublisher = originalPublisher;
    }
    if (req.files && req.files[0]) {
      updateObj.version = file.version ? file.version + 1 : 1; // increment version
      if (req.files[0].mimetype) {
        updateObj.mimeType = req.files[0].mimetype; // update mime type
      }
      if (req.files[0].size) {
        updateObj.size = req.files[0].size; // update size
      }
    }
    // allow updating of URL if file is a URL
    if (
      Boolean(isURL) &&
      fileURL
      //&& obj.isURL && obj.url !== fileURL
    ) {
      updateObj.isURL = true;
      updateObj.url = fileURL;
      updateObj.storageType = "file";
      updateObj.size = 0;
      updateObj.downloadCount = undefined;
      updateObj.mimeType = undefined;
      updateObj.license = {
        ...file.license,
        sourceURL: fileURL,
      };
    }

    const storageClient = new S3Client({ region: process.env.AWS_PROJECTFILES_REGION || process.env.AWS_REGION });

    const isPhysicalFile =
      file.storageType === "file" && !file.isURL && !file.url && !file.isVideo;
    if (isPhysicalFile && processedName && processedName !== file.name) {
      // rename file
      const fileKey = `${projectID}/${fileID}`;
      const s3File = await storageClient.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: fileKey,
        })
      );

      let newContentType = "application/octet-stream";
      if (
        typeof s3File.ContentType === "string" &&
        s3File.ContentType !== newContentType
      ) {
        newContentType = s3File.ContentType;
      }

      await storageClient.send(
        new CopyObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          CopySource: `${process.env.AWS_PROJECTFILES_BUCKET}/${fileKey}`,
          Key: fileKey,
          ContentDisposition: `inline; filename=${processedName}`,
          ContentType: newContentType,
          MetadataDirective: "REPLACE",
        })
      );
    } else if (isPhysicalFile && req.files?.length > 0) {
      // replace file
      const file = req.files[0];
      const replaceKey = assembleUrl([projectID, fileID]);

      // Prefer mime type from "mime" package, or fall back to multer's detected type, or finally default
      const contentType = mime.getType(file.originalname) || file.mimetype || "application/octet-stream";

      await storageClient.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: replaceKey,
          Body: file.buffer,
          ContentDisposition: `inline; filename=${file.originalname}`,
          ContentType: contentType,
        })
      );
    }

    // Delete the old file if it has been replaced with a URL
    if (file.storageType === "file" && isURL && fileURL) {
      await storageClient.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: `${projectID}/${fileID}`,
        })
      );
    }

    await ProjectFile.findOneAndUpdate(
      {
        projectID,
        fileID,
      },
      updateObj
    );

    return res.send({
      err: false,
      msg: "Successfully updated file!",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function bulkUpdateProjectFiles(
  req: ZodReqWithUser<z.infer<typeof bulkUpdateProjectFilesSchema>>,
  res: Response
) {
  try {
    const { projectID } = req.params;
    const { fileIDs, tags, tagMode } = req.body;

    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const files = await getProjectFiles(
      projectID,
      fileIDs,
      false,
      req.user.decoded.uuid
    );

    if (!files || files.length === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    if (!tags || tags.length === 0) {
      return res.send({
        err: false,
        msg: "No tags provided, nothing to update.",
        files
      });
    }

    for (const file of files) {
      await upsertAssetTags(file, tags, tagMode);
    }

    return res.send({
      err: false,
      msg: "Successfully updated files!",
      files
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6
    });
  }
}

/**
 * Bulk-updates licensing, authorship, and publisher metadata on a set of Project Files.
 *
 * Only the fields provided in the request body are applied to each target file; blank/omitted
 * fields leave the existing value untouched (non-empty overwrite). When a folder is among the
 * selected fileIDs, its descendant files (at all nesting levels) are included; folders themselves
 * are skipped since they carry no license/author/publisher metadata.
 */
async function bulkUpdateProjectFileMetadata(
  req: ZodReqWithUser<z.infer<typeof bulkUpdateProjectFileMetadataSchema>>,
  res: Response
) {
  try {
    const { projectID } = req.params;
    const { fileIDs, license, primaryAuthor, originalPublisher } = req.body;

    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const hasAnyField =
      license !== undefined ||
      primaryAuthor !== undefined ||
      originalPublisher !== undefined;
    if (!hasAnyField) {
      return res.send({
        err: false,
        msg: "No fields provided, nothing to update.",
        updatedCount: 0,
      });
    }

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      throw new Error("retrieveerror");
    }

    // Resolve author fields once and reuse across every target file so we don't
    // create duplicate Author records or repeat lookups per file.
    const resolvedPrimary =
      primaryAuthor !== undefined
        ? (await _parseAndSaveAuthors([primaryAuthor]))[0] ?? undefined
        : undefined;

    // Collect target files, expanding any selected folder into its descendant files.
    const targets = new Map<
      string,
      RawProjectFileInterface | ProjectFileInterface
    >();
    const addFileTarget = (
      obj: RawProjectFileInterface | ProjectFileInterface
    ) => {
      if (obj.storageType === "file") targets.set(obj.fileID, obj);
    };
    const collectFolderFiles = (parentID: string) => {
      files.forEach((obj) => {
        if (obj.parent !== parentID) return;
        if (obj.storageType === "folder") {
          collectFolderFiles(obj.fileID);
        } else {
          addFileTarget(obj);
        }
      });
    };

    for (const id of fileIDs) {
      const found = files.find((obj) => obj.fileID === id);
      if (!found) continue;
      if (found.storageType === "folder") {
        collectFolderFiles(found.fileID);
      } else {
        addFileTarget(found);
      }
    }

    if (targets.size === 0) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    // Keep only defined, non-empty-string entries so we never overwrite an existing
    // value with a blank. Booleans (e.g. modifiedFromSource: false) are preserved.
    const pickProvided = <T extends Record<string, any>>(obj: T) =>
      Object.fromEntries(
        Object.entries(obj).filter(
          ([, v]) => v !== undefined && v !== ""
        )
      );

    const licensePatch = license ? pickProvided(license) : undefined;
    const publisherPatch = originalPublisher
      ? pickProvided(originalPublisher)
      : undefined;

    const updated = Array.from(targets.values()).map((file) => {
      const next: RawProjectFileInterface | ProjectFileInterface = { ...file };
      if (licensePatch) {
        next.license = { ...(file.license ?? {}), ...licensePatch };
      }
      if (publisherPatch) {
        next.originalPublisher = {
          ...(file.originalPublisher ?? {}),
          ...publisherPatch,
        };
      }
      if (primaryAuthor !== undefined) {
        next.primaryAuthor = resolvedPrimary;
      }
      return next;
    });

    const didUpdate = await updateProjectFilesUtil(projectID, updated);
    if (!didUpdate) {
      throw new Error("updatefail");
    }

    return res.send({
      err: false,
      msg: "Successfully updated files!",
      updatedCount: updated.length,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates the access/visibility setting of a Project File.
 *
 */
async function updateProjectFileAccess(
  req: ZodReqWithUser<z.infer<typeof updateProjectFileAccessSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const newAccess = req.body.newAccess;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      throw new Error("retrieveerror");
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    if (!foundObj) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    /* Update file and any children */
    const entriesToUpdate: (RawProjectFileInterface | ProjectFileInterface)[] =
      [];

    const findChildEntriesToUpdate = (parentID: string) => {
      files.forEach((obj) => {
        if (obj.parent === parentID) {
          entriesToUpdate.push(obj);
          if (obj.storageType === "folder") {
            findChildEntriesToUpdate(obj.fileID);
          }
        }
      });
    };

    entriesToUpdate.push(foundObj);
    if (foundObj.storageType === "folder") {
      findChildEntriesToUpdate(foundObj.fileID);
    }

    let updated = files.map((obj) => {
      const foundUpdater = entriesToUpdate.find(
        (upd) => upd.fileID === obj.fileID
      );
      if (foundUpdater) {
        return {
          ...obj,
          access: newAccess,
        };
      }
      return obj;
    });

    /* Recalculate access for all file system entries */
    // @ts-ignore
    updated = computeStructureAccessSettings(updated);

    /* Save updates */
    const projectUpdate = await updateProjectFilesUtil(projectID, updated);
    if (!projectUpdate) {
      throw new Error("updatefail");
    }

    return res.send({
      err: false,
      msg: "Successfully updated file access setting!",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Moves a Project File to a new parent.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function moveProjectFile(
  req: ZodReqWithUser<z.infer<typeof moveProjectFileSchema>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const newParentID = req.body.newParent;
    const fileID = req.params.fileID;
    let newParentIsRoot = false;
    if (newParentID === "") {
      newParentIsRoot = true;
    }

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      // error encountered
      throw new Error("retrieveerror");
    }

    const foundObj = files.find((obj) => obj.fileID === fileID);
    let foundNewParent = null;
    if (!newParentIsRoot) {
      foundNewParent = files.find((obj) => obj.fileID === newParentID);
    }
    if (!foundObj || (!newParentIsRoot && !foundNewParent)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    if (
      fileID === newParentID ||
      (!newParentIsRoot &&
        (!foundNewParent || foundNewParent.storageType === "file"))
    ) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err66,
      });
    }

    let updated = files.map((obj) => {
      if (obj.fileID === fileID) {
        return {
          ...obj,
          parent: newParentID,
        };
      }
      return obj;
    });

    /* Recalculate access for all file system entries */
    // @ts-ignore
    updated = computeStructureAccessSettings(updated);

    const projectUpdate = await updateProjectFilesUtil(projectID, updated);
    if (!projectUpdate) {
      throw new Error("updatefail");
    }

    return res.send({
      err: false,
      msg: "Successfully moved file!",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Recursively deletes Project Files or folders and their children from the database and underlying storage solution.
 *
 * @param projectID - Project identifier.
 * @param fileIDs - Project File (or folder) identifiers to delete.
 */
async function removeProjectFilesInternal(projectID: string, fileIDs: string[]) {
  if (
    !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
    !process.env.CLOUDFLARE_STREAM_API_TOKEN ||
    !process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  ) {
    throw new Error("Missing Cloudflare credentials");
  }

  const parentFiles = await ProjectFile.find({
    projectID,
    fileID: { $in: fileIDs },
  }).lean() as ProjectFileInterface[];

  async function resolveAllChildren(searchFileIDs: string[]): Promise<ProjectFileInterface[]> {
    const files = await ProjectFile.find({
      projectID,
      parent: { $in: searchFileIDs },
    }).lean() as ProjectFileInterface[];
    if (!files?.length) return [];

    const children = await resolveAllChildren(files.map((o) => o.fileID).filter((o) => o));
    return files.concat(children);
  }

  const objsToDelete = (await resolveAllChildren(fileIDs)).concat(parentFiles);
  const allFileIds = objsToDelete.map((o => o.fileID));

  const filesToDelete = objsToDelete
    .map((obj) => {
      if (obj.storageType === "file" && !obj.isURL && !obj.isVideo) {
        return {
          Key: `${projectID}/${obj.fileID}`,
        };
      }
      return null;
    })
    .filter((obj) => obj !== null);

  const videosToDelete = objsToDelete
    .map((obj) => {
      if (obj.storageType === "file" && obj.isVideo && obj.videoStorageID) {
        return obj.videoStorageID;
      }
      return null;
    })
    .filter((obj) => obj !== null);

  if (filesToDelete.length > 0) {
    const storageClient = new S3Client({ region: process.env.AWS_PROJECTFILES_REGION || process.env.AWS_REGION });
    const deleteRes = await storageClient.send(
      new DeleteObjectsCommand({
        Bucket: process.env.AWS_PROJECTFILES_BUCKET,
        Delete: {
          Objects: filesToDelete as { Key: string }[],
        },
      })
    );
    if (Array.isArray(deleteRes.Errors) && deleteRes.Errors.length > 0) {
      throw new Error('delete_errors_encountered');
    }
  }

  if (videosToDelete.length > 0) {
    const deletePromises = videosToDelete.map((videoID) => {
      const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${videoID}`;
      return axios.delete(ENDPOINT, {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      });
    });

    await Promise.all(deletePromises);
  }

  if (!fileIDs?.length) {
    return;
  }
  await ProjectFile.deleteMany({
    projectID,
    fileID: { $in: allFileIds },
  });
}

/**
 * Deletes a Project File and updates the Files list.
 * Multiple files can be deleted by specifying a folder identifier.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
async function removeProjectFile(
  req: ZodReqWithUser<z.infer<typeof removeProjectFileSchema>>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;
    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    await removeProjectFilesInternal(projectID, [fileID]);

    return res.send({
      err: false,
      msg: `Successfully deleted files!`,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: (e as Error)?.message === 'delete_errors_encountered'
        ? conductorErrors.err58
        : conductorErrors.err6,
    });
  }
}

async function getProjectFileCaptions(
  req: z.infer<typeof getProjectFileCaptionsSchema>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;

    const file = await ProjectFile.findOne({ projectID, fileID }).lean();
    if (!file || !file.videoStorageID) {
      return conductor404Err(res);
    }

    const captionsRes = await axios.get(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${file.videoStorageID}/captions`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        },
      }
    );

    if (captionsRes.status !== 200) {
      throw new Error("Failed to retrieve captions");
    }

    return res.send({
      err: false,
      captions: captionsRes.data.result ?? [],
    });
  } catch (e) {
    debugError(e);
    return conductor500Err(res);
  }
}

async function getProjectFileEmbedHTML(
  req: z.infer<typeof getProjectFileEmbedHTMLSchema>,
  res: Response
) {
  try {
    const { projectID, fileID } = req.params;

    const fileRes = await _getProjectFileEmbedHTML(projectID, fileID);

    if ('err' in fileRes) {
      if (fileRes.err === 'notfound') {
        return conductor404Err(res);
      }

      if (fileRes.err === 'unauthorized') {
        return res.status(401).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      } else {
        return conductor500Err(res);
      }
    }

    return res.send({
      err: false,
      media_id: fileRes.media_id,
      embed_url: fileRes.embed_url,
      embed_html: fileRes.embed_html,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _getProjectFileEmbedHTML(projectID: string, fileID: string): Promise<{ media_id: string, embed_url: string, embed_html: string } | { err: string }> {
  try {
    const file = await ProjectFile.findOne({ projectID, fileID }).lean();
    if (!file || !file.videoStorageID) {
      return { err: 'notfound' };
    }

    // Check if file is public
    if (file.access !== "public") {
      return { err: 'unauthorized' };
    }

    const ENDPOINT = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${file.videoStorageID}/iframe`;

    const HTML = `<iframe src="${ENDPOINT}" loading="lazy" style="border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen="true"></iframe>`;

    return {
      media_id: file.videoStorageID,
      embed_url: ENDPOINT,
      embed_html: HTML,
    }
  } catch (err) {
    debugError(err);
    return { err: 'internal' };
  }
}

async function updateProjectFileCaptions(
  req: ZodReqWithFiles<
    ZodReqWithUser<z.infer<typeof updateProjectFileCaptionsSchema>>
  >,
  res: Response
) {
  try {
    if (!req.files || req.files.length === 0) {
      return conductor400Err(res);
    }
    if (
      !req.body.language ||
      typeof req.body.language !== "string" ||
      req.body.language.length !== 2
    ) {
      return conductor400Err(res);
    }

    if (
      !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      !process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    ) {
      throw new Error("Missing Cloudflare credentials");
    }

    const captionFile = req.files[0];
    const { projectID, fileID } = req.params;

    const project = await Project.findOne({ projectID: { $eq: projectID } }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const file = await ProjectFile.findOne({ projectID: { $eq: projectID }, fileID: { $eq: fileID } }).lean();
    if (!file || !file.videoStorageID) {
      return conductor404Err(res);
    }

    // Check if user has permission to update file
    const canAccess = projectsAPI.checkProjectGeneralPermission(
      project,
      req.user
    );
    if (!canAccess) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    if (
      !captionFile ||
      !["text/vtt", "text/plain"].includes(captionFile.mimetype)
    ) {
      return conductor400Err(res);
    }

    const UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID
      }/stream/${file.videoStorageID
      }/captions/${req.body.language.toLowerCase()}`;

    const _formData = new FormData();
    const blob = new Blob([captionFile.buffer], {
      type: captionFile.mimetype,
    });
    _formData.append("file", blob);

    const uploadRes = await axios.put(UPLOAD_URL, _formData, {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
      },
    });

    if (uploadRes.status !== 200) {
      throw new Error("Failed to upload caption file");
    }

    return res.send({
      err: false,
      msg: "Successfully uploaded caption file!",
    });
  } catch (e: any) {
    debugError(e);
    return conductor500Err(res);
  }
}

/**
 * Returns all available public Project Files (in public Projects).
 */
async function getPublicProjectFiles(
  req: z.infer<typeof getPublicProjectFilesSchema>,
  res: Response
) {
  try {
    const page = parseInt(req.query.page.toString()) || 1;
    const limit = parseInt(req.query.limit.toString()) || 24;

    const aggRes = await ProjectFile.aggregate([
      {
        $match: {
          access: "public",
          storageType: "file",
        },
      },
      {
        $lookup: {
          from: "projects",
          let: {
            searchID: "$projectID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$projectID", "$$searchID"],
                },
                visibility: "public",
                orgID: process.env.ORG_ID,
              },
            },
            {
              $project: {
                title: 1,
                thumbnail: 1,
                description: 1,
                projectURL: 1,
              },
            },
          ],
          as: "projectInfo",
        },
      },
      {
        $set: {
          projectInfo: {
            $arrayElemAt: ["$projectInfo", 0],
          },
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "tags",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assettagkeys",
                localField: "key",
                foreignField: "_id",
                as: "key",
              },
            },
            {
              $set: {
                key: {
                  $arrayElemAt: ["$key", 0],
                },
              },
            },
          ],
          as: "tags",
        },
      },
      {
        $lookup: {
          from: "authors",
          localField: "primaryAuthor",
          foreignField: "_id",
          as: "primaryAuthor",
        },
      },
      {
        $set: {
          primaryAuthor: {
            $arrayElemAt: ["$primaryAuthor", 0],
          },
        },
      },
      {
        $match: {
          // Filter where project was not public or does not exist, so projectInfo wasn't set
          projectInfo: {
            $exists: true,
            $ne: [null, {}],
          },
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);

    const totalCount = aggRes.length;
    const offset = getRandomOffset(totalCount, limit);

    const upperBound = () => {
      if (offset + limit > totalCount) {
        return totalCount;
      }
      return offset + limit;
    };

    const paginatedRes = aggRes.slice(offset, upperBound());

    return res.send({
      err: false,
      files: paginatedRes || [],
      totalCount: totalCount || 0,
    });
  } catch (e) {
    debugError(e);
    return conductor500Err(res);
  }
}

/**
 * Encodes a set of key/value pairs as a tus `Upload-Metadata` header value.
 * Per the tus protocol, values are base64-encoded and pairs are comma-separated.
 *
 * @param entries - The metadata keys and their (plaintext) values.
 * @returns The encoded header value.
 */
function _encodeTusMetadata(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${Buffer.from(value).toString("base64")}`)
    .join(",");
}

/**
 * Creates a Cloudflare Stream direct-creator upload slot for an authenticated
 * project member. The caller uploads the video straight to the returned URL via
 * tus; this endpoint is the only point at which our Cloudflare credentials are
 * used, so all authorization and quota enforcement happens here.
 *
 * @see https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
 */
async function createProjectFileStreamUploadURL(
  req: ZodReqWithUser<z.infer<typeof createProjectFileStreamUploadURLSchema>>,
  res: Response
) {
  try {
    if (
      !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      !process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    ) {
      throw new Error("Missing Cloudflare credentials");
    }

    const { projectID } = req.params;
    const { name, size, durationSeconds } = req.body;

    const project = await Project.findOne({
      projectID: { $eq: projectID },
    }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    }).lean();
    if (!org) {
      throw new Error("Failed to resolve organization");
    }

    // Authoritative video length check. The client performs the same check for
    // UX, but it cannot be trusted — this is what actually caps billable minutes.
    const maxDurationSeconds = org.videoLengthLimit * 60;
    if (durationSeconds > maxDurationSeconds) {
      return res.status(400).send({
        err: true,
        errMsg: `Video length exceeds the organization's limit of ${org.videoLengthLimit} minutes.`,
      });
    }

    const now = new Date();
    const uploadExpiry = new Date(now.getTime() + 60 * 60 * 1000); // Cloudflare upload URL valid for 1 hour

    // Metadata is built here, never forwarded from the client, so maxDurationSeconds
    // cannot be inflated by the caller.
    const uploadMetadata = _encodeTusMetadata({
      name,
      maxDurationSeconds: maxDurationSeconds.toString(),
      expiry: uploadExpiry.toISOString(),
    });

    const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream?direct_user=true`;
    const cloudFlareRes = await axios.post(ENDPOINT, undefined, {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": size.toString(),
        "Upload-Metadata": uploadMetadata,
        "Upload-Creator": req.user.decoded.uuid,
      },
    });

    if (!cloudFlareRes || !cloudFlareRes.headers) {
      throw new Error("Failed to get Cloudflare response");
    }

    const streamMediaId = cloudFlareRes.headers["stream-media-id"];
    const destination = cloudFlareRes.headers["location"];
    if (!streamMediaId || !destination) {
      throw new Error("Failed to get Cloudflare uploadURL");
    }

    try {
      await VideoUploadGrant.create({
        videoID: streamMediaId,
        projectID,
        createdBy: req.user.decoded.uuid,
        maxDurationSeconds,
        uploadLength: size,
        claimed: false,
        createdAt: now,
        expiresAt: new Date(now.getTime() + VIDEO_UPLOAD_GRANT_RETENTION_MS),
      });
    } catch (dbErr) {
      // Best-effort cleanup: avoid leaving an untracked Cloudflare video billed indefinitely.
      const cleanupEndpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${streamMediaId}`;
      try {
        await axios.delete(cleanupEndpoint, {
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        });
      } catch (cleanupErr) {
        debugError(cleanupErr);
      }
      throw dbErr;
    }

    return res.send({
      err: false,
      uploadURL: destination,
      videoID: streamMediaId,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Deletes Cloudflare Stream videos whose upload slot was never claimed by a
 * Project File. Without this, an abandoned upload is billed indefinitely.
 * Candidates are re-checked against Project Files before deletion so a lost
 * claim write can never take a live video with it; those grants are marked
 * claimed instead. Intended to be invoked on a schedule via EventBridge.
 */
async function cleanupOrphanedStreamVideos(req: Request, res: Response) {
  try {
    if (
      !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_STREAM_API_TOKEN
    ) {
      throw new Error("Missing Cloudflare credentials");
    }

    const cutoff = new Date(Date.now() - VIDEO_UPLOAD_GRANT_TTL_MS);
    const orphaned = await VideoUploadGrant.find({
      claimed: false,
      createdAt: { $lt: cutoff },
    })
      .limit(ORPHANED_VIDEO_CLEANUP_BATCH_SIZE)
      .lean();

    if (orphaned.length === 0) {
      return res.send({ err: false, deleted: 0, failed: 0, reconciled: 0 });
    }

    // Defensive check: do not delete a Stream video if it's already referenced by a Project File.
    // Cloudflare deletion is irreversible, so the Project Files are the authority here, not the flag.
    const referenced = await ProjectFile.find(
      { isVideo: true, videoStorageID: { $in: orphaned.map((g) => g.videoID) } },
      { videoStorageID: 1 }
    ).lean();
    const referencedIDs = new Set(referenced.map((f) => f.videoStorageID));
    const toDelete = orphaned.filter((g) => !referencedIDs.has(g.videoID));

    if (referencedIDs.size > 0) {
      // Mark them claimed so the grants stop resurfacing on every sweep.
      const reconciledIDs = [...referencedIDs];
      await VideoUploadGrant.updateMany(
        { videoID: { $in: reconciledIDs } },
        { $set: { claimed: true } }
      );
      debugError(
        `Reconciled ${reconciledIDs.length} video upload grant(s) still referenced by a Project File: ${reconciledIDs.join(", ")}`
      );
    }

    if (toDelete.length === 0) {
      return res.send({
        err: false,
        deleted: 0,
        failed: 0,
        reconciled: referencedIDs.size,
      });
    }

    const results = await Promise.allSettled(
      toDelete.map(async (grant) => {
        const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/${grant.videoID}`;
        try {
          await axios.delete(ENDPOINT, {
            headers: {
              Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
            },
          });
        } catch (err: any) {
          // Already gone from Cloudflare — the grant record can still be cleared.
          if (err?.response?.status !== 404) throw err;
        }
        return grant.videoID;
      })
    );

    const deletedIDs = results
      .filter(
        (result): result is PromiseFulfilledResult<string> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    // Log failures rather than throwing so one bad id doesn't stall the sweep.
    results
      .filter((result) => result.status === "rejected")
      .forEach((result) =>
        debugError(
          `Failed to delete orphaned Cloudflare Stream video: ${
            (result as PromiseRejectedResult).reason
          }`
        )
      );

    if (deletedIDs.length > 0) {
      await VideoUploadGrant.deleteMany({ videoID: { $in: deletedIDs } });
    }

    return res.send({
      err: false,
      deleted: deletedIDs.length,
      failed: results.length - deletedIDs.length,
      reconciled: referencedIDs.size,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function _parseAndSaveAuthors(
  authors: z.infer<typeof addProjectFileSchema>["body"]["authors"]
): Promise<Schema.Types.ObjectId[]> {
  try {
    if (!authors) return [];

    if (!Array.isArray(authors)) {
      authors = [authors];
    }

    const _parsed: any[] = [];

    for (const author of authors) {
      // If author is a valid ObjectId add to parsed and continue
      if (typeof author === "string" && isObjectIdOrHexString(author)) {
        _parsed.push(new Types.ObjectId(author));
        continue;
      }

      if (!isAuthorObject(author)) {
        continue; // If not valid string or author object, skip
      }

      const found = await Author.findOne({
        firstName: {
          $regex: author.firstName,
          $options: "i",
        },
        lastName: {
          $regex: author.lastName,
          $options: "i",
        },
        ...(author.email && {
          email: {
            $regex: author.email,
            $options: "i",
          },
        }),
      });

      if (found) {
        _parsed.push(new Types.ObjectId(found._id));
        continue;
      }

      // If author is new author, it was likely sent with an arbitrary _id for UI, remove it before saving
      // @ts-ignore
      const { _id, ...authorData } = author;
      const newAuthor = await Author.create({
        ...authorData,
        orgID: process.env.ORG_ID,
      });
      _parsed.push(new Types.ObjectId(newAuthor._id));
    }

    const uniqueParsed = [...new Set(_parsed)];

    return uniqueParsed;
  } catch (err) {
    debugError(err);
    throw new Error("authorparseerror");
  }
}

const _removeExtension = (originalName: string) => {
  if (originalName.includes(".")) {
    return originalName.split(".").slice(0, -1).join(".");
  }
  return originalName;
};

const _checkExistingNames = (
  files: (RawProjectFileInterface | ProjectFileInterface)[],
  fileName: string,
  updating = false
) => {
  const existing = files.filter((obj) => obj.name === fileName.trim());
  if (existing && existing.length > 0) {
    if (updating && existing.length === 1) {
      return fileName; // If updating and only one file with the same name, don't change
    }

    const previousOccurences = existing.length;
    const splitName = fileName.split(".");
    const newName = `${splitName[0]} (${previousOccurences + 1})`;
    return newName;
  }
  return fileName;
};

export default {
  fileUploadHandler,
  addProjectFile,
  addProjectFileFolder,
  getProjectFileDownloadURL,
  bulkDownloadProjectFiles,
  getProjectFolderContents,
  getProjectFile,
  updateProjectFile,
  bulkUpdateProjectFiles,
  bulkUpdateProjectFileMetadata,
  updateProjectFileAccess,
  moveProjectFile,
  removeProjectFilesInternal,
  removeProjectFile,
  getProjectFileCaptions,
  getProjectFileEmbedHTML,
  _getProjectFileEmbedHTML,
  updateProjectFileCaptions,
  getPublicProjectFiles,
  createProjectFileStreamUploadURL,
  cleanupOrphanedStreamVideos,
  _parseAndSaveAuthors,
  getPermanentLink,
  redirectPermanentLink,
};
