import { NextFunction, Request, Response } from "express";
import conductorErrors from "../conductor-errors.js";
import ProjectFile, { ProjectFileInterface } from "../models/projectfile.js";
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
import { assembleUrl, getPaginationOffset } from "../util/helpers.js";
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
    let accessSetting = "public"; // default
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
    const fileEntries = [];

    if (providedFiles) {
      // Adding a file
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
        fileEntries.push({
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
    } else if (req.body.isURL && req.body.fileURL) {
      // Adding a file from URL
      fileEntries.push({
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
      // Adding a folder
      if (!req.body.folderName) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err65,
        });
      }
      fileEntries.push({
        fileID: v4(),
        name: req.body.folderName,
        size: 0,
        createdBy: req.user.decoded.uuid,
        storageType: "folder",
        parent,
        access: accessSetting,
      });
    }

    const updated = [...files, ...fileEntries];
    // @ts-ignore
    const fileUpdate = await updateProjectFilesUtil(projectID, updated);
    if (!fileUpdate) {
      throw new Error("updatefail");
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
    const project = await Project.findOne({ projectID }).lean();
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

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

    const shouldOverwriteName =
      overwriteName === undefined ? true : overwriteName;

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
    if (!foundObj) {
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
        const splitCurrName = foundObj.name?.split(".") ?? [];
        if (splitCurrName.length > 1) {
          const currExtension = splitCurrName[splitCurrName.length - 1];
          processedName = `${processedName}.${currExtension}`;
        }
      }
    }

    // update tags
    if (tags) {
      //@ts-ignore
      await upsertAssetTags(foundObj, tags);
    }

    const updated = files.map((obj) => {
      if (obj.fileID === foundObj.fileID) {
        const updateObj = { ...obj };
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
                acc.push(new Types.ObjectId(curr._id));
              } else {
                acc.push(curr);
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
          updateObj.version = obj.version ? obj.version + 1 : 1; // increment version
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
            ...obj.license,
            sourceURL: fileURL,
          };
        }
        return updateObj;
      }
      return obj;
    });

    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);

    const isPhysicalFile =
      foundObj.storageType === "file" && !foundObj.isURL && !foundObj.url;
    if (isPhysicalFile && processedName && processedName !== foundObj.name) {
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
    if (foundObj.storageType === "file" && isURL && fileURL) {
      await storageClient.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: `${projectID}/${fileID}`,
        })
      );
    }

    const projectUpdate = await updateProjectFilesUtil(projectID, updated);
    if (!projectUpdate) {
      throw new Error("updatefail");
    }

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
    if(children.length > 0) {
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
    const offset = getPaginationOffset(page, limit);

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
                from: "assettagframeworks",
                localField: "framework",
                foreignField: "_id",
                pipeline: [
                  // Go through each template in framework and lookup key
                  {
                    $unwind: {
                      path: "$templates",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $lookup: {
                      from: "assettagkeys",
                      let: {
                        key: "$templates.key",
                      },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $eq: ["$_id", "$$key"],
                            },
                          },
                        },
                      ],
                      as: "key",
                    },
                  },
                  {
                    $set: {
                      "templates.key": {
                        $arrayElemAt: ["$key", 0],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      uuid: {
                        $first: "$uuid",
                      },
                      name: {
                        $first: "$name",
                      },
                      description: {
                        $first: "$description",
                      },
                      enabled: {
                        $first: "$enabled",
                      },
                      orgID: {
                        $first: "$orgID",
                      },
                      templates: {
                        $push: "$templates",
                      },
                    },
                  },
                ],
                as: "framework",
              },
            },
            {
              $set: {
                framework: {
                  $arrayElemAt: ["$framework", 0],
                },
              },
            },
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
        $sort: {
          _id: -1,
        },
      },
      {
        $skip: offset,
      },
      {
        $limit: limit,
      },
    ]);

    const totalCount = await ProjectFile.countDocuments({
      access: "public",
    });

    return res.send({
      err: false,
      files: aggRes || [],
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
