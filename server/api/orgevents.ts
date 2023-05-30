import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import OrgEvent, { OrgEventInterface } from "../models/orgevent.js";
import { Response } from "express";
import { param, body } from "express-validator";
import {
  TypedReqBody,
  TypedReqBodyWithUser,
  TypedReqParams,
  TypedReqParamsAndBody,
  TypedReqParamsAndBodyWithUser,
  TypedReqParamsAndQueryWithUser,
  TypedReqParamsWithUser,
  TypedReqQuery,
} from "../types";
import { parseISO, isBefore, isAfter } from "date-fns";
import b62 from "base62-random";
import { getPaginationOffset } from "../util/helpers.js";
import {
  conductor400Err,
  conductor404Err,
  conductor500Err,
  conductorErr,
} from "../util/errorutils.js";
import User, {
  SanitizedUserInterface,
  SanitizedUserSelectQuery,
  UserInterface,
} from "../models/user.js";
import OrgEventParticipant, {
  OrgEventParticipantInterface,
} from "../models/orgeventparticipant.js";
import authAPI from "./auth.js";
import mailAPI from "./mail.js";
import OrgEventFeeWaiver, {
  OrgEventFeeWaiverInterface,
} from "../models/orgeventfeewaiver.js";

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

    const foundOrgEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: searchID,
      canceled: { $ne: true },
    }).lean();

    if (!foundOrgEvent) {
      return conductor404Err(res);
    }

    // We don't populate the participants here for performance because we just need to know if any exist
    // There is a separate endpoint for getting participants
    const foundParticipants = await OrgEventParticipant.find({
      eventID: req.params.eventID,
    }).lean();

    const foundFeeWaivers = await OrgEventFeeWaiver.find({
      orgID: process.env.ORG_ID,
      eventID: searchID,
    }).lean();

    return res.send({
      err: false,
      orgEvent: {
        ...foundOrgEvent,
        participants: foundParticipants,
        feeWaivers: foundFeeWaivers,
      },
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOrgEventParticipants(
  req: TypedReqParamsAndQueryWithUser<
    { eventID?: string },
    { activePage?: number }
  >,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    let page = 1;
    let limit = 25;
    if (
      req.query.activePage &&
      Number.isInteger(parseInt(req.query.activePage.toString()))
    ) {
      page = req.query.activePage;
    }
    let offset = getPaginationOffset(page, limit);

    // Check authorization (only campus/super admins can create events)
    if (!req.user || !process.env.ORG_ID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const foundParticipants = await OrgEventParticipant.find({
      eventID: req.params.eventID,
    })
      .populate<{
        user: SanitizedUserInterface;
      }>({
        path: "user",
        model: "User",
        select: SanitizedUserSelectQuery,
      })
      .skip(offset)
      .limit(limit)
      .lean();

    if (!foundParticipants) {
      return conductor404Err(res);
    }

    const totalCount = await OrgEventParticipant.countDocuments({
      orgID: process.env.ORG_ID,
      eventID: req.params.eventID,
    });

    return res.send({
      err: false,
      participants: foundParticipants,
      totalCount: totalCount ?? 0,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createOrgEvent(
  req: TypedReqBodyWithUser<OrgEventInterface>,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can create events)
    if (!req.user || !process.env.ORG_ID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const regOpenDate = parseISO(req.body.regOpenDate.toString());
    const regCloseDate = parseISO(req.body.regCloseDate.toString());
    const startDate = parseISO(req.body.startDate.toString());
    const endDate = parseISO(req.body.endDate.toString());

    const orgEvent = new OrgEvent({
      orgID: process.env.ORG_ID,
      eventID: b62(10),
      title: req.body.title,
      regOpenDate,
      regCloseDate,
      startDate,
      endDate,
    });

    let newDoc = await orgEvent.save();
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
  req: TypedReqParamsAndBodyWithUser<{ eventID?: string }, OrgEventInterface>,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can create events)
    if (!req.user || !process.env.ORG_ID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const searchID = req.params.eventID?.toString();
    if (!searchID) {
      return conductor400Err(res);
    }

    // Strip eventID and cancellation flag from update obj
    const { eventID, canceled, ...updateBody } = req.body;

    // Parse dates
    const regOpenDate = parseISO(req.body.regOpenDate.toString());
    const regCloseDate = parseISO(req.body.regCloseDate.toString());
    const startDate = parseISO(req.body.startDate.toString());
    const endDate = parseISO(req.body.endDate.toString());

    const updateObj = {
      ...updateBody,
      regOpenDate,
      regCloseDate,
      startDate,
      endDate,
    };

    const orgToUpdate = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: req.body.eventID,
    }).lean();

    if (!orgToUpdate) {
      return conductor404Err(res);
    }

    if (!_runOrgEventPreflightChecks(orgToUpdate, "update")) {
      return conductor400Err(res);
    }

    // Save updates
    await OrgEvent.updateOne(
      {
        orgID: process.env.ORG_ID,
        eventID: req.body.eventID,
      },
      updateObj
    );

    return res.send({
      err: false,
      msg: "Event successfully updated.",
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function cancelOrgEvent(
  req: TypedReqParams<{ eventID: string }>,
  res: Response
) {
  try {
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

async function submitRegistration(
  req: TypedReqParamsAndBody<
    { eventID?: string },
    OrgEventParticipantInterface & { feeWaiver: string }
  >,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    const { user: userID, orgID, paymentStatus, formResponses } = req.body;

    const foundUser = await User.findOne({
      uuid: userID,
    }).lean();

    //Provided UUID not valid
    if (!foundUser) {
      return conductor400Err(res);
    }

    const orgEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: req.params.eventID,
    }).lean();

    if (!orgEvent) {
      return conductor404Err(res);
    }

    // Check if registration is available for this event
    if (!orgEvent.regOpenDate || !orgEvent.regCloseDate) {
      return conductor500Err(res);
    }
    if (!_runOrgEventPreflightChecks(orgEvent, "register")) {
      return conductor400Err(res);
    }

    // If fee waiver code was provided, check if it's valid
    if (req.body.feeWaiver) {
      if (!_validateFeeWaiver(req.body.feeWaiver, req.params.eventID)) {
        return conductor400Err(res);
      }
    }

    const participant = new OrgEventParticipant({
      user: foundUser._id,
      orgID,
      eventID: req.params.eventID,
      paymentStatus,
      formResponses,
    });

    const newDoc = await participant.save();
    if (!newDoc) {
      return conductor500Err(res);
    }

    mailAPI.sendOrgEventRegistrationConfirmation(foundUser, orgEvent);

    return res.send({
      err: false,
      msg: "Registration successfully submitted.",
      participant: newDoc,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function createFeeWaiver(
  req: TypedReqParamsAndBodyWithUser<
    { eventID?: string },
    Omit<OrgEventFeeWaiverInterface, "eventID">
  >,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can create fee waivers)
    if (!req.user || !process.env.ORG_ID || !req.params.eventID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    // Parse dates & check values
    const parsedExpiry = parseISO(req.body.expirationDate.toString());
    if (req.body.percentage < 1 || req.body.percentage > 100) {
      return conductor400Err(res);
    }

    // Check if event exists
    const orgEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: req.params.eventID,
    }).lean();

    if (!orgEvent) {
      return conductor404Err(res);
    }

    const newWaiver = new OrgEventFeeWaiver({
      ...req.body,
      eventID: orgEvent.eventID,
      orgID: process.env.ORG_ID,
      code: b62(10),
      expirationDate: parsedExpiry,
      active: true,
      createdBy: req.user.decoded.uuid,
    });

    const newDoc = await newWaiver.save();
    if (!newDoc) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      msg: "Fee waiver successfully created.",
      feeWaiver: newDoc,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function updateFeeWaiver(
  req: TypedReqParamsAndBodyWithUser<
    { eventID?: string },
    OrgEventFeeWaiverInterface
  >,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can create fee waivers)
    if (!req.user || !process.env.ORG_ID || !req.params.eventID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const foundWaiver = OrgEventFeeWaiver.findOne({
      orgID: process.env.ORG_ID,
      eventID: req.params.eventID,
      code: req.body.code,
    }).lean();

    if (!foundWaiver) {
      return conductor404Err(res);
    }
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Checks if the provided fee waiver code is valid and can be used.
 * @private
 * @param {string} code - Fee waiver code
 * @param {string} eventID - Event ID
 * @returns {boolean} - Returns true if fee waiver is valid and can be used, false otherwise
 */
async function _validateFeeWaiver(code: string, eventID: string) {
  try {
    const foundWaiver = await OrgEventFeeWaiver.findOne({
      orgID: process.env.ORG_ID,
      eventID,
      code,
    }).lean();

    if (!foundWaiver) return false;

    if (!foundWaiver.active) return false;

    if (isAfter(new Date(), foundWaiver.expirationDate)) return false;

    return true;
  } catch (err) {
    debugError(err);
    return false;
  }
}

/**
 * Checks if the OrgEvent is valid and can be updated or registered for.
 * @private
 * @param {OrgEventInterface} orgEvent - OrgEvent document
 * @param {string} action - The action being performed on the OrgEvent. Either "update" or "register"
 * @returns {boolean} - Returns true if preflight checks pass and action can be performed, false otherwise
 */
async function _runOrgEventPreflightChecks(
  orgEvent: OrgEventInterface,
  action: "update" | "register"
): Promise<boolean> {
  try {
    if (!orgEvent) return false;

    // Check if registration is open at time of request
    if (action === "register") {
      if (
        isBefore(new Date(), orgEvent.regOpenDate) ||
        isAfter(new Date(), orgEvent.regCloseDate)
      ) {
        return false;
      }
    }

    if (action === "update") {
      // Check if event is canceled
      if (orgEvent.canceled) {
        return false;
      }

      // Check if any participants have registered for event
      const participants = await OrgEventParticipant.find({
        orgID: process.env.ORG_ID,
        eventID: orgEvent.eventID,
      }).lean();

      if (participants.length > 0) {
        return false;
      }
    }

    return true;
  } catch (err) {
    debugError(err);
    return false;
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
        body("title", conductorErrors.err1).exists().isString().notEmpty(),
        body("regOpenDate", conductorErrors.err1).exists().isString(),
        body("regCloseDate", conductorErrors.err1).exists().isString(),
        body("startDate", conductorErrors.err1).exists().isString(),
        body("endDate", conductorErrors.err1).exists().isString(),
        body("regFee", conductorErrors)
          .optional({ checkFalsy: true })
          .isDecimal({ force_decimal: true }),
        body("headings", conductorErrors.err1).exists().isArray(),
        body("prompts", conductorErrors.err1).exists().isArray(),
        body("textBlocks", conductorErrors.err1).exists().isArray(),
        body("timeZone", conductorErrors.err1).exists().isObject(),
      ];
    case "cancelOrgEvent":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
      ];
    case "submitRegistration":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        body("user", conductorErrors.err1).exists().isUUID(),
        body("orgID", conductorErrors.err1)
          .exists()
          .isLength({ min: 2, max: 50 }),
        body("paymentStatus", conductorErrors.err1)
          .exists()
          .isString()
          .notEmpty(),
        body("formResponses", conductorErrors.err1).exists().isArray(),
        body("feeWaiver", conductorErrors.err1)
          .optional()
          .isString()
          .isLength({ min: 10, max: 10 }),
      ];
    case "createFeeWaiver":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        body("name", conductorErrors.err1).exists().isString().notEmpty(),
        body("percentage", conductorErrors.err1).exists().isNumeric(),
        body("expirationDate", conductorErrors.err1).exists().isString(),
      ];
  }
}

export default {
  getOrgEvents,
  getOrgEvent,
  getOrgEventParticipants,
  createOrgEvent,
  updateOrgEvent,
  cancelOrgEvent,
  submitRegistration,
  createFeeWaiver,
  validate,
};
