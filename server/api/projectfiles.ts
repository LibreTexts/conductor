import { NextFunction, Request, Response } from "express";
import conductorErrors from "../conductor-errors.js";
import ProjectFile, {
  ProjectFileInterface,
  ProjectFileInterfaceAccess,
  RawProjectFileInterface,
} from "../models/projectfile.js";
import multer from "multer";
import Project from "../models/project.js";
import {
  PROJECT_FILES_S3_CLIENT_CONFIG,
  computeStructureAccessSettings,
  createZIPAndNotify,
  downloadProjectFiles,
  parseAndZipS3Objects,
  retrieveAllProjectFiles,
  retrieveProjectFiles,
  retrieveSingleProjectFile,
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
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
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
} from "./validators/projectfiles.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types";
import { ZodReqWithFiles } from "../types/Express";

const filesStorage = multer.memoryStorage();

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
      files: 10,
      fileSize: 100000000,
    },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.includes("/")) {
        // @ts-ignore
        return cb(new Error("filenameslash"), false);
      }
      return cb(null, true);
    },
  }).array("files", req.method === "POST" ? 10 : 1);
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

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      throw new Error("retrieveerror");
    }

    let parent = "";
    let accessSetting = "public" as ProjectFileInterfaceAccess; // default
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
    let parsedAuthors: any[] = [];
    if (req.body.authors) {
      if (Array.isArray(req.body.authors)) {
        parsedAuthors = req.body.authors;
      } else {
        parsedAuthors = [req.body.authors];
      }

      const _parsed: any[] = [];
      parsedAuthors.forEach((author) => {
        if (typeof author === "string" && isObjectIdOrHexString(author)) {
          _parsed.push(new Types.ObjectId(author));
        } else {
          _parsed.push(author);
        }
      });

      parsedAuthors = _parsed;
    }

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const providedFiles = Array.isArray(req.files) && req.files.length > 0;
    const filesToCreate: RawProjectFileInterface[] = [];

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
          name: file.originalname,
          access: accessSetting,
          size: file.size,
          createdBy: req.user.decoded.uuid,
          downloadCount: 0,
          storageType: "file",
          parent,
          license: licenseObj,
          mimeType: file.mimetype,
          authors: parsedAuthors,
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
        authors: parsedAuthors,
        publisher: req.body.publisher,
      });
    } else {
      // If not file, and not URL, then it's an invalid request
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

    const files = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user.decoded.uuid
    );
    if (!files) {
      throw new Error("retrieveerror");
    }

    let parent = "";
    let accessSetting = "public" as ProjectFileInterfaceAccess; // default
    if (req.body.parentID && req.body.parentID !== "") {
      const foundParent = files.find((obj) => obj.fileID === req.body.parentID);
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
      req.user?.decoded.uuid,
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

    const allFiles = await retrieveAllProjectFiles(
      projectID,
      false,
      req.user?.decoded.uuid
    );
    if (!allFiles) {
      throw new Error("retrieveerror");
    }

    const foundFiles = allFiles.filter((file) => fileIDs.includes(file.fileID));

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
  req: ZodReqWithUser<z.infer<typeof getProjectFolderContentsSchema>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const folderID = req.params.folderID;
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return conductor404Err(res);
    }

    if (!projectsAPI.checkProjectGeneralPermission(project, req.user)) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [files, path] = await retrieveProjectFiles(
      projectID,
      folderID,
      undefined,
      req.user.decoded.uuid
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
      !req.user?.decoded ||
      !projectsAPI.checkProjectGeneralPermission(project, req.user)
    ) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const [file, path] = await retrieveSingleProjectFile(
      projectID,
      fileID,
      undefined,
      req.user.decoded.uuid
    );
    if (!file) {
      // error encountered
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      msg: "Successfully retrieved files!",
      file,
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
      authors,
      publisher,
      tags,
      isURL,
      fileURL,
      overwriteName,
    } = req.body;

    const shouldOverwriteName = overwriteName === true; // TODO: Check this

    const [file] = await retrieveSingleProjectFile(
      projectID,
      fileID,
      false,
      req.user.decoded.uuid
    );

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
      // Ensure file extension remains in new name
      if (!processedName.includes(".")) {
        const splitCurrName = file.name?.split(".") ?? [];
        if (splitCurrName.length > 1) {
          const currExtension = splitCurrName[splitCurrName.length - 1];
          processedName = `${processedName}.${currExtension}`;
        }
      }
    }

    // update tags
    if (tags) {
      //@ts-ignore
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
    if (authors) {
      const parseAuthors = (authorsData: any[]) => {
        if (!Array.isArray(authorsData)) return [];
        const reduced = authorsData.reduce((acc, curr) => {
          if (curr._id) {
            acc.push(new Types.ObjectId(curr._id)); //If object already has an _id, ensure it's an ObjectId and push
          } else if (typeof curr === "string" && isObjectIdOrHexString(curr)) {
            acc.push(new Types.ObjectId(curr)); // If it's a string and a valid ObjectId format, convert to ObjectId and push
          } else {
            acc.push(curr); // Otherwise, just push the original value (which should be object with basic author info like name, etc.)
          }
          return acc;
        }, []);
        return reduced;
      };

      const parsed = parseAuthors(authors);

      updateObj.authors = parsed;
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
      file.storageType === "file" && !file.isURL && !file.url;
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
    const entriesToUpdate: ProjectFileInterface[] = [];

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
 * Deletes a Project File in S3 and updates the Files
 * list. Multiple files  can be deleted by specifying a folder identifier.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
async function removeProjectFile(
  req: ZodReqWithUser<z.infer<typeof removeProjectFileSchema>>,
  res: Response
) {
  try {
    const projectID = req.params.projectID;
    const fileID = req.params.fileID;

    const found = await ProjectFile.findOne({
      projectID,
      fileID,
    })
      .orFail()
      .lean();

    const objsToDelete = [];
    const children = await ProjectFile.find({
      projectID,
      parent: fileID,
    }).lean();

    objsToDelete.push(found);
    if (children.length > 0) {
      objsToDelete.push(...children);
    }

    const objectIDs = objsToDelete.map((obj) => obj.fileID);

    const filesToDelete = objsToDelete
      .map((obj) => {
        if (obj.storageType === "file") {
          return {
            Key: `${projectID}/${obj.fileID}`,
          };
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
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err58,
        });
      }
    }

    const deleteRes = await ProjectFile.deleteMany({
      projectID,
      fileID: { $in: objectIDs },
    });

    // /* Recalculate access for all file system entries */
    // // @ts-ignore
    // updated = computeStructureAccessSettings(updated);

    // // @ts-ignore
    // const projectUpdate = await updateProjectFiles(projectID, updated);
    // if (!projectUpdate) {
    //   throw new Error("updatefail");
    // }

    return res.send({
      err: false,
      msg: `Successfully deleted files!`,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
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
    const offset = getRandomOffset(totalCount);

    const paginatedRes = aggRes.slice(offset, offset + limit);

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
  removeProjectFile,
  getPublicProjectFiles,
};
