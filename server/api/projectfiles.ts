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
  PROJECT_FILES_S3_CLIENT_CONFIG,
  computeStructureAccessSettings,
  createZIPAndNotify,
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
  createCloudflareStreamURLSchema,
  videoDataSchema,
  updateProjectFileCaptionsSchema,
  getProjectFileCaptionsSchema,
  getProjectFileEmbedHTMLSchema,
} from "./validators/projectfiles.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import { ZodReqWithFiles } from "../types/Express";
import Author from "../models/author.js";
import { isAuthorObject } from "../util/typeHelpers.js";
import { Schema } from "mongoose";
import User from "../models/user.js";
import { generateVideoStreamURL } from "../util/videoutils.js";
import axios from "axios";

const filesStorage = multer.memoryStorage();
const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_SIZE = 100000000; // 100mb
const LIBRETEXTS_ALLOWED_ORIGINS = ["*.libretexts.org", "*.libretexts.net"];

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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    // Set the file license to the project default if it exists
    const licenseObj = project.defaultFileLicense || undefined;

    // Set default authors if present
    const defaultPrimary = project.defaultPrimaryAuthorID;
    const defaultSecondary = project.defaultSecondaryAuthorIDs;
    const defaultCorresponding = project.defaultCorrespondingAuthorID;

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
    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const providedFiles = Array.isArray(req.files) && req.files.length > 0;
    const filesToCreate: RawProjectFileInterface[] = [];

    const parsedVideoData =
      typeof req.body.videoData === "string"
        ? JSON.parse(req.body.videoData)
        : req.body.videoData;

    if (parsedVideoData && parsedVideoData.length) {
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
          authors: defaultSecondary
            ? (defaultSecondary as unknown as Schema.Types.ObjectId[])
            : undefined,
          correspondingAuthor: defaultCorresponding
            ? (defaultCorresponding as unknown as Schema.Types.ObjectId)
            : undefined,
          publisher: req.body.publisher,
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

      await Promise.all(cloudflareUpdates);

      await ProjectFile.insertMany(filesToCreate);
      filesToCreate.length = 0; // clear array for use by standard files below
    }

    // Adding a file
    if (providedFiles) {
      const uploadCommands: any[] = [];
      req.files.forEach((file) => {
        const newID = v4();
        const fileKey = assembleUrl([projectID, newID]);
        const contentType = file.mimetype || "application/octet-stream";
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
          authors: defaultSecondary
            ? (defaultSecondary as unknown as Schema.Types.ObjectId[])
            : undefined,
          correspondingAuthor: defaultCorresponding
            ? (defaultCorresponding as unknown as Schema.Types.ObjectId)
            : undefined,
          publisher: req.body.publisher,
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
        authors: defaultSecondary,
        publisher: req.body.publisher,
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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
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
    const project = await Project.findOne({ projectID }).lean();
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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
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
    const project = await Project.findOne({ projectID }).lean();
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

    return res.send({
      err: false,
      msg: "Successfully generated permanent link!",
      url: `https://commons.libretexts.org/permalink/${projectID}/${fileID}`,
      redirectUrl: downloadURLs[0] 
    });
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
    // 50mb limit
    const MAX_COMBINED_SIZE = 52428800;
    const { emailToNotify } = req.query;
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

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
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
    const isOverLimit = totalSize > MAX_COMBINED_SIZE;

    if (!isOverLimit) {
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
    } else {
      const fileKeys: string[] = [];
      foundFiles.forEach((file) => {
        const fileKey = assembleUrl([projectID, file.fileID]);
        fileKeys.push(fileKey);
      });

      createZIPAndNotify(fileKeys, foundFiles, emailToNotify); // Don't await, just run in background and return success

      res.setHeader("content-type", "application/json");
      return res.send({
        err: false,
        msg: "Successfully requested download!",
      });
    }
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
      foundUser = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
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

    const {
      name,
      description,
      license,
      primaryAuthor,
      authors,
      correspondingAuthor,
      publisher,
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
      await upsertAssetTags(file, tags);
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
    if (authors) {
      const parsedAuthors = await _parseAndSaveAuthors(authors);
      updateObj.authors = parsedAuthors;
    }
    if (correspondingAuthor) {
      const parsed = await _parseAndSaveAuthors([correspondingAuthor]);
      updateObj.correspondingAuthor = parsed[0] ?? undefined;
    }
    if (publisher) {
      updateObj.publisher = publisher;
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

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);

    const isPhysicalFile =
      file.storageType === "file" && !file.isURL && !file.url && !file.isVideo;
    if (isPhysicalFile && processedName && processedName !== file.name) {
      // rename file
      const fileKey = `${projectID}/${fileID}`;
      const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
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
      await storageClient.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: replaceKey,
          Body: file.buffer,
          ContentDisposition: `inline; filename=${file.originalname}`,
          ContentType: file.mimetype || "application/octet-stream",
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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
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
    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
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
    await removeProjectFilesInternal(req.params.projectID, [req.params.fileID]);
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

    if('err' in fileRes ) {
      if(fileRes.err === 'notfound') {
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

async function _getProjectFileEmbedHTML(projectID: string, fileID: string): Promise<{ media_id: string, embed_url: string, embed_html: string } | {err: string}>  {
  try {
    const file = await ProjectFile.findOne({ projectID, fileID }).lean();
    if (!file || !file.videoStorageID) {
      return {err: 'notfound'};
    }

    // Check if file is public
    if (file.access !== "public") {
      return {err: 'unauthorized'};
    }

    const ENDPOINT = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${file.videoStorageID}/iframe`;

    const HTML = `<iframe src="${ENDPOINT}" loading="lazy" style="border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen="true"></iframe>`;

    return {
      media_id: file.videoStorageID,
      embed_url: ENDPOINT,
      embed_html: HTML,
    }
  } catch (err){
    debugError(err);
    return {err: 'internal'};
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

    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    const file = await ProjectFile.findOne({ projectID, fileID }).lean();
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

    const UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/${
      process.env.CLOUDFLARE_STREAM_ACCOUNT_ID
    }/stream/${
      file.videoStorageID
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
          localField: "authors",
          foreignField: "_id",
          as: "authors",
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
        $lookup: {
          from: "authors",
          localField: "correspondingAuthor",
          foreignField: "_id",
          as: "correspondingAuthor",
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
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

async function createProjectFileStreamUploadURL(req: Request, res: Response) {
  try {
    // https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#step-1-create-your-own-api-endpoint-that-returns-an-upload-url
    if (
      !process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      !process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    ) {
      throw new Error("Missing Cloudflare credentials");
    }

    if (!req.headers["upload-length"] || !req.headers["upload-metadata"]) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    }

    const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream?direct_user=true`;
    const cloudFlareRes = await axios.post(ENDPOINT, undefined, {
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": req.headers["upload-length"],
        "Upload-Metadata": req.headers["upload-metadata"],
      },
    });

    if (!cloudFlareRes || !cloudFlareRes.headers) {
      throw new Error("Failed to get Cloudflare response");
    }

    const streamMediaId = cloudFlareRes.headers["stream-media-id"];

    const destination = cloudFlareRes.headers["location"];
    if (!destination) {
      throw new Error("Failed to get Cloudflare uploadURL");
    }

    // https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/#step-1-create-your-own-api-endpoint-that-returns-an-upload-url
    res.setHeader("Access-Control-Expose-Headers", [
      "Location",
      "Stream-Media-Id",
    ]);
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Location", destination);
    res.setHeader("Stream-Media-Id", streamMediaId);

    return res.send({
      err: false,
      destination,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createProjectFileStreamUploadURLOptions(
  req: Request,
  res: Response
) {
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", [
    "Location",
    "Stream-Media-Id",
  ]);
  return res.send({
    err: false,
  });
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
      const {_id, ...authorData} = author;
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
  createProjectFileStreamUploadURLOptions,
  _parseAndSaveAuthors,
  getPermanentLink,
  redirectPermanentLink
};
