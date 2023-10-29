import { z } from "zod";
import {
  CreateKBFeaturedPageValidator,
  CreateKBFeaturedVideoValidator,
  CreateKBPageValidator,
  DeleteKBFeaturedPageValidator,
  DeleteKBFeaturedVideoValidator,
  GetKBPageValidator,
  GetKBTreeValidator,
  UpdateKBPageValidator,
} from "./validators/kb.js";
import { Request, Response } from "express";
import { debugError } from "../debug.js";
import { conductor500Err } from "../util/errorutils.js";
import KBPage, { KBPageInterface } from "../models/kbpage.js";
import { v4 } from "uuid";
import User from "../models/user.js";
import DOMPurify from "isomorphic-dompurify";
import KBFeaturedPage from "../models/kbfeaturedpage.js";
import KBFeaturedVideo from "../models/kbfeaturedvideo.js";

async function getKBPage(
  req: z.infer<typeof GetKBPageValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;

    const kbPage = await KBPage.findOne({
      $and: [{ uuid }],
    })
      .populate({
        path: "lastEditedBy",
        model: "User",
        select: "firstName lastName avatar -_id",
      })
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
  req: z.infer<typeof GetKBTreeValidator>,
  res: Response
) {
  try {
    const { uuid } = req.params;

    const treeRes = await KBPage.aggregate([
      {
        $graphLookup: {
          from: "kbpages",
          startWith: "$parent",
          connectFromField: "parent",
          connectToField: "uuid",
          as: "parents",
        },
      },
    ]);

    if (!treeRes || !Array.isArray(treeRes)) {
      throw new Error("Failed to get tree");
    }

    const mapped = treeRes.map((p) => ({
      uuid: p.uuid,
      title: p.title,
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
  req: z.infer<typeof CreateKBPageValidator>,
  res: Response
) {
  try {
    const { title, description, body, status, parent, lastEditedBy } = req.body;

    const editor = await User.findOne({ uuid: lastEditedBy }).orFail();

    const kbPage = await KBPage.create({
      uuid: v4(),
      title,
      description,
      body: _sanitizeBodyContent(body),
      status,
      parent,
      lastEditedBy: editor._id,
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

async function updateKBPage(
  req: z.infer<typeof UpdateKBPageValidator>,
  res: Response
) {
  try {
    const { title, description, body, status, parent, lastEditedBy } = req.body;
    const { uuid } = req.params;

    const editor = await User.findOne({ uuid: lastEditedBy }).orFail();
    const kbPage = await KBPage.findOneAndUpdate(
      { uuid },
      {
        title,
        description,
        body: _sanitizeBodyContent(body),
        status,
        parent,
        lastEditedBy: editor._id,
      }
    ).orFail();

    return res.send({
      err: false,
      page: kbPage,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getKBFeaturedContent(req: Request, res: Response) {
  try {
    const pages = await KBFeaturedPage.find().lean();
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

    const kbPage = await KBPage.findOne({ uuid: page }).orFail();

    const newFeaturedPage = await KBFeaturedPage.create({
      uuid: v4(),
      page: kbPage.uuid,
    });

    return res.send({
      err: false,
      page: newFeaturedPage,
    });
  } catch (err) {
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

function _sanitizeBodyContent(content: string) {
  try {
    return DOMPurify.sanitize(content);
  } catch (err) {
    throw err;
  }
}

export default {
  getKBPage,
  getKBTree,
  createKBPage,
  updateKBPage,
  getKBFeaturedContent,
  createKBFeaturedPage,
  deleteKBFeaturedPage,
  createKBFeaturedVideo,
  deleteKBFeaturedVideo,
};
