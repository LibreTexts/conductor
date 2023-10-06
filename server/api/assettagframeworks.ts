import {
  TypedReqBody,
  TypedReqParams,
  TypedReqParamsAndBody,
  TypedReqQuery,
} from "../types";
import { Response } from "express";
import { param, body, query } from "express-validator";
import { getPaginationOffset } from "../util/helpers.js";
import { debugError } from "../debug.js";
import { conductor404Err, conductor500Err } from "../util/errorutils.js";
import AssetTagFramework, {
  AssetTagFrameworkInterface,
} from "../models/assettagframework.js";
import { v4 } from "uuid";
import {
  AssetTagTemplateInterface,
  AssetTagTemplateValueTypeOptions,
} from "../models/assettagtemplate.js";

async function getFrameworks(
  req: TypedReqQuery<{
    page?: number;
    limit?: number;
    sort?: string;
    query?: string;
  }>,
  res: Response
) {
  try {
    let page = 1;
    const limit = 25;
    if (
      req.query.page &&
      Number.isInteger(parseInt(req.query.page.toString()))
    ) {
      page = req.query.page;
    }

    const offset = getPaginationOffset(page, limit);

    let matchObj = {};
    matchObj = { orgID: process.env.ORG_ID };

    if (req.query.query) {
      const parsed = req.query.query.toString().toLowerCase().trim();
      matchObj = {
        $and: [
          { orgID: process.env.ORG_ID },
          {
            $text: {
              $search: parsed,
            },
          },
        ],
      };
    }

    const frameworks = await AssetTagFramework.find(matchObj, undefined, {
      sort: req.query.sort ? { [req.query.sort]: 1 } : { title: 1 },
    })
      .skip(offset)
      .limit(limit)
      .lean();

    if (!frameworks) {
      return conductor500Err(res);
    }

    const totalCount = await AssetTagFramework.countDocuments({
      orgID: process.env.ORG_ID,
    });

    return res.send({
      err: false,
      frameworks,
      totalCount,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getFramework(
  req: TypedReqParams<{ uuid: string }>,
  res: Response
) {
  try {
    const framework = await AssetTagFramework.findOne({
      uuid: req.params.uuid,
      orgID: process.env.ORG_ID,
    }).lean();

    if (!framework) {
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      framework,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createFramework(
  req: TypedReqBody<
    Omit<AssetTagFrameworkInterface, "_id" | "uuid" | "createdAt" | "updatedAt">
  >,
  res: Response
) {
  try {
    const framework = new AssetTagFramework({
      ...req.body,
      uuid: v4(),
      orgID: process.env.ORG_ID,
    });
    await framework.save();
    return res.send({
      err: false,
      framework,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateFramework(
  req: TypedReqParamsAndBody<{ uuid: string }, AssetTagFrameworkInterface>,
  res: Response
) {
  try {
    const framework = await AssetTagFramework.findOne({
      uuid: req.params.uuid,
      orgID: process.env.ORG_ID,
    });

    if (!framework) {
      return conductor404Err(res);
    }

    framework.name = req.body.name;
    framework.description = req.body.description;
    framework.templates = req.body.templates;
    framework.enabled = req.body.enabled;

    await framework.save();

    return res.send({
      err: false,
      framework,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function validateAssetTagTemplate(tag: AssetTagTemplateInterface): boolean {
  if (!tag.title) return false;
  if (
    !tag.valueType ||
    !AssetTagTemplateValueTypeOptions.includes(tag.valueType)
  )
    return false;
  if (tag.valueType === "dropdown" && !tag.options) return false;
  return true;
}

function validateAssetTagTemplateArray(
  tags: AssetTagTemplateInterface[]
): boolean {
  for (const tag of tags) {
    if (!validateAssetTagTemplate(tag)) return false;
  }
  return true;
}

function validate(method: string) {
  switch (method) {
    case "getFrameworks":
      return [
        query("page").optional().isInt({ min: 1 }),
        query("limit").optional().isInt({ min: 1, max: 100 }),
        query("sort")
          .optional({ checkFalsy: true })
          .isIn(["title", "valueType", "defaultValue", "isDeleted"]),
        query("query")
          .optional({ checkFalsy: true })
          .isString()
          .isLength({ min: 1, max: 100 }),
      ];
    case "getFramework":
      return [param("uuid").isUUID()];
    case "createFramework":
      return [
        body("name").isString().isLength({ min: 1, max: 255 }),
        body("description")
          .optional()
          .isString()
          .isLength({ min: 1, max: 255 }),
        body("templates").isArray().custom(validateAssetTagTemplateArray),
        body("enabled").isBoolean(),
      ];
    case "updateFramework":
      return [
        param("uuid").isUUID(),
        body("name").isString().isLength({ min: 1, max: 255 }),
        body("description")
          .optional()
          .isString()
          .isLength({ min: 1, max: 255 }),
        body("templates").isArray().custom(validateAssetTagTemplateArray),
        body("enabled").isBoolean(),
      ];
  }
}

export default {
  getFrameworks,
  getFramework,
  createFramework,
  updateFramework,
  validateAssetTagTemplate,
  validateAssetTagTemplateArray,
  validate,
};
