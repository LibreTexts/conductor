import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import OrgEvent, {
  OrgEventInterface,
  OrgEventParticipantInterface,
  OrgEventParticipantSchema,
} from "../models/orgevent.js";
import { Request, Response } from "express";
import { param, body } from "express-validator";
import {
  TypedReqBody,
  TypedReqParams,
  TypedReqParamsAndBody,
  TypedReqQuery,
} from "../types/Express.js";
import { parseISO } from "date-fns";
import b62 from "base62-random";
import { getPaginationOffset } from "../util/helpers.js";
import {
  conductor400Err,
  conductor404Err,
  conductor500Err,
  conductorErr,
} from "../util/errorutils.js";
import User, { SanitizedUserInterface, UserInterface } from "../models/user.js";

async function getOrgEvents(
  req: TypedReqQuery<{ activePage?: number }>,
  res: Response
) {
  try {
    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }

    let offset = getPaginationOffset(page, limit);
    let orgEvents = await OrgEvent.find({
      orgID: process.env.ORG_ID,
      canceled: { $ne: true },
    })
      .skip(offset)
      .limit(limit)
      .lean();

    if (!orgEvents) {
      throw new Error("OrgEvent query got invalid results");
    }

    const totalCount = await OrgEvent.countDocuments();
    return res.send({
      err: false,
      totalCount,
      orgEvents,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOrgEvent(
  req: TypedReqParams<{ eventID?: string }>,
  res: Response
) {
  try {
    const searchID = req.params.eventID?.toString();
    if (!searchID) {
      return conductor400Err(res);
    }

    let foundOrgEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: searchID,
      canceled: { $ne: true },
    })
      .populate<{
        participants: {
          user: SanitizedUserInterface;
        }[];
      }>({
        path: "participants",
        populate: {
          path: "user",
          model: "User",
          select:
            "-hash -salt -authSub -lastResetAttempt -resetToken -tokenExpiry -customAvatar -isSystem",
        },
      })
      .lean();

    if (!foundOrgEvent) {
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      orgEvent: foundOrgEvent,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createOrgEvent(
  req: TypedReqBody<OrgEventInterface>,
  res: Response
) {
  try {
    let regOpenDate = parseISO(req.body.regOpenDate.toString());
    let regCloseDate = parseISO(req.body.regCloseDate.toString());
    let startDate = parseISO(req.body.startDate.toString());
    let endDate = parseISO(req.body.endDate.toString());

    let testUser = await User.findOne({
      uuid: "ef262019-a38e-4fe7-8573-0cf3d5bc235f",
    })
      .orFail()
      .lean();

    let testParticpant = {
      user: testUser._id,
      paymentStatus: "paid",
      formResponses: [],
    };

    const orgEvent = new OrgEvent({
      orgID: process.env.ORG_ID,
      eventID: b62(10),
      title: req.body.title,
      regOpenDate,
      regCloseDate,
      startDate,
      endDate,
      participants: [testParticpant],
    });

    let newDoc = orgEvent.save();
    if (!newDoc) throw new Error();

    return res.send({
      err: false,
      msg: "Event successfully created.",
      orgEvent: newDoc,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateOrgEvent(
  req: TypedReqParamsAndBody<{ eventID?: string }, OrgEventInterface>,
  res: Response
) {
  try {
    const searchID = req.params.eventID?.toString();
    if (!searchID) {
      return conductor400Err(res);
    }

    let regOpenDate = parseISO(req.body.regOpenDate.toString());
    let regCloseDate = parseISO(req.body.regCloseDate.toString());
    let startDate = parseISO(req.body.startDate.toString());
    let endDate = parseISO(req.body.endDate.toString());

    // Strip eventID and cancellation flag from update obj
    const { eventID, canceled, ...updateBody } = req.body;

    const updateObj = {
      ...updateBody,
      regOpenDate,
      regCloseDate,
      startDate,
      endDate,
    };

    // Save updates
    const updated = await OrgEvent.findOneAndUpdate(
      {
        orgID: process.env.ORG_ID,
        eventID: req.body.eventID,
      },
      updateObj,
      {
        new: true,
        lean: true,
      }
    );

    if (!updated) {
      return conductor404Err(res);
    }

    return res.send({
      err: false,
      orgEvent: updated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function cancelOrgEvent(
  req: TypedReqParams<{ eventID?: string }>,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    const orgEvent = await OrgEvent.findOneAndUpdate(
      {
        orgID: process.env.ORG_ID,
        eventID: req.params.eventID,
      },
      { canceled: true },
      {
        new: true,
        lean: true,
      }
    );

    if (!orgEvent) {
      return conductor404Err(res);
    }

    return res.send({
      err: false,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Middleware(s) to verify that requests contain necessary and/or valid fields.
 */
function validate(method: string) {
  switch (method) {
    case "createOrgEvent":
    case "updateOrgEvent":
      return [
        body("title", conductorErrors.err1).exists().isString(),
        body("regOpenDate", conductorErrors.err1).exists().isString(),
        body("regCloseDate", conductorErrors.err1).exists().isString(),
        body("startDate", conductorErrors.err1).exists().isString(),
        body("endDate", conductorErrors.err1).exists().isString(),
        body("regFee", conductorErrors)
          .optional({ checkFalsy: true })
          .isDecimal({ force_decimal: true }),
      ];
  }
}

export default {
  getOrgEvents,
  getOrgEvent,
  createOrgEvent,
  updateOrgEvent,
  cancelOrgEvent,
  validate,
};
