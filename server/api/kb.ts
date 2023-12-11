import { z } from "zod";
import {
  AddKbImageValidator,
  CreateKBFeaturedPageValidator,
  CreateKBFeaturedVideoValidator,
  CreateKBPageValidator,
  DeleteKBFeaturedPageValidator,
  DeleteKBFeaturedVideoValidator,
  DeleteKBPageValidator,
  GetKBPageValidator,
  GetKBTreeValidator,
  SearchKBValidator,
  UpdateKBPageValidator,
} from "./validators/kb.js";
import { NextFunction, Request, Response } from "express";
import { debugError } from "../debug.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import KBPage, { KBPageInterface } from "../models/kbpage.js";
import authAPI from "./auth.js";
import { v4 } from "uuid";
import User from "../models/user.js";
import DOMPurify from "isomorphic-dompurify";
import KBFeaturedPage from "../models/kbfeaturedpage.js";
import KBFeaturedVideo from "../models/kbfeaturedvideo.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types/Express.js";
import multer from "multer";
import conductorErrors from "../conductor-errors.js";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { assembleUrl } from "../util/helpers.js";

export const KB_FILES_S3_CLIENT_CONFIG: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.AWS_KBFILES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.AWS_KBFILES_SECRET_KEY ?? "",
  },
  region: process.env.AWS_KBFILES_REGION ?? "",
};

async function getKBPage(
  req: z.infer<typeof GetKBPageValidator>,
  res: Response
) {
  try {
    const { uuid, slug } = req.params;

    let matchObj = {};
    if (uuid) {
      matchObj = { uuid };
    } else if (slug) {
      matchObj = { slug: slug.toLowerCase() };
    }

    const kbPage = await KBPage.findOne(matchObj)
      .populate("lastEditedBy")
      .lean()
      .orFail();

    return res.send({
      err: false,
      page: kbPage,
    });
  } catch (err: any) {
    debugError(err);
    if (
      typeof err === "object" &&
      err &&
      err.name === "DocumentNotFoundError"
    ) {
      return res.status(404).send({
        err: true,
        msg: "Page not found",
      });
    }
    return conductor500Err(res);
  }
}

async function getKBTree(
  req: ZodReqWithOptionalUser<z.infer<typeof GetKBTreeValidator>>,
  res: Response
) {
  try {
    const { uuid } = req.params;
    let isAuthorized = false;

    // If user is logged in, check if they have the libretexts superadmin role
    if (req.user) {
      const foundUser = await User.findOne({ uuid: req.user.decoded.uuid });
      if (
        foundUser &&
        authAPI.checkHasRole(foundUser, "libretexts", "superadmin")
      ) {
        isAuthorized = true;
      }
    }

    // Restrict the tree to only published pages if the user is not authorized
    let matchObj = {};
    let restriction = {};
    if (!isAuthorized) {
      matchObj = {
        status: "published",
      };
      restriction = {
        status: "published",
      };
    }

    const treeRes = await KBPage.aggregate([
      {
        $match: matchObj,
      },
      {
        $graphLookup: {
          from: "kbpages",
          startWith: "$parent",
          connectFromField: "parent",
          connectToField: "uuid",
          as: "parents",
          restrictSearchWithMatch: restriction,
        },
      },
    ]);

    if (!treeRes || !Array.isArray(treeRes)) {
      throw new Error("Failed to get tree");
    }

    const mapped = treeRes.map((p) => ({
      uuid: p.uuid,
      title: p.title,
      slug: p.slug,
      status: p.status,
      parent: p.parents && p.parents[0] ? p.parents[0].uuid : undefined,
    }));

    const fullTree = mapped
      .sort((a, b) => {
        if (!a.parent) {
          return -1;
        } else {
          return 1;
        }
      })
      .reduce((acc, cur) => {
        if (acc[cur.parent]) {
          // @ts-ignore
          acc[cur.parent].children.push(cur);
        } else {
          // @ts-ignore
          acc[cur.uuid] = {
            ...cur,
            children: [],
          };
        }
        return acc;
      }, {} as Record<string, KBPageInterface & { children: KBPageInterface[] }>);

    // sort the fullTree by titles, and then sort the children of each node by titles
    const sortedTree = Object.values(fullTree)
      .sort((a, b) => {
        return a.title.localeCompare(b.title);
      })
      .map((node) => {
        return {
          ...node,
          children: node.children.sort((a, b) => {
            return a.title.localeCompare(b.title);
          }),
        };
      });

    return res.send({
      err: false,
      tree: sortedTree,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createKBPage(
  req: ZodReqWithUser<z.infer<typeof CreateKBPageValidator>>,
  res: Response
) {
  try {
    const { title, description, body, slug, status, parent } =
      req.body;
    const { decoded } = req.user;

    const editor = await User.findOne({ uuid: decoded.uuid }).orFail();

    const safeSlug = _generatePageSlug(title, slug);

    const kbPage = await KBPage.create({
      uuid: v4(),
      title,
      description,
      body: _sanitizeBodyContent(body),
      status,
      slug: safeSlug,
      parent,
      lastEditedByUUID: editor.uuid,
    });

    return res.send({
      err: false,
      page: kbPage,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function imageUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const config = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fileSize: 100000000,
    },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image")) {
        return cb(new Error("notimagefile"));
      }
      return cb(null, true);
    },
  }).single("file");
  return config(req, res, (err) => {
    if (err) {
      let errMsg = conductorErrors.err53;
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        errMsg = conductorErrors.err60;
      }
      if (err.message === "notimagefile") {
        errMsg = conductorErrors.err55;
      }
      return res.status(400).send({
        err: true,
        errMsg,
      });
    }
    return next();
  });
}

async function addKBImage(
  req: z.infer<typeof AddKbImageValidator> & { file: Express.Multer.File },
  res: Response
) {
  try {
    const pageID = req.params.uuid;
    const page = await KBPage.findOne({ uuid: pageID }).orFail();

    if (
      !KB_FILES_S3_CLIENT_CONFIG ||
      !process.env.AWS_KBFILES_BUCKET ||
      !process.env.AWS_KBFILES_DOMAIN
    ) {
      throw new Error("Missing file storage config");
    }

    const storageClient = new S3Client(KB_FILES_S3_CLIENT_CONFIG);
    const imageFile = req.file;

    if (!imageFile) {
      throw new Error("No image file provided");
    }

    const fileUUID = v4();
    const fileKey = `${page.uuid}/${fileUUID}`;

    const uploadResult = await storageClient.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_KBFILES_BUCKET,
        Key: fileKey,
        Body: imageFile.buffer,
        ContentDisposition: `inline; filename="${fileUUID}"`,
        ContentType: imageFile.mimetype ?? "application/octet-stream",
      })
    );

    if (uploadResult.$metadata.httpStatusCode !== 200) {
      throw new Error("Failed to upload image");
    }

    const url = assembleUrl([
      "https://",
      process.env.AWS_KBFILES_DOMAIN,
      fileKey,
    ]);

    // Add the image URL to the page & save
    page.imgURLs = page.imgURLs ? [...page.imgURLs, url] : [url];
    await page.save();

    return res.send({
      err: false,
      url,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateKBPage(
  req: ZodReqWithUser<z.infer<typeof UpdateKBPageValidator>>,
  res: Response
) {
  try {
    const { title, description, body, status, slug, parent } =
      req.body; // Image URLs should not be updated directly
    const { uuid } = req.params;
    const { decoded } = req.user;

    const safeURL = _generatePageSlug(title, slug);

    const editor = await User.findOne({ uuid: decoded.uuid }).orFail();
    const kbPage = await KBPage.findOne({ uuid }).orFail();

    kbPage.title = title;
    kbPage.description = description;
    kbPage.body = _sanitizeBodyContent(body);
    kbPage.slug = safeURL;
    kbPage.status = status;
    kbPage.parent = parent;
    kbPage.lastEditedByUUID = editor.uuid;

    const urlsToDelete = _checkForDeletedImages(body, kbPage.imgURLs);
    if (urlsToDelete.length > 0) {
      const deleteImagesResult = await _deleteKBImagesFromStorage(urlsToDelete);
      if (!deleteImagesResult) {
        debugError("Failed to delete one or more images from storage"); // Silently fail, but log
      } else {
        // Remove the deleted images from the page
        kbPage.imgURLs = kbPage.imgURLs?.filter(
          (url) => !urlsToDelete.includes(url)
        );
      }
    }

    await kbPage.save();

    return res.send({
      err: false,
      page: kbPage,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteKBPage(
  req: z.infer<typeof DeleteKBPageValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;

    const page = await KBPage.findOne({ uuid }).orFail();
    if (page.imgURLs && page.imgURLs.length > 0) {
      const deleteImagesResult = await _deleteKBImagesFromStorage(page.imgURLs);
      if (!deleteImagesResult) {
        debugError("Failed to delete one or more images from storage"); // Silently fail, but log
      }
    }

    await KBPage.findOneAndDelete({ uuid }).orFail();

    return res.send({
      err: false,
      page,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function searchKB(req: z.infer<typeof SearchKBValidator>, res: Response) {
  try {
    const { query } = req.query;

    // Use MongoDB Atlas Search to search for pages
    const pages = await KBPage.aggregate([
      {
        $search: {
          text: {
            query,
            path: ["title", "description", "body"],
            fuzzy: {
              maxEdits: 2,
            },
          },
          highlight: {
            path: ["title", "description", "body"],
          },
        },
      },
      {
        $project: {
          uuid: 1,
          title: 1,
          description: 1,
          slug: 1,
          status: 1,
          parent: 1,
          highlight: { $meta: "searchHighlights" },
        },
      },
    ]).limit(10);

    return res.send({
      err: false,
      pages,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getKBFeaturedContent(req: Request, res: Response) {
  try {
    const pages = await KBFeaturedPage.aggregate([
      {
        $lookup: {
          from: "kbpages",
          localField: "page",
          foreignField: "uuid",
          as: "page",
        },
      },
      {
        $unwind: "$page",
      },
      {
        $project: {
          uuid: 1,
          page: {
            uuid: "$page.uuid",
            title: "$page.title",
            description: "$page.description",
            slug: "$page.slug",
            status: "$page.status",
            parent: "$page.parent",
          },
        },
      },
    ]);

    const videos = await KBFeaturedVideo.find().lean();

    return res.send({
      err: false,
      pages: pages ?? [],
      videos: videos ?? [],
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createKBFeaturedPage(
  req: z.infer<typeof CreateKBFeaturedPageValidator>,
  res: Response
) {
  try {
    const { page } = req.body;

    const kbPage = await KBPage.findOne({ uuid: page, status: 'published' }).orFail();

    const newFeaturedPage = await KBFeaturedPage.create({
      uuid: v4(),
      page: kbPage.uuid,
    });

    return res.send({
      err: false,
      page: newFeaturedPage,
    });
  } catch (err: any) {
    if(err.name === 'DocumentNotFoundError') {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteKBFeaturedPage(
  req: z.infer<typeof DeleteKBFeaturedPageValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;

    await KBFeaturedPage.findOneAndDelete({ uuid }).orFail();

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createKBFeaturedVideo(
  req: z.infer<typeof CreateKBFeaturedVideoValidator>,
  res: Response
) {
  try {
    const { title, url } = req.body;

    const newFeaturedVideo = await KBFeaturedVideo.create({
      uuid: v4(),
      title,
      url,
    });

    return res.send({
      err: false,
      video: newFeaturedVideo,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function deleteKBFeaturedVideo(
  req: z.infer<typeof DeleteKBFeaturedVideoValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;

    await KBFeaturedVideo.findOneAndDelete({ uuid }).orFail();

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _checkForDeletedImages(newBody: string, oldURLs?: string[]) {
  try {
    if (!oldURLs || oldURLs.length === 0) {
      return [];
    }
    // if url is not in newBody, delete it
    const urlsToDelete = [];
    for (const url of oldURLs) {
      if (!newBody.includes(url)) {
        urlsToDelete.push(url);
      }
    }
    return urlsToDelete;
  } catch (err) {
    throw err;
  }
}

async function _deleteKBImagesFromStorage(urls: string[]): Promise<boolean> {
  try {
    if (
      !KB_FILES_S3_CLIENT_CONFIG ||
      !process.env.AWS_KBFILES_BUCKET ||
      !process.env.AWS_KBFILES_DOMAIN
    ) {
      throw new Error("Missing file storage config");
    }
    const storageClient = new S3Client(KB_FILES_S3_CLIENT_CONFIG);
    const promises = [];

    for (const url of urls) {
      //split url on '/' and get last two elements
      const urlSplit = url.split("/");
      const fileKey = `${urlSplit[urlSplit.length - 2]}/${
        urlSplit[urlSplit.length - 1]
      }`;
      if (!fileKey) {
        throw new Error("invalidurl");
      }

      promises.push(
        storageClient.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_KBFILES_BUCKET,
            Key: fileKey,
          })
        )
      );
    }

    await Promise.all(promises);

    return true;
  } catch (err: any) {
    // if the image doesn't exist, no-op, return false
    if (err.message === "invalidurl" || err.code === "NoSuchKey") {
      return false;
    } else {
      throw err;
    }
  }
}

function _sanitizeBodyContent(content: string) {
  try {
    return DOMPurify.sanitize(content, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "srcdoc",
      ],
    });
  } catch (err) {
    throw err;
  }
}

function _generatePageSlug(title: string, userInput?: string) {
  let val = '';
  if (userInput && userInput.length > 0) {
    val = userInput;
  } else {
    val = title
  }
  const trimmed = val.trim(); // remove leading and trailing whitespace
  const noQuotations = trimmed.replace(/['"]+/g, ""); // remove quotations
  const noSpecialChars = noQuotations.replace(/[!@#$%^&*]/g, ""); // remove special characters
  const spacesReplaced = noSpecialChars.replace(/\s/g, "-"); // replace spaces with hyphens
  return encodeURIComponent(spacesReplaced.toLowerCase()); // encode the slug
}

export default {
  getKBPage,
  getKBTree,
  createKBPage,
  imageUploadHandler,
  addKBImage,
  updateKBPage,
  deleteKBPage,
  searchKB,
  getKBFeaturedContent,
  createKBFeaturedPage,
  deleteKBFeaturedPage,
  createKBFeaturedVideo,
  deleteKBFeaturedVideo,
};
