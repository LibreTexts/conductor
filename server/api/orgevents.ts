import conductorErrors from "../conductor-errors.js";
import { debug, debugError } from "../debug.js";
import OrgEvent, { OrgEventInterface } from "../models/orgevent.js";
import { Response } from "express";
import Stripe from "stripe";
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

    // We don't populate particpants or fee waivers here because registrants will be using this endpoint
    return res.send({
      err: false,
      orgEvent: foundOrgEvent,
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
      participants: foundParticipants || [],
      totalCount: totalCount ?? 0,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getOrgEventFeeWaivers(
  req: TypedReqParamsWithUser<{ eventID?: string }>,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    // Check authorization (only campus/super admins can list fee waivers)
    if (!req.user || !process.env.ORG_ID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const foundFeeWaivers = await OrgEventFeeWaiver.find({
      eventID: req.params.eventID,
    }).lean();

    return res.send({
      err: false,
      feeWaivers: foundFeeWaivers || [],
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
      timeZone: req.body.timeZone,
      regFee: req.body.regFee,
      collectShipping: req.body.collectShipping ?? false,
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
  req: TypedReqParamsWithUser<{ eventID: string }>,
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

    const { user: userID, orgID, formResponses } = req.body;
    let stripeKey: string | null = null;
    let shouldSendConfirmation = true;

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

    // Check if shipping address was provided when required
    if (
      orgEvent.collectShipping &&
      !validateParticipantShippingAddress(req.body.shippingAddress)
    ) {
      return conductor400Err(res);
    }

    // If fee waiver code was provided, check if it's valid
    let feeWaiver: OrgEventFeeWaiverInterface | null = null;
    if (req.body.feeWaiver) {
      feeWaiver = await _validateFeeWaiver(
        req.body.feeWaiver,
        req.params.eventID
      );
      if (!feeWaiver) {
        return conductorErr(res, 400, "err81");
      }
    }

    let shouldCollectPayment = false;
    if (process.env.ORG_ID === "libretexts" && !!orgEvent.regFee) {
      shouldCollectPayment = true;
      if (process.env.STRIPE_SECRET_KEY) {
        stripeKey = process.env.STRIPE_SECRET_KEY;
      } else {
        throw new Error(
          "Invalid system configuration for Events registration."
        );
      }
    }

    const participant = new OrgEventParticipant({
      user: foundUser._id,
      orgID,
      eventID: req.params.eventID,
      paymentStatus: shouldCollectPayment ? "unpaid" : "na",
      formResponses,
      feeWaiver: feeWaiver ? feeWaiver._id : undefined,
      shippingAddress: orgEvent.collectShipping
        ? req.body.shippingAddress
        : undefined,
    });

    const newDoc = await participant.save();
    if (!newDoc) {
      return conductor500Err(res);
    }

    let checkoutURL: string | null = null;
    if (process.env.ORG_ID === "libretexts" && !!orgEvent.regFee && stripeKey) {
      let feeWaivePercent = 0;
      let computedDiscount = 0;
      let computedTotal = orgEvent.regFee;
      if (feeWaiver && !!feeWaiver.percentage) {
        feeWaivePercent = feeWaiver.percentage / 100;
      }
      if (feeWaivePercent > 0) {
        computedDiscount = computedTotal * feeWaivePercent;
        computedTotal =
          computedDiscount > computedTotal
            ? 0
            : computedTotal - computedDiscount;
      }

      if (computedTotal > 0) {
        const stripeClient = new Stripe(stripeKey, {
          apiVersion: "2022-11-15",
        });
        const urlProto =
          process.env.NODE_ENV === "production" ? "https" : "http";
        const urlDomain =
          process.env.CONDUCTOR_DOMAIN ?? "commons.libretexts.org";

        const checkoutSession = await stripeClient.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                product_data: {
                  name: `${orgEvent.title} Registration`,
                },
                currency: "USD",
                unit_amount: Math.ceil(computedTotal * 100), // convert to cents
                tax_behavior: "inclusive",
              },
              quantity: 1,
              adjustable_quantity: {
                enabled: false,
              },
            },
          ],
          customer_email: foundUser.email,
          mode: "payment",
          shipping_address_collection: {
            allowed_countries: ["US"],
          },
          metadata: {
            application: "conductor",
            feature: "events",
            orgID,
            eventID: req.params.eventID ?? "unknown",
            userUUID: foundUser.uuid,
          },
          success_url: `${urlProto}://${urlDomain}/events/${req.params.eventID}/success?payment=true`,
          cancel_url: `${urlProto}://${urlDomain}/events/${req.params.eventID}`,
        });
        if (checkoutSession.url) {
          shouldSendConfirmation = false; // send after payment collected
          checkoutURL = checkoutSession.url;
        }
      } else if (feeWaiver && feeWaivePercent > 0 && computedTotal === 0) {
        await OrgEventParticipant.updateOne(
          { _id: newDoc._id },
          {
            paymentStatus: "waived",
            amountPaid: 0,
            feeWaiver: feeWaiver._id,
          }
        );
      }
    }

    if (shouldSendConfirmation) {
      mailAPI
        .sendOrgEventRegistrationConfirmation(foundUser, orgEvent)
        .catch((e: unknown) => debugError(e));
    }

    return res.send({
      err: false,
      msg: "Registration successfully submitted.",
      participant: newDoc,
      ...(checkoutURL ? { checkoutURL } : {}),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return conductorErr(res, 400, "err82");
    }
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
    { eventID?: string; feeWaiverCode?: string },
    Partial<OrgEventFeeWaiverInterface>
  >,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can update fee waivers)
    if (
      !req.user ||
      !process.env.ORG_ID ||
      !req.params.eventID ||
      !req.params.feeWaiverCode
    ) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const foundWaiver = await OrgEventFeeWaiver.findOne({
      code: req.params.feeWaiverCode,
    }).lean();
    if (!foundWaiver) {
      return conductor404Err(res);
    }

    const updateObj: Partial<OrgEventFeeWaiverInterface> = {};
    if (req.body.name) updateObj.name = req.body.name;
    if (!!req.body.active) updateObj.active = req.body.active;
    if (req.body.expirationDate) {
      updateObj.expirationDate = parseISO(req.body.expirationDate.toString());
    }
    if (typeof req.body.timeZone === "object") {
      updateObj.timeZone = req.body.timeZone;
    }

    if (req.body.active === false) {
      updateObj.active = false;
    } else if (req.body.active === true) {
      updateObj.active = true;
    }

    const updateRes = await OrgEventFeeWaiver.updateOne(
      { _id: foundWaiver._id },
      updateObj
    );
    if (!updateRes.acknowledged) {
      throw new Error("Failed to update fee waiver.");
    }

    return res.send({
      err: false,
      msg: "Fee waiver successfully updated.",
      feeWaiverCode: foundWaiver.code,
    });
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
async function _validateFeeWaiver(
  code: string,
  eventID: string
): Promise<OrgEventFeeWaiverInterface | null> {
  try {
    const foundWaiver = await OrgEventFeeWaiver.findOne({
      orgID: process.env.ORG_ID,
      eventID: eventID,
      code: code,
    }).lean();

    if (!foundWaiver) return null;

    if (!foundWaiver.active) return null;

    const utcNow = new Date(new Date().toUTCString());
    if (isAfter(utcNow, foundWaiver.expirationDate)) return null;

    return foundWaiver;
  } catch (err) {
    debugError(err);
    return null;
  }
}

async function setRegistrationPaidStatus(
  checkoutSession: Stripe.Checkout.Session,
  paymentIntent: Stripe.PaymentIntent,
  res: Response
) {
  try {
    const { orgID, eventID, userUUID } = checkoutSession.metadata ?? {};
    if (!orgID || !eventID || !userUUID) {
      return conductor400Err(res);
    }

    const orgEvent = await OrgEvent.findOne({
      orgID,
      eventID,
    }).lean();
    if (!orgEvent) {
      return conductor404Err(res);
    }
    if (!orgEvent.regFee) {
      debug(
        `Event ${orgEvent.eventID} does not require registration fee but received PaymentIntent ${paymentIntent.id}.`
      );
      return res.send({
        err: false,
        msg: "Event does not require registration fee.",
      });
    }

    const foundUser = await User.findOne({ uuid: userUUID }).lean();
    if (!foundUser) {
      return conductor404Err(res);
    }

    const participant = await OrgEventParticipant.findOne({
      orgID,
      eventID,
      user: foundUser._id,
    });
    if (!participant) {
      return conductor404Err(res);
    }

    // make idempotent: Stripe may send event multiple times
    if (participant.paymentStatus !== "unpaid") {
      debug(
        `Participant ${participant._id} does not required payment status update but received PaymentIntent ${paymentIntent.id}.`
      );
      return res.send({
        err: false,
        msg: "No registration status update necessary.",
      });
    }

    let newPaymentStatus = "paid";
    // console.log(
    //   `RECEIVED: ${paymentIntent.amount_received}, REG FEE: ${
    //     orgEvent.regFee
    //   }, DIVIDED: ${
    //     paymentIntent.amount_received / 100
    //   }, FEEWAIVER: ${!!participant.feeWaiver}`
    // );

    if (
      paymentIntent.amount_received / 100 < orgEvent.regFee &&
      participant.feeWaiver
    ) {
      newPaymentStatus = "partial_waived";
    }

    const updateRes = await OrgEventParticipant.updateOne(
      { _id: participant._id },
      {
        paymentStatus: newPaymentStatus,
        amountPaid: paymentIntent.amount_received / 100,
      }
    );
    if (!updateRes.acknowledged) {
      debugError(`Did not update OrgEventParticipant ${participant._id}`);
      return conductor500Err(res);
    }

    mailAPI
      .sendOrgEventRegistrationConfirmation(foundUser, orgEvent)
      .catch((e: unknown) => debugError(e));

    return res.send({
      err: false,
      msg: "Updated participant registration status.",
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
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
      const utcNow = new Date(new Date().toUTCString());
      if (
        isBefore(utcNow, orgEvent.regOpenDate) ||
        isAfter(utcNow, orgEvent.regCloseDate)
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
 * Verifies that a given shipping address is valid.
 * @param {Object} shippingAddress - The editing mode to validate.
 * @returns {Boolean} True if valid shipping address, false otherwise.
 */
const validateParticipantShippingAddress = (obj: unknown) => {
  if (typeof obj !== "object") return false;
  if (obj === null) return false;
  if (
    obj.hasOwnProperty("lineOne") && //Line Two is optional
    obj.hasOwnProperty("city") &&
    obj.hasOwnProperty("state") &&
    obj.hasOwnProperty("zip") &&
    obj.hasOwnProperty("country")
  ) {
    let invalidValues = false;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === "string" && key === "lineTwo") continue; //Line Two is optional
      if (typeof value !== "string") {
        invalidValues = true;
        break;
      }
      if (value.length === 0) {
        invalidValues = true;
        break;
      }
    }
    if (invalidValues) return false;
    return true;
  }
  return false;
};

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
          .isDecimal()
          .custom((value) => value >= 0),
        body("headings", conductorErrors.err1).exists().isArray(),
        body("prompts", conductorErrors.err1).exists().isArray(),
        body("textBlocks", conductorErrors.err1).exists().isArray(),
        body("timeZone", conductorErrors.err1).exists().isObject(),
        body("collectShipping", conductorErrors.err1).exists().isBoolean(),
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
        body("percentage", conductorErrors.err1)
          .exists()
          .isInt({ min: 1, max: 100 }),
        body("expirationDate", conductorErrors.err1).exists().isString(),
        body("timeZone", conductorErrors.err1).exists().isObject(),
      ];
    case "updateFeeWaiver":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        param("feeWaiverCode", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        body("name", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString()
          .notEmpty(),
        body("active", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isBoolean(),
        body("expirationDate", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isString(),
        body("timeZone", conductorErrors.err1)
          .optional({ checkFalsy: true })
          .isObject(),
      ];
  }
}

export default {
  getOrgEvents,
  getOrgEvent,
  getOrgEventParticipants,
  getOrgEventFeeWaivers,
  createOrgEvent,
  updateOrgEvent,
  cancelOrgEvent,
  submitRegistration,
  createFeeWaiver,
  updateFeeWaiver,
  setRegistrationPaidStatus,
  validate,
};
