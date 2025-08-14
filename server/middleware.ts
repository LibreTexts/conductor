//
// LibreTexts Conductor
// middleware.js
//

"use strict";
import express, { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import conductorErrors from "./conductor-errors.js";
import { AnyZodObject } from "zod";
import { debugError } from "./debug.js";
import authAPI from "./api/auth.js";
import {
  TypedReqBodyWithUser,
  TypedReqParamsAndBodyWithUser,
  TypedReqParamsAndQueryWithUser,
  TypedReqParamsWithUser,
  TypedReqQueryWithUser,
  TypedReqUser,
  TypedReqWithUser,
} from "./types/Express.js";
import SupportTicket from "./models/supporticket.js";
import User from "./models/user.js";
import { extractZodErrorMessages } from "./api/validators/misc.js";
import CentralIdentityService from "./api/services/central-identity-service.js";

/**
 * Checks the results of the validation stage for an API route.
 * If there are no errors, the chain continues; otherwise, return an
 * error and the array of validation errors.
 * @param {Object} req    - the route request object
 * @param {Object} res    - the route response object
 * @param {function} next - the route's next middleware function to be ran
 */
const checkValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const validationErrors = validationResult(req);
  if (validationErrors.isEmpty()) {
    next();
  } else {
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err2,
      errors: validationErrors.array(),
    });
  }
};

/**
 * Checks that the route is being run on a LibreCommons server,
 * verified via an environment variable.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next function in the middleware chain.
 */
const checkLibreCommons = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.ORG_ID === "libretexts") return next();
  else {
    return res.status(403).send({
      err: true,
      msg: conductorErrors.err4,
    });
  }
};

/**
 * Verifies that a request has provided a valid key from the LibreTexts API.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next function in the middleware chain.
 */
const checkLibreAPIKey = (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.headers?.authorization === "string") {
    const foundToken = req.headers.authorization.replace("Bearer ", "");
    if (!process.env.LIBRE_API_KEY || process.env.LIBRE_API_KEY.length === 0) {
      return res.status(500).send({ errMsg: conductorErrors.err6 });
    }
    if (process.env.LIBRE_API_KEY === foundToken) return next();
  }
  return res.status(401).send({ errMsg: conductorErrors.err5 });
};

/**
 * Verifies that a request has provided a valid key from an EventBridge event.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next function in the middleware chain.
 */
const checkEventBridgeAPIKey = (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.headers?.authorization === "string") {
    const foundToken = req.headers.authorization.replace("Bearer ", "");
    if (!process.env.EVENT_BRIDGE_API_KEY || process.env.EVENT_BRIDGE_API_KEY.length === 0) {
      return res.status(500).send({ errMsg: conductorErrors.err6 });
    }
    if (process.env.EVENT_BRIDGE_API_KEY === foundToken) return next();
  }
  return res.status(401).send({ errMsg: conductorErrors.err5 });
};

/**
 * Reconstructs the Authorization header from cookies, if not already present.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - Next middleware function to run.
 * @returns {express.NextFunction|express.Response} Invocation of the next middleware, or
 *  an error response.
 */
function authSanitizer(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== "OPTIONS") {
    const { cookies } = req;
    if (
      !req.header("authorization") &&
      cookies.conductor_access_v2 &&
      cookies.conductor_signed_v2
    ) {
      req.headers.authorization = `${cookies.conductor_access_v2}.${cookies.conductor_signed_v2}`;
    }
  }
  return next();
}

/**
 * Performs security checks on incoming requests by examing header values.
 *
 * @deprecated
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - Next middleware function to run.
 * @returns {express.NextFunction|express.Response} An invocation of the next middleware, or
 *  an error response.
 */
function requestSecurityHelper(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    req.method !== "OPTIONS" &&
    req.header("x-requested-with") !== "XMLHttpRequest"
  ) {
    return res.status(403).send({
      err: true,
      errMsg: conductorErrors.err71,
    });
  }
  return next();
}

/**
 * Checks if a route is a member of an array of paths to exclude from the given middleware. If so,
 * the route continues its middleware chain, otherwise, the given middleware is activated.
 *
 * @param {string[]} paths - An array of paths to exclude from the middleware
 * @param {function} middleware  - The middleware function to execute if the path is not excluded.
 */
function middlewareFilter(
  paths: string[],
  middleware: (req: Request, res: Response, next: NextFunction) => void
) {
  return (req: any, res: any, next: any) => {
    if (paths.includes(req._parsedUrl.pathname)) {
      return next();
    }
    return middleware(req, res, next);
  };
}

/**
 * Checks if the server has been configured to use the Central Identity service.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 * @returns {express.NextFunction|express.Response} An invocation of the next middleware, or
 *  an error response.
 */
function checkCentralIdentityConfig(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const service = new CentralIdentityService();
  const configured = service.isConfigured();
  if (configured) return next();
  return res.status(500).send({
    err: true,
    errMsg: conductorErrors.err16,
  });
}

/**
 * Checks if a request passes a LibreOne API key check and is from a LibreTexts domain.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 * @returns {express.NextFunction|express.Response}
 */
function authLibreOneRequest(req: Request, res: Response, next: NextFunction) {
  const requestKey = req.get("Authorization")?.replace("Bearer ", "");
  if (!requestKey) return res.status(401).send("Unauthorized");
  const validKey =
    process.env.LIBREONE_API_KEY && requestKey === process.env.LIBREONE_API_KEY;
  if (!validKey) return res.status(401).send("Unauthorized");

  // Must originate from a LibreTexts domain in production
  if (
    process.env.NODE_ENV !== "development" &&
    (!req.get("origin") || !req.get("origin")?.endsWith("libretexts.org"))
  ) {
    return res.status(403).send("Forbidden");
  }
  next();
}
/**
 * Checks if a request is authorized to access a support ticket. The user can be authorized and have sufficient roles (or be the 'owner' of the ticket), or
 * the request can be authorized with a valid guestAccessKey.
 * @param {express.Request} req - The Express.js request object.
 * @param {express.Response} res - The Express.js response object.
 * @param {express.NextFunction} next - The next function in the middleware chain.
 * @returns {express.NextFunction|express.Response} An invocation of the next middleware, or an error response.
 */
const canAccessSupportTicket = async (
  req: TypedReqParamsAndQueryWithUser<{ uuid: string }, { accessKey?: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    // First check if the request is authorized with a valid accessKey
    // We check this first in case a user is logged in, but was added as a CC to the ticket and is accessing the ticket via the accessKey
    if (req.query && req.query.accessKey && req.params.uuid) {
      const ticket = await SupportTicket.findOne({
        uuid: req.params.uuid,
      });

      if (!ticket || !ticket.uuid) {
        return res.status(404).send({
          err: true,
          errMsg: conductorErrors.err3,
        });
      }

      const availableAccessKeys = [
        ticket.guestAccessKey,
        ...(ticket.ccedEmails || []).map((email) => email.accessKey),
      ]

      if (availableAccessKeys.includes(req.query.accessKey)) {
        return next();
      }
    } else if (req.user && req.user.decoded.uuid) {
      const user = await User.findOne({ uuid: req.user.decoded.uuid });
      if (!user || !user.uuid) {
        throw new Error("unauthorized");
      }

      // if the user object is present, check if the user has the support role (or is superadmin)
      const hasSupportRole = authAPI.checkHasRole(
        user,
        "libretexts",
        "support",
        true
      );

      // if the user has the support role, allow access
      if (hasSupportRole) {
        return next();
      }

      // if the user does not have the support role, check if the user is the owner of the ticket
      if (req.params && req.params.uuid) {
        const ticket = await SupportTicket.findOne({
          uuid: req.params.uuid,
          userUUID: user.uuid,
        });

        // if the ticket is found and the user is the owner, allow access
        if (ticket && ticket.uuid) {
          return next();
        }

        throw new Error("unauthorized");
      }
    }

    // if neither the user object nor the accessKey is present, return unauthorized error
    throw new Error("unauthorized");
  } catch (err: any) {
    if (process.env.NODE_ENV === "development") {
      debugError(err);
    }
    if (err.message === "unauthorized") {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err2,
    });
  }
};

/**
 * Checks if the uuid in the request parameters is that of the calling user or if the user has the support role.
 * @param {express.Request} req - The Express.js request object.
 * @param {express.Response} res - The Express.js response object.
 * @param {express.NextFunction} next - The next function in the middleware chain.
 * @returns {express.NextFunction|express.Response} An invocation of the next middleware, or an error response.
 */
const isSelfOrSupport = async (
  req: TypedReqParamsWithUser<{ uuid: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.params?.uuid) {
      throw new Error("badreq");
    }
    
    if (!req.user || !req.user.decoded || !req.user.decoded.uuid) {
      throw new Error("unauthorized");
    }

    const user = await User.findOne({ uuid: req.user.decoded.uuid });
    if (!user || !user.uuid) {
      throw new Error("unauthorized");
    }

    // if the user object is present, check if the user has the support role (or is superadmin)
    const hasSupportRole = authAPI.checkHasRole(
      user,
      "libretexts",
      "support",
      true
    );

    // if the user has the support role, allow access
    if (hasSupportRole) {
      return next();
    }

    // if the user does not have the support role, check if the calling user uuid matches the uuid in the request parameters
    if (req.params.uuid === req.user.decoded.uuid) {
      return next();
    }

    throw new Error("unauthorized"); // If the user is not the owner and does not have the support role, throw an error
  } catch (err: any) {
    if (process.env.NODE_ENV === "development") {
      debugError(err);
    }
    if (err.message === "unauthorized") {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err2,
    });
  }
};

const validateZod = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let validationErrors: string[] = [];
    try {
      const validationRes = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!validationRes.success) {
        validationErrors = extractZodErrorMessages(validationRes.error);
        throw new Error("Validation failed");
      }

      next();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        debugError(err + ": " + validationErrors.join(", "));
      }
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2 + ": " + validationErrors.join(", "),
      });
    }
  };
};

export default {
  checkValidationErrors,
  checkLibreCommons,
  checkLibreAPIKey,
  checkEventBridgeAPIKey,
  authSanitizer,
  requestSecurityHelper,
  middlewareFilter,
  checkCentralIdentityConfig,
  authLibreOneRequest,
  canAccessSupportTicket,
  isSelfOrSupport,
  validateZod,
};
