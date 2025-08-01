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
import { parseISO, isBefore, isAfter, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import b62 from "base62-random";
import { getPaginationOffset, parseAndFormatDate } from "../util/helpers.js";
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
import projectsAPI from "./projects.js";
import OrgEventFeeWaiver, {
  OrgEventFeeWaiverInterface,
} from "../models/orgeventfeewaiver.js";
import {
  createStandardWorkBook,
  generateWorkSheetColumnDefinitions,
} from "../util/exports.js";
import { v4 as uuidv4 } from "uuid";
import Project from "../models/project.js";
import StripeService from "./services/stripe-service.js";

async function getOrgEvents(
  req: TypedReqQuery<{ page?: number }>,
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
    const orgEvents = await OrgEvent.find(
      {
        orgID: process.env.ORG_ID,
        canceled: { $ne: true },
      },
      undefined,
      {
        sort: { regOpenDate: -1 },
      }
    )
      .skip(offset)
      .limit(limit)
      .lean();

    if (!orgEvents) {
      throw new Error("OrgEvent query got invalid results");
    }

    const totalCount = await OrgEvent.countDocuments({
      orgID: process.env.ORG_ID,
      canceled: { $ne: true },
    });

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
  req: TypedReqParamsAndQueryWithUser<{ eventID?: string }, { page?: number }>,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    let page = 1;
    let limit = 25;
    if (
      req.query.page &&
      Number.isInteger(parseInt(req.query.page.toString()))
    ) {
      page = req.query.page;
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
      .populate<{ registeredBy: SanitizedUserInterface }>({
        path: "registeredBy",
        model: "User",
        select: SanitizedUserSelectQuery,
      })
      .sort({ _id: 1 })
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

    const participantsWithSortedResponses = (foundParticipants || []).map(
      (participant) => {
        const sortedFormResponses = participant.formResponses.sort(
          (a, b) => a.promptNum - b.promptNum
        );
        return {
          ...participant,
          formResponses: sortedFormResponses,
        };
      }
    );

    return res.send({
      err: false,
      participants: participantsWithSortedResponses,
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

    if (!req.body.timeZone) {
      return conductor400Err(res);
    }

    const orgEvent = new OrgEvent({
      orgID: process.env.ORG_ID,
      eventID: b62(10),
      title: req.body.title,
      regOpenDate: req.body.regOpenDate,
      regCloseDate: req.body.regCloseDate,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      timeZone: req.body.timeZone,
      regFee: req.body.regFee,
      collectShipping: req.body.collectShipping ?? false,
      ...(req.body.prompts && { prompts: req.body.prompts }),
      ...(req.body.headings && { headings: req.body.headings }),
      ...(req.body.textBlocks && { textBlocks: req.body.textBlocks }),
      ...(req.body.description && { description: req.body.description }),
    });

    const newDoc = await orgEvent.save();
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
    if (!req.body.timeZone) {
      return conductor400Err(res);
    }

    const updateObj = {
      ...updateBody,
      regOpenDate: req.body.regOpenDate,
      regCloseDate: req.body.regCloseDate,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
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
    OrgEventParticipantInterface & { feeWaiver: string; type: "self" | "other" }
  >,
  res: Response
) {
  try {
    if (!req.params.eventID) {
      return conductor400Err(res);
    }

    const {
      user: userID,
      orgID,
      formResponses,
      firstName,
      lastName,
      email,
      registeredBy,
      type,
    } = req.body;
    let stripeKey: string | null = null;
    let shouldSendConfirmation = true;

    if (type === "self" && !userID) {
      return conductor400Err(res);
    }

    // Participant must be logged in or provide a name and email if registering for someone else
    if (type === "other" && (!firstName || !lastName || !email)) {
      return conductor400Err(res);
    }

    // This should always be found because even registering for self will have registeredBy populated
    const foundRegisteredBy = await User.findOne({
      uuid: registeredBy,
    })
      .lean()
      .orFail({ name: "Not Found", message: "Registering user not found." });

    const orgEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: req.params.eventID,
    })
      .lean()
      .orFail({ name: "Not Found", message: "Event not found." });

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

    // Check for duplicate registrations
    if (type === "self") {
      const matchObj = {
        $or: [
          { eventID: req.params.eventID, user: foundRegisteredBy._id },
          { eventID: req.params.eventID, email: foundRegisteredBy.email },
        ],
      };
      const foundExisting = await OrgEventParticipant.findOne(matchObj);

      if (foundExisting) {
        return conductorErr(res, 400, "err82");
      }
    }

    if (type === "other") {
      const matchObj = {
        eventID: req.params.eventID,
        email: email,
      };

      const foundExisting = await OrgEventParticipant.findOne(matchObj);

      if (foundExisting) {
        return conductorErr(res, 400, "err82");
      }
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

    const CREATED_REG_ID = uuidv4();
    const participant = new OrgEventParticipant({
      regID: CREATED_REG_ID,
      user: type === "self" ? foundRegisteredBy._id : undefined,
      orgID,
      eventID: req.params.eventID,
      paymentStatus: shouldCollectPayment ? "unpaid" : "na",
      formResponses,
      feeWaiver: feeWaiver ? feeWaiver._id : undefined,
      shippingAddress: orgEvent.collectShipping
        ? req.body.shippingAddress
        : undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      email: email ?? undefined,
      registeredBy: foundRegisteredBy._id,
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
        const stripeService = new StripeService();
        const stripeClient = stripeService.getInstance();

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
          customer_email: foundRegisteredBy.email,
          mode: "payment",
          metadata: {
            application: "conductor",
            feature: "events",
            orgID,
            eventID: req.params.eventID ?? "unknown",
            regID: CREATED_REG_ID,
            userUUID: foundRegisteredBy.uuid ?? "unknown",
            firstName: firstName ?? "unknown",
            lastName: lastName ?? "unknown",
            email: email ?? "unknown",
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
      const emailAddresses = [];
      emailAddresses.push(foundRegisteredBy.email);
      if (!foundRegisteredBy && email) {
        emailAddresses.push(email);
      }

      const convertAndFormatStartDate = (): string => {
        let formattedStartTime = "";
        let formattedStartDate = "";
        if (orgEvent.timeZone?.value) {
          const convertedDate = utcToZonedTime(
            orgEvent.startDate,
            orgEvent.timeZone.value
          );
          formattedStartDate = format(convertedDate, "MMMM d, yyyy");
          formattedStartTime = format(convertedDate, "h:mm a");
        } else {
          formattedStartDate = format(orgEvent.startDate, "MMMM d, yyyy");
          formattedStartTime = format(orgEvent.startDate, "h:mm a");
        }
        return `${formattedStartTime} (${orgEvent.timeZone.abbrev ?? ""
          }) on ${formattedStartDate}`;
      };

      mailAPI
        .sendOrgEventRegistrationConfirmation(
          emailAddresses,
          orgEvent,
          foundRegisteredBy && foundRegisteredBy.firstName
            ? foundRegisteredBy.firstName
            : firstName
              ? firstName
              : "Unknown",
          convertAndFormatStartDate()
        )
        .catch((e: unknown) => debugError(e));
    }

    const syncRes = await _syncOrgEventParticipantsToProject(orgEvent.eventID);
    if (!syncRes || syncRes !== "success") {
      debugError(
        `Could not sync participants to project. Failed with error: ${syncRes}`
      );
    }

    return res.send({
      err: false,
      msg: "Registration successfully submitted.",
      participant: newDoc,
      ...(checkoutURL ? { checkoutURL } : {}),
    });
  } catch (err: any) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function unregisterParticipants(
  req: TypedReqParamsAndBodyWithUser<
    { eventID?: string },
    { participants: string[] }
  >,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can unregister participants)
    if (!req.user || !process.env.ORG_ID || !req.params.eventID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }
    if (
      !req.body.participants ||
      !req.params.eventID ||
      !Array.isArray(req.body.participants)
    ) {
      return conductor400Err(res);
    }

    // Delete participants
    const deletedParticipants = await OrgEventParticipant.deleteMany({
      regID: { $in: req.body.participants },
      eventID: req.params.eventID,
    }).lean();
    if (!deletedParticipants) {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      msg: "Participant(s) successfully unregistered.",
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
  } catch (err: any) {
    if (err.code === 11000) {
      return conductorErr(res, 400, "err83");
    }
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
  paymentIntent: Stripe.PaymentIntent | null,
  res: Response
) {
  try {
    const { orgID, eventID, userUUID, regID } = checkoutSession.metadata ?? {};
    if (!orgID || !eventID || !regID) {
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
        `Event ${orgEvent.eventID} does not require registration fee ${paymentIntent ? `but received PaymentIntent ${paymentIntent.id}.` : ''}`
      );
      return res.send({
        err: false,
        msg: "Event does not require registration fee.",
      });
    }

    const participant = await OrgEventParticipant.findOne({
      orgID,
      eventID,
      regID,
    })
      .populate<{
        registeredBy: SanitizedUserInterface;
      }>({
        path: "registeredBy",
        model: "User",
        select: SanitizedUserSelectQuery,
      })
      .populate<{
        user: SanitizedUserInterface;
      }>({
        path: "user",
        model: "User",
        select: SanitizedUserSelectQuery,
      });

    if (!participant) {
      return conductor404Err(res);
    }

    // make idempotent: Stripe may send event multiple times
    if (participant.paymentStatus !== "unpaid") {
      debug(
        `Participant ${participant._id} does not require payment status update but received Checkout Session ${checkoutSession.id} and PaymentIntent ${paymentIntent?.id}.`
      );
      return res.send({
        err: false,
        msg: "No registration status update necessary.",
      });
    }

    if (!paymentIntent) {
      debugError(
        `Received Checkout Session ${checkoutSession.id} without PaymentIntent. Cannot update registration status.`
      );
      return conductor500Err(res);
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

    if (!participant.registeredBy.email) {
      debugError(
        `Participant ${participant._id} does not have a registeredBy email address. Cannot send confirmation email.`
      );
    }

    const emailAddresses = [];
    if (participant.registeredBy && participant.registeredBy.email) {
      emailAddresses.push(participant.registeredBy.email);
    }

    if (participant.email) {
      emailAddresses.push(participant.email);
    }

    const participantName =
      participant.user && participant.user.firstName
        ? participant.user.firstName
        : participant.firstName
          ? participant.firstName
          : "Unknown";

    const convertAndFormatStartDate = (): string => {
      let formattedStartTime = "";
      let formattedStartDate = "";
      if (orgEvent.timeZone?.value) {
        const convertedDate = utcToZonedTime(
          orgEvent.startDate,
          orgEvent.timeZone.value
        );
        formattedStartDate = format(convertedDate, "MMMM d, yyyy");
        formattedStartTime = format(convertedDate, "h:mm a");
      } else {
        formattedStartDate = format(orgEvent.startDate, "MMMM d, yyyy");
        formattedStartTime = format(orgEvent.startDate, "h:mm a");
      }
      return `${formattedStartTime} (${orgEvent.timeZone.abbrev ?? ""
        }) on ${formattedStartDate}`;
    };

    mailAPI
      .sendOrgEventRegistrationConfirmation(
        emailAddresses,
        orgEvent,
        participantName,
        convertAndFormatStartDate()
      )
      .catch((e: unknown) => debugError(e));

    const syncRes = await _syncOrgEventParticipantsToProject(orgEvent.eventID);
    if (!syncRes || syncRes !== "success") {
      debugError(
        `Could not sync participants to project. Failed with error: ${syncRes}`
      );
    }

    return res.send({
      err: false,
      msg: "Updated participant registration status.",
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function downloadParticipantData(
  req: TypedReqParamsWithUser<{ eventID?: string }>,
  res: Response
) {
  try {
    // Check authorization (only campus/super admins can download participant data)
    if (!req.user || !process.env.ORG_ID) {
      return conductor400Err(res);
    }
    if (!authAPI.checkHasRole(req.user, process.env.ORG_ID, "campusadmin")) {
      return conductorErr(res, 403, "err8");
    }

    const { eventID } = req.params;
    if (!eventID) {
      return conductor400Err(res);
    }

    const foundEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID: eventID,
    }).lean();
    if (!foundEvent) {
      return conductor404Err(res);
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
      .populate<{
        registeredBy: SanitizedUserInterface;
      }>({
        path: "registeredBy",
        model: "User",
        select: SanitizedUserSelectQuery,
      })
      .lean();

    // Create workbook and worksheet
    const workbook = createStandardWorkBook();
    if (!workbook) {
      throw new Error(
        "Received null or undefined workbook from createStandardWorkBook()"
      );
    }
    const worksheet = workbook.addWorksheet("Participants");

    // Define columns
    const userColumns: string[] = [
      "user.firstName",
      "user.lastName",
      "user.email",
      "paymentStatus",
      "registeredBy",
    ];
    if (foundEvent.collectShipping) {
      userColumns.push(
        "shippingAddress.lineOne",
        "shippingAddress.lineTwo",
        "shippingAddress.city",
        "shippingAddress.state",
        "shippingAddress.zip",
        "shippingAddress.country"
      );
    }

    const promptColumns: string[] = foundEvent.prompts.map((prompt) => {
      return prompt.promptText;
    });

    worksheet.columns = generateWorkSheetColumnDefinitions([
      ...userColumns,
      ...promptColumns,
    ]);

    // Add rows
    for (let i = 0; i < foundParticipants.length; i++) {
      const p = foundParticipants[i];
      const rowData = [];
      if (p.user && p.user.firstName && p.user.lastName && p.user.email) {
        rowData.push(
          p.user.firstName,
          p.user.lastName,
          p.user.email,
          p.paymentStatus,
          "Self"
        );
      } else if (p.firstName && p.lastName && p.email) {
        rowData.push(p.firstName, p.lastName, p.email, p.paymentStatus);
        if (
          p.registeredBy &&
          p.registeredBy.email &&
          p.registeredBy.firstName &&
          p.registeredBy.lastName
        ) {
          rowData.push(
            `${p.registeredBy.firstName} ${p.registeredBy.lastName} (${p.registeredBy.email})`
          );
        }
      }

      if (foundEvent.collectShipping && p.shippingAddress) {
        rowData.push(
          p.shippingAddress.lineOne,
          p.shippingAddress.lineTwo ? p.shippingAddress.lineTwo : "",
          p.shippingAddress.city,
          p.shippingAddress.state,
          p.shippingAddress.zip,
          p.shippingAddress.country
        );
      }
      rowData.push(
        ...p.formResponses.map((r) => {
          return r.responseVal ? r.responseVal : "";
        })
      );
      worksheet.addRow([...rowData]);
    }

    // Generate CSV
    const filename = `${foundEvent.title} Participants.csv`;
    const csv = await workbook.csv.writeBuffer();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.send(csv);
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function configureAutoSync(
  req: TypedReqParamsWithUser<{
    eventID?: string;
    projectID?: string;
  }>,
  res: Response
) {
  try {
    if (!req.params.eventID || !req.params.projectID) {
      return conductor400Err(res);
    }

    const foundProject = await Project.findOne({
      projectID: req.params.projectID,
    })
      .lean()
      .orFail();

    const updateRes = await OrgEvent.updateOne(
      {
        orgID: process.env.ORG_ID,
        eventID: req.params.eventID,
      },
      {
        projectSyncID: foundProject.projectID,
      }
    ).orFail();

    if (!updateRes || updateRes.modifiedCount === 0) {
      return conductor500Err(res);
    }

    const runSyncRes = await _syncOrgEventParticipantsToProject(
      req.params.eventID
    );

    if (runSyncRes !== "success") {
      return conductor500Err(res);
    }

    return res.send({
      err: false,
      msg: "Auto-sync successfully configured.",
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError") {
      return conductor404Err(res);
    }
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Internal function to sync users from an event to a project
 * @private
 * @param {string} eventID - ID of event to sync users from
 * @returns {Promise<string>} - Returns 'success' if successful, otherwise returns error message
 */
async function _syncOrgEventParticipantsToProject(
  eventID: string
): Promise<string> {
  try {
    if (!eventID) {
      throw new Error("Missing eventID or projectID");
    }

    const foundParticipants = await OrgEventParticipant.find({
      orgID: process.env.ORG_ID,
      eventID,
    })
      .populate<{ user: SanitizedUserInterface }>({
        path: "user",
        model: "User",
        select: SanitizedUserSelectQuery,
      })
      .lean();

    if (!foundParticipants) {
      throw new Error("Error finding participants");
    }

    const foundEvent = await OrgEvent.findOne({
      orgID: process.env.ORG_ID,
      eventID,
    }).orFail();

    // If no projectSyncID, then no need to sync
    if (!foundEvent.projectSyncID) {
      return "success";
    }

    const foundProject = await Project.findOne({
      projectID: foundEvent.projectSyncID,
    })
      .lean()
      .orFail();

    // Find any users who may have been registered by someone else, but email matches to a Conductor account
    const foundUsers = await User.find({
      email: {
        $in: [
          ...foundParticipants.map((p) => {
            if (p.email) {
              return p.email;
            }
          }),
        ],
      },
    }).lean();

    const allUUIDs = [
      ...foundUsers.map((u) => {
        if (u.uuid) {
          return u.uuid;
        }
        return "";
      }),
      ...foundParticipants.map((p) => {
        if (p.user && p.user.uuid) {
          return p.user.uuid;
        }
        return "";
      }),
    ].flat();

    const currentTeam = projectsAPI.constructProjectTeam(foundProject);

    // Remove UUIDs from update list if they are already on the project
    const filteredUUIDs = allUUIDs.filter((uuid) => {
      if (!uuid) {
        return false;
      }
      return !currentTeam.includes(uuid);
    });

    // Add users to project
    const updateRes = await Project.updateOne(
      { projectID: foundProject.projectID },
      { $addToSet: { members: [...filteredUUIDs] } }
    );
    if (updateRes.modifiedCount !== 1) {
      throw new Error("Project update failed.");
    }

    return "success";
  } catch (err: any) {
    debugError(err);
    return err.message;
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
        body("collectShipping", conductorErrors.err1)
          .customSanitizer((v) => !!v)
          .exists()
          .isBoolean(),
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
        body("user", conductorErrors.err1).optional().isUUID(),
        body("orgID", conductorErrors.err1)
          .exists()
          .isLength({ min: 2, max: 50 }),
        body("type", conductorErrors.err1).exists().isIn(["self", "other"]),
        body("formResponses", conductorErrors.err1).exists().isArray(),
        body("feeWaiver", conductorErrors.err1)
          .optional()
          .isString()
          .isLength({ min: 10, max: 10 }),
        body("firstName", conductorErrors.err1)
          .optional()
          .isString()
          .notEmpty(),
        body("lastName", conductorErrors.err1).optional().isString().notEmpty(),
        body("email", conductorErrors.err1).optional().isEmail(),
        body("registeredBy", conductorErrors.err1).exists().isString().isUUID(),
      ];
    case "unregisterParticipants":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        body("participants", conductorErrors.err1)
          .exists()
          .isArray()
          .isLength({ min: 1, max: 100 }),
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
    case "configureAutoSync":
      return [
        param("eventID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
        param("projectID", conductorErrors.err1)
          .exists()
          .isString()
          .isLength({ min: 10, max: 10 }),
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
  unregisterParticipants,
  createFeeWaiver,
  updateFeeWaiver,
  setRegistrationPaidStatus,
  downloadParticipantData,
  configureAutoSync,
  validate,
};
