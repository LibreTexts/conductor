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
  AssetTagFrameworkInterfaceWithCampusDefault,
} from "../models/assettagframework.js";
import { v4 } from "uuid";
import {
  AssetTagTemplateInterface,
  AssetTagTemplateValueTypeOptions,
} from "../models/assettagtemplate.js";
import AssetTagKey, { AssetTagKeyInterface } from "../models/assettagkey.js";
import { compareMongoIDs, isAssetTagKeyObject } from "../util/typeHelpers.js";
import { getRandomColor } from "../util/assettaggingutils.js";
import Organization from "../models/organization.js";
import { z } from "zod";
import * as AssetTagFrameworkValidators from "./validators/assettagframeworks.js";

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

    const frameworks = (await AssetTagFramework.find(matchObj, undefined, {
      sort: req.query.sort ? { [req.query.sort]: 1 } : { title: 1 },
    })
      .skip(offset)
      .limit(limit)
      .lean()) as AssetTagFrameworkInterfaceWithCampusDefault[];

    const org = await Organization.findOne({ orgID: process.env.ORG_ID })
      .orFail()
      .lean();
    const defaultFramework = org.defaultAssetTagFrameworkUUID;
    if (defaultFramework) {
      const found = frameworks.find((f) => f.uuid === defaultFramework);
      if (found) {
        found.isCampusDefault = true;
      }
    }

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
    //TODO: Use aggregate to populate key objects instead of doing it manually

    const framework = await AssetTagFramework.findOne({
      uuid: req.params.uuid,
      orgID: process.env.ORG_ID,
    })
      .lean()
      .orFail();

    const keys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      _id: { $in: framework.templates.map((t) => t.key) },
      isDeleted: { $ne: true },
    }).lean();

    const keyMap = new Map();
    for (const key of keys) {
      keyMap.set(key._id.toString(), key);
    }

    for (const template of framework.templates) {
      if (template.key) {
        template.key = keyMap.get(template.key.toString());
      }
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

async function getCampusDefaultFramework(
  req: z.infer<
    typeof AssetTagFrameworkValidators.getCampusDefaultFrameworkValidator
  >,
  res: Response
) {
  try {
    const { orgID } = req.params;

    const org = await Organization.findOne({ orgID }).orFail().lean();
    const defaultFramework = org.defaultAssetTagFrameworkUUID;
    if (!defaultFramework) {
      return res.send({
        err: false,
        framework: null,
      });
    }

    const framework = await AssetTagFramework.findOne({
      uuid: defaultFramework,
      orgID,
    }).lean();

    if (!framework) {
      return res.send({
        err: false,
        framework: null,
      });
    }

    const keys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      _id: { $in: framework.templates.map((t) => t.key) },
      isDeleted: { $ne: true },
    }).lean();

    const keyMap = new Map();
    for (const key of keys) {
      keyMap.set(key._id.toString(), key);
    }

    for (const template of framework.templates) {
      if (template.key) {
        template.key = keyMap.get(template.key.toString());
      }
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
    framework.templates = await _upsertTemplates(
      framework._id,
      req.body.templates
    );
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

async function _upsertTemplates(
  framework_mongo_id: string,
  templates: AssetTagTemplateInterface[]
): Promise<AssetTagTemplateInterface[]> {
  try {
    console.log(templates);
    const upsertedTemplates: AssetTagTemplateInterface[] = [];
    const existingKeyDocs = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      title: { $in: templates.map((t) => t.key) },
      isDeleted: { $ne: true },
      framework: framework_mongo_id,
    }).lean();

    function createNewKey(key: string) {
      return new AssetTagKey({
        title: key,
        hex: getRandomColor(),
        orgID: process.env.ORG_ID,
        framework: framework_mongo_id,
      });
    }

    const existingKeys = existingKeyDocs.map((k) => k._id);
    const newKeys: AssetTagKeyInterface[] = [];
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      if (isAssetTagKeyObject(t.key) && existingKeys.includes(t.key._id)) {
        upsertedTemplates.push({ ...t, key: t.key._id });
      } else if (typeof t.key === "string") {
        const existingKey = existingKeyDocs.find(
          (k) =>
            k.title === (t.key as unknown as string) &&
            compareMongoIDs(k.framework, framework_mongo_id)
        );
        if (existingKey) {
          upsertedTemplates.push({ ...t, key: existingKey._id });
        } else {
          const newKey = createNewKey(t.key);
          newKeys.push(newKey);
          upsertedTemplates.push({ ...t, key: newKey._id });
        }
      } else {
        const newKey = createNewKey(t.key as unknown as string);
        newKeys.push(newKey);
        upsertedTemplates.push({ ...t, key: newKey._id });
      }
    }

    await AssetTagKey.insertMany(newKeys);

    // Sort dropdown/multiselect options
    upsertedTemplates.forEach((t) => {
      if (t.options) {
        t.options.sort((a, b) =>
          a.localeCompare(b, "en", { ignorePunctuation: true })
        );
      }
    });

    return upsertedTemplates;
  } catch (err) {
    throw err;
  }
}

function validateAssetTagTemplate(tag: AssetTagTemplateInterface): boolean {
  if (!tag.key) return false;
  if (
    !tag.valueType ||
    !AssetTagTemplateValueTypeOptions.includes(tag.valueType)
  )
    return false;
  if (tag.valueType === "dropdown" && !tag.options) return false;
  if (tag.valueType === "multiselect" && !tag.options) return false;
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
  getCampusDefaultFramework,
  createFramework,
  updateFramework,
  validateAssetTagTemplate,
  validateAssetTagTemplateArray,
  validate,
};
