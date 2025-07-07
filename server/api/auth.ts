"use strict";
import { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";

import { body, query } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, decodeJwt } from "jose";
import axios from "axios";
import User from "../models/user.js";
import OAuth from "./oauth.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { assembleUrl, isEmptyString, isFullURL } from "../util/helpers.js";
import FormData from "form-data";
import Session from "../models/session.js";
import { ZodReqWithOptionalUser, ZodReqWithUser } from "../types/Express.js";
import { z } from "zod";

const SALT_ROUNDS = 10;
const JWT_SECRET = new TextEncoder().encode(process.env.SECRETKEY);
const JWT_COOKIE_DOMAIN = (process.env.PRODUCTIONURLS || "").split(",")[0];
const SESSION_DEFAULT_EXPIRY_MINUTES = 60 * 24 * 7; // 7 days
const SESSION_DEFAULT_EXPIRY_MILLISECONDS =
  SESSION_DEFAULT_EXPIRY_MINUTES * 60 * 1000;

const oidcBase = `https://${process.env.OIDC_HOST}`;
const oidcAuth = `${oidcBase}/cas/oidc/authorize`;
const oidcToken = `${oidcBase}/cas/oidc/accessToken`;
const oidcCallbackProto =
  process.env.NODE_ENV === "production" ? "https" : "http";
const oidcCallbackHost =
  process.env.OIDC_CALLBACK_HOST ||
  process.env.CONDUCTOR_DOMAIN ||
  "commons.libretexts.org";
const oidcCallback = `${oidcCallbackProto}://${oidcCallbackHost}/api/v1/oidc/libretexts`;
const oidcJWKS = `${oidcBase}/cas/oidc/jwks`;
const oidcProfile = `${oidcBase}/cas/oidc/profile`;
const oidcLogout = `${oidcBase}/cas/logout`;

/**
 * Creates a JWT for a local session.
 *
 * @param {string} uuid - The User UUID to initialize the session for.
 * @param {string} sessionId - The session ID to use for the session.
 * @returns {string} The generated JWT.
 */
async function createSessionJWT(uuid: string, sessionId: string) {
  return await new SignJWT({ uuid, sessionId })
    .setSubject(uuid)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_COOKIE_DOMAIN)
    .setAudience(JWT_COOKIE_DOMAIN)
    .setExpirationTime("3d")
    .sign(JWT_SECRET);
}

/**
 * Splits a JWT for a local session into the "access" and "signed" components.
 *
 * @param sessionJWT - JWT to split into components.
 * @returns {string[]} The access and signed components.
 */
function splitSessionJWT(sessionJWT: string) {
  const splitJWT = sessionJWT.split(".");
  const access = splitJWT.slice(0, 2).join(".");
  const signed = splitJWT[2];
  return [access, signed];
}

/**
 * Attaches necessary cookies to the provided API response object
 * in order to create a local session.
 *
 * @param {express.Response} res - The response object to attach the session cookies to.
 * @param {string} uuid - The User UUID to initialize the session for.
 * @param {string} ticket - A CAS ticket ID to use for the session.
 */
async function createAndAttachLocalSession(
  res: Response,
  uuid: string,
  ticket?: string
) {
  const sessionId = uuidv4();
  const sessionCreated = new Date();
  const sessionExpiry = new Date(
    sessionCreated.getTime() + SESSION_DEFAULT_EXPIRY_MILLISECONDS
  );
  const session = new Session({
    sessionId,
    userId: uuid,
    valid: true,
    createdAt: sessionCreated,
    expiresAt: sessionExpiry,
    ...(ticket && { sessionTicket: ticket }),
  });

  await session.save();

  const sessionJWT = await createSessionJWT(uuid, sessionId);
  const [access, signed] = splitSessionJWT(sessionJWT);

  const prodCookieConfig = {
    secure: true,
    domain: JWT_COOKIE_DOMAIN,
    maxAge: SESSION_DEFAULT_EXPIRY_MILLISECONDS,
  };
  res.cookie("conductor_access_v2", access, {
    path: "/",
    ...(process.env.NODE_ENV === "production" && prodCookieConfig),
  });
  res.cookie("conductor_signed_v2", signed, {
    path: "/",
    httpOnly: true,
    ...(process.env.NODE_ENV === "production" && prodCookieConfig),
  });
}

/**
 * Redirects the browser to CAS login screen after generating state and nonce parameters.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function initLogin(req: Request, res: Response) {
  if (!process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }

  const state = JSON.stringify({
    state: randomBytes(10).toString("hex"),
    orgID: process.env.ORG_ID,
    ...(req.query.redirectURI && {
      redirectURI: req.query.redirectURI,
    }),
  });

  // Base64 encode state to comply with RFC 6265 cookie standards
  const base64State = Buffer.from(state).toString("base64");

  const nonce = uuidv4();
  const nonceHash = await bcrypt.hash(nonce, SALT_ROUNDS);
  const _params: Record<string, string> = {
    state,
    response_type: "code",
    client_id: process.env.OIDC_CLIENT_ID,
    redirect_uri: oidcCallback,
    nonce: nonceHash,
    scope: "openid profile email libretexts",
  };

  const params = new URLSearchParams(_params);

  const prodCookieConfig = {
    sameSite: "lax" as CookieOptions["sameSite"],
    domain: process.env.OIDC_CALLBACK_HOST || process.env.CONDUCTOR_DOMAIN,
    secure: true,
  };

  // Handle redirection for org Commons (non-LibreTexts instances)
  if (
    process.env.CONDUCTOR_DOMAIN &&
    process.env.CONDUCTOR_DOMAIN !== "commons.libretexts.org"
  ) {
    const authRedirectURL = `${oidcCallbackProto}://${process.env.CONDUCTOR_DOMAIN}`;
    res.cookie("conductor_auth_redirect", authRedirectURL, {
      encode: String,
      httpOnly: true,
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });
  }

  res.cookie("oidc_state", base64State, {
    encode: String,
    httpOnly: true,
    ...(process.env.NODE_ENV === "production" && prodCookieConfig),
  });
  res.cookie("oidc_nonce", nonce, {
    encode: String,
    httpOnly: true,
    ...(process.env.NODE_ENV === "production" && prodCookieConfig),
  });
  return res.redirect(`${oidcAuth}?${params.toString()}`);
}

/**
 * Uses the authorization code in the OIDC callback URL to complete SSO login.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function completeLogin(req: Request, res: Response) {
  try {
    if (!process.env.OIDC_CLIENT_ID || !process.env.OIDC_CLIENT_SECRET) {
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }

    const formURLEncode = (value: string) =>
      encodeURIComponent(value).replace(/%20/g, "+");

    // Compare state nonce
    const { oidc_state } = req.cookies;
    const { state: stateQuery } = req.query;

    let state = null;
    let stateCookie = null;
    try {
      state = stateQuery?.toString() ? JSON.parse(stateQuery.toString()) : null; // Decode query state
      stateCookie = JSON.parse(Buffer.from(oidc_state, "base64").toString()); // Decode base64 state
    } catch (e) {
      debugError(`State query: ${stateQuery}`);
      debugError(`State cookie: ${oidc_state}`);
      debugError(e);
    }
    if (!state || !stateCookie || state.nonce !== stateCookie.nonce) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err71,
      });
    }

    // Get Access && ID Token
    const encoded = `${formURLEncode(
      process.env.OIDC_CLIENT_ID
    )}:${formURLEncode(process.env.OIDC_CLIENT_SECRET)}`;
    const authVal = Buffer.from(encoded).toString("base64");
    const tokenRes = await axios.post(oidcToken, null, {
      headers: { Authorization: `Basic ${authVal}` },
      params: {
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: oidcCallback,
      },
    });
    const { access_token, id_token } = tokenRes?.data;
    if (!access_token || !id_token) {
      throw new Error("notokens");
    }

    // Session ID (sid) from id_token will be used as the ticket identifier
    const idDecoded = decodeJwt(id_token);
    const ticketID = idDecoded?.sid?.toString();

    // Verify ID token with CAS public key set
    const JWKS = createRemoteJWKSet(new URL(oidcJWKS));
    const { payload } = await jwtVerify(id_token, JWKS, {
      issuer: `${oidcBase}/cas/oidc`,
      audience: process.env.OIDC_CLIENT_ID,
    });

    // Compare nonce hash
    const { oidc_nonce } = req.cookies;
    const { nonce } = payload;
    const nonceString = nonce?.toString();
    if (!nonce || !oidc_nonce || !nonceString) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err71,
      });
    }

    const nonceValid = await bcrypt.compare(oidc_nonce, nonceString);
    if (!nonceValid) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err71,
      });
    }

    // Get user data from central IdP via OIDC protocol
    const profileRes = await axios.get(oidcProfile, {
      params: {
        access_token: access_token,
      },
    });
    const profileData = profileRes.data;
    const centralAttr = profileData.attributes;
    const authSub = profileData.sub || centralAttr.sub;
    const targetOrg = state.orgID || process.env.ORG_ID

    const validUUID = (await z.string().uuid().safeParseAsync(authSub)).success;

    let authUser = null;

    // Check if user exists locally and sync
    // If validUUID, search by centralID, else we may have received an external subject id, so search by email
    const existUser = await User.findOne(validUUID ? { centralID: authSub } : { email: centralAttr.email });
    if (existUser) {
      authUser = existUser;
      // Sync data that may have been changed in a delegated IdP
      let doSync = false;
      const centralToLocalAttrs = [
        ["email", "email"],
        ["given_name", "firstName"],
        ["family_name", "lastName"],
        ["picture", "avatar"],
      ];

      for (const [central, auth] of centralToLocalAttrs) {
        // @ts-ignore
        if (centralAttr[central] !== authUser[auth]) {
          doSync = true;
          // @ts-ignore
          authUser[auth] = centralAttr[central];
        }
      }
      if (doSync) {
        await authUser.save();
      }
    }

    // User doesn't exist locally, create them now
    if (!authUser) {
      console.log(`Creating new user with centralID ${authSub}, email ${centralAttr.email}`);
      const newUser = new User({
        centralID: authSub,
        uuid: uuidv4(),
        firstName: centralAttr.given_name,
        lastName: centralAttr.family_name,
        email: centralAttr.email,
        authType: "sso",
        avatar:
          centralAttr.picture ||
          "https://cdn.libretexts.net/DefaultImages/avatar.png",
        roles: [],
        verifiedInstructor: centralAttr.verify_status === "verified",
        instructorProfile: {
          ...(centralAttr.organization?.name && {
            institution: centralAttr.organization.name,
          }),
          ...(centralAttr.bio_url && {
            facultyURL: centralAttr.bio_url,
          }),
        },
      });
      await newUser.save();
      authUser = newUser;
    }

    // Handle first login to an instance
    let isNewMember = true;
    if (Array.isArray(authUser.roles)) {
      const foundRole = authUser.roles.find((item) => item.org === targetOrg);
      if (foundRole) {
        isNewMember = false;
      }
    }
    if (isNewMember) {
      const userRoles = authUser.roles || [];
      userRoles.push({ org: targetOrg, role: "member" });
      authUser.roles = userRoles;
      await authUser.save();
    }

    // Create local session
    await createAndAttachLocalSession(res, authUser.uuid, ticketID);

    // Determine base of redirect URL
    let finalRedirectURL = `${req.protocol}://${req.get("host")}`; // Default to current host
    if(req.cookies.conductor_auth_redirect){
      finalRedirectURL = req.cookies.conductor_auth_redirect; // Use auth redirect cookie if available
    }

    // Check if redirectURI is a full URL
    if (state.redirectURI && isFullURL(state.redirectURI)) {
      finalRedirectURL = state.redirectURI;
    } else if (state.redirectURI && !isFullURL(state.redirectURI)) {
      // redirectURI is only a path or not provided
      finalRedirectURL = assembleUrl([finalRedirectURL, state.redirectURI]);
    } else {
      // Default to home if no redirectURI is provided
      finalRedirectURL = assembleUrl([finalRedirectURL, "home"]);
    }

    if (!state.redirectURI && isNewMember) {
      const _final = new URL(finalRedirectURL);
      const _params = new URLSearchParams(_final.search);
      _params.set("newmember", "true");
      finalRedirectURL = `${_final.origin}${
        _final.pathname
      }?${_params.toString()}`;
    }

    return res.redirect(finalRedirectURL);
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Ends the user's Conductor session and redirects to the CAS logout endpoint.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function logout(_req: Request, res: Response) {
  try {
    // Attempt to invalidate the user's session
    const accessCookie = _req.cookies.conductor_access_v2;
    const signedCookie = _req.cookies.conductor_signed_v2;
    const sessionJWT = `${accessCookie}.${signedCookie}`;
    if (accessCookie && signedCookie && sessionJWT) {
      try {
        const { payload } = await jwtVerify(sessionJWT, JWT_SECRET, {
          issuer: JWT_COOKIE_DOMAIN,
          audience: JWT_COOKIE_DOMAIN,
        });

        const { sessionId, uuid: userId } = payload;
        if (userId && sessionId) {
          await Session.updateMany(
            {
              userId,
              sessionId,
            },
            {
              valid: false,
            }
          );
        }
      } catch (e) {
        debugError(e); // Just fail silently if we can't invalidate the DB sessions - we still want to log the user out
      }
    }

    const prodCookieConfig = {
      secure: true,
      domain: JWT_COOKIE_DOMAIN,
    };
    res.clearCookie("conductor_access_v2", {
      path: "/",
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });
    res.clearCookie("conductor_signed_v2", {
      path: "/",
      httpOnly: true,
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });

    // Clear deprecated cookies
    res.clearCookie("conductor_access", {
      path: "/",
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });
    res.clearCookie("conductor_signed", {
      path: "/",
      httpOnly: true,
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });
    return res.redirect(oidcLogout);
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function handleSingleLogout(req: Request, res: Response) {
  try {
    const body = req.body;
    const query = req.query;
    // Load balancer/Cloudflare may rewrite as query param in production
    // Support both, but prefer body
    const logout_token = body.logout_token || query.logout_token;
    if (!logout_token) {
      throw new Error("No logout token provided");
    }

    // Verify logout token with CAS public key set
    const JWKS = createRemoteJWKSet(new URL(oidcJWKS));

    const { payload } = await jwtVerify(logout_token, JWKS, {
      issuer: `${oidcBase}/cas/oidc`,
    });

    const { sub, sid } = payload; // sub will be the user's email
    if (!sub) {
      throw new Error("No sub provided in logout token");
    }

    // Find the matching user
    const user = await User.findOne({ email: sub });
    if (!user) {
      throw new Error("User not found");
    }

    // Invalidate matching session(s) for the user (technically should only be one)
    await Session.updateMany(
      {
        userId: user.uuid,
        sessionTicket: sid,
      },
      {
        valid: false,
      }
    );

    return res.send({
      err: false,
      msg: "Logout request received",
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
 * Handles login using the fallback authentication method (system administrators).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function fallbackAuthLogin(req: Request, res: Response) {
  try {
    const formattedEmail = String(req.body.email).toLowerCase();
    const foundUser = await User.findOne({
      $and: [{ email: formattedEmail }, { authType: "traditional" }],
    });
    if (!foundUser || !foundUser.password) {
      return res.send({
        err: true,
        errMsg: conductorErrors.err12,
      });
    }
    const passMatch = await bcrypt.compare(
      req.body.password,
      foundUser.password
    );
    if (!passMatch) {
      return res.send({
        err: true,
        errMsg: conductorErrors.err12,
      });
    }

    await createAndAttachLocalSession(res, foundUser.uuid);
    return res.redirect("/home");
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves an array of LibreTexts Super/Campus Admins, with each administrator
 * as their own object with email, uuid, firstName, and lastName.
 * INTERNAL USE ONLY.
 * @param {boolean} [superAdmins=false] - Restrict search to SuperAdmins only.
 * @returns {object[]} An array of the administrators and their information.
 */
const getLibreTextsAdmins = (superAdmins = false) => {
  let roleMatch = {};
  if (!superAdmins) {
    roleMatch = {
      $or: [{ role: "superadmin" }, { role: "campusadmin" }],
    };
  } else {
    roleMatch = { role: "superadmin" };
  }
  return User.aggregate([
    {
      $match: {
        roles: {
          $elemMatch: {
            $and: [{ org: "libretexts" }, { ...roleMatch }],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        uuid: 1,
        email: 1,
        firstName: 1,
        lastName: 1,
      },
    },
  ])
    .then((admins) => {
      return admins;
    })
    .catch((err) => {
      throw err;
    });
};

/**
 * Retrieves an array of Campus Admins for the specific orgID, with each
 * administrator as their own object with email, uuid, firstName, and lastName.
 * INTERNAL USE ONLY.
 * @param {String} campus  - the orgID to retrieve admins for
 * @returns {Object[]} an array of the administrators and their information
 */
const getCampusAdmins = (campus: string) => {
  return new Promise((resolve, reject) => {
    if (campus && !isEmptyString(campus)) {
      resolve(
        User.aggregate([
          {
            $match: {
              roles: {
                $elemMatch: {
                  $and: [
                    {
                      org: campus,
                    },
                    {
                      role: "campusadmin",
                    },
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              uuid: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
            },
          },
        ])
      );
    } else {
      reject("missingcampus");
    }
  })
    .then((admins) => {
      return admins;
    })
    .catch((err) => {
      throw err;
    });
};

/**
 * Retrieves users(s) information with email, uuid, firstName, and lastName.
 * INTERNAL USE ONLY.
 * @param {String|String[]}  uuid - the user uuid(s) to lookup by
 * @returns {Object[]} an array of user objects
 */
const getUserBasicWithEmail = (uuid: string | string[]) => {
  return new Promise((resolve, reject) => {
    /* Validate argument and build match object */
    let matchObj: Record<string, any> = {};
    if (typeof uuid === "string") {
      matchObj.uuid = uuid;
    } else if (typeof uuid === "object" && Array.isArray(uuid)) {
      matchObj.uuid = {
        $in: uuid,
      };
    } else reject("missingarg");
    /* Lookup user(s) */
    resolve(
      User.aggregate([
        {
          $match: matchObj,
        },
        {
          $project: {
            _id: 0,
            uuid: 1,
            email: 1,
            firstName: 1,
            lastName: 1,
          },
        },
      ])
    );
  })
    .then((users) => {
      return users;
    })
    .catch((err) => {
      throw err;
    });
};

/**
 * Verifies the JWT provided by a user or a Bearer access token provided by
 * an API client in the Authorization header.
 *
 * @param {express.Request} req - Incoming request object, with cookies already processed.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next function to run in the middleware chain.
 */
async function verifyRequest(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  try {
    if (!authHeader) {
      throw new Error("ERR_BAD_SESSION");
    }

    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return OAuth.authenticate(req, res, next);
    }
    const { payload } = await jwtVerify(authHeader, JWT_SECRET, {
      issuer: JWT_COOKIE_DOMAIN,
      audience: JWT_COOKIE_DOMAIN,
    });

    // @ts-ignore
    req.user = { decoded: payload };
    // @ts-ignore
    req.decoded = payload; // TODO: Remove and update other handlers

    const sessionId = payload.sessionId;
    if (!sessionId) {
      throw new Error("ERR_BAD_SESSION");
    }

    const session = await Session.findOne({
      sessionId,
      valid: true,
    });

    if (!session) {
      throw new Error("ERR_BAD_SESSION");
    }
    return next();
  } catch (e: any) {
    let tokenExpired = false;
    let sessionInvalid = false;
    console.log("VERIFY REQUEST ERROR");
    console.log(e);
    if (e.code === "ERR_JWT_EXPIRED") {
      tokenExpired = true;
    } else if (e.message === "ERR_BAD_SESSION") {
      sessionInvalid = true;
    } else {
      debugError(e);
    }
    return res.status(401).send({
      err: true,
      errMsg: conductorErrors.err5,
      ...(tokenExpired && { tokenExpired }),
      ...(sessionInvalid && { sessionInvalid }),
    });
  }
}

/**
 * Middleware to optionally verify a request if authorization
 * headers are present.
 *
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 * @param {Object} next - the next function in the middleware chain.
 */
function optionalVerifyRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.headers.authorization) {
    return verifyRequest(req, res, next);
  }
  return next();
}

/**
 * Pulls the user record from the database and adds
 * its attributes (roles) to the
 * request object.
 * Method should only be called AFTER the 'verifyRequest'
 * method in a routing chain.
 */
const getUserAttributes = (
  req: ZodReqWithUser<Request>,
  res: Response,
  next: NextFunction
) => {
  if (req.user.decoded !== undefined) {
    return User.findOne({
      uuid: req.user.decoded.uuid,
    })
      .then((user) => {
        if (user) {
          if (user.roles !== undefined) {
            // @ts-ignore
            req.user.roles = user.roles;
          }
          return next();
        }
        throw new Error("nouser");
      })
      .catch((err) => {
        if (err.message === "nouser") {
          return res.send(401).send({
            err: true,
            errMsg: conductorErrors.err7,
          });
        } else {
          debugError(err);
          return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
          });
        }
      });
  }
  return res.status(400).send({
    err: true,
    errMsg: conductorErrors.err5,
  });
};

/**
 * Middleware to optionally populate the authorized user in the request object.
 *
 * @param {express.Request} req - the express.js request object.
 * @param {express.Response} res - the express.js response object.
 * @param {express.NextFunction} next - the next function in the middleware chain.
 */
function optionalGetUserAttributes(
  req: ZodReqWithOptionalUser<Request>,
  res: Response,
  next: NextFunction
) {
  if (req.user?.decoded) {
    return getUserAttributes(req as ZodReqWithUser<Request>, res, next);
  }
  return next();
}

/**
 * Checks that the user has at least one of the provided roles within the specified Organization.
 * Users with the "superadmin" role in the "libretexts" organization will always return true.
 * NOTE: This method should NOT be used as middleware.
 * @param {Object} user - The user data object.
 * @param {String} org - The Organization identifier.
 * @param {String | String[]} role - The role identifier.
 * @returns {Boolean} True if valid roles are provided and the user has at least one of them, false otherwise.
 */
const checkHasRole = (
  user: Record<string, any>,
  org: string,
  role: string | string[],
  silent = false
) => {
  const rawMatchRoles = Array.isArray(role) ? role : [role]; // Always convert to an array for simplicity in checks
  
  // Ensure roles are strings, not empty, and not null/undefined, and always lowercase
  const matchRoles = rawMatchRoles
    .filter((r) => typeof r === "string" && r.trim() !== "")
    .map((r) => r.toLowerCase());

  // If no valid roles are provided, fail-closed and return false
  if (matchRoles.length === 0) {
    if (!silent) {
      debugError(conductorErrors.err92);
    }
    return false;
  }

  if (!user) {
    if (!silent) {
      debugError(conductorErrors.err7);
    }
    return false;
  }
  
  if (user.roles !== undefined && Array.isArray(user.roles)) {
    const foundRole = user.roles.find((element) => {
      if (element.org && element.role) {
        if (element.org === org && matchRoles.includes(element.role?.toLowerCase() || "")) {
          return element;
        } else if (
          element.org === "libretexts" &&
          element.role === "superadmin"
        ) {
          // OVERRIDE: SuperAdmins always have permission
          return element;
        } else if (
          element.org === process.env.ORG_ID &&
          element.role === "campusadmin"
        ) {
          // OVERRIDE: CampusAdmins always have permission in their own instance
          return element;
        }
        return null;
      }
    });
    if (foundRole !== undefined) return true;
    return false;
  }
  if (!silent) {
    debugError(conductorErrors.err9);
  }
  return false;
};

/**
 * Checks that the user has a certain role within the specified Organization.
 * Method should only be called AFTER the 'getUserAttributes' method in a routing chain.
 * @param {String} org - The Organization identifier.
 * @param {String} role - The role identifier.
 * @returns {Function} An Express.js middleware function.
 */
const checkHasRoleMiddleware = (org: string, role: string | string[]) => {
  return (req: ZodReqWithUser<Request>, res: Response, next: NextFunction) => {
    if (!org || isEmptyString(org)) {
      debugError(conductorErrors.err10);
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err10,
      });
    }

    const rawMatchRoles = Array.isArray(role) ? role : [role]; // Always convert to an array for simplicity in checks
    // Ensure roles are strings, not empty, and not null/undefined, and always lowercase
    const matchRoles = rawMatchRoles
      .filter((r) => typeof r === "string" && r.trim() !== "")
      .map((r) => r.toLowerCase());
    // If no valid roles are provided, fail-closed and return 400
    if (matchRoles.length === 0) {
      debugError(conductorErrors.err92);
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err92,
      });
    }

    if (req.user.roles !== undefined && Array.isArray(req.user.roles)) {
      const foundRole = req.user.roles.find((element) => {
        if (element.org && element.role) {
          if (element.org === org && matchRoles.includes(element.role?.toLowerCase() || "")) {
            return element;
          } else if (
            element.org === "libretexts" &&
            element.role === "superadmin"
          ) {
            // OVERRIDE: SuperAdmins always have permission
            return element;
          } else if (
            element.org === process.env.ORG_ID &&
            element.role === "campusadmin"
          ) {
            // OVERRIDE: CampusAdmins always have permission in their own instance
            return element;
          }
        }
        return null;
      });
      if (foundRole !== undefined) {
        return next();
      }
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    debugError(conductorErrors.err9);
    return res.status(400).send({
      err: true,
      errMsg: conductorErrors.err9,
    });
  };
};

async function cloudflareSiteVerify(req: Request, res: Response) {
  try {
    if (!req.query.token) {
      throw new Error("No token provided");
    }

    const formdata = new FormData();
    formdata.append("secret", process.env.CLOUDFLARE_TURNSTILE_SECRET);
    formdata.append("response", req.query.token);

    const cloudflareRes = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      formdata,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!cloudflareRes.data) {
      throw new Error("No response from Cloudflare");
    }

    const success = cloudflareRes.data.success || false;

    return res.send({
      err: false,
      success,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method: string) => {
  switch (method) {
    case "fallbackAuthLogin":
      return [
        body("email", conductorErrors.err1).exists().isEmail(),
        body("password", conductorErrors.err1).exists().isLength({ min: 1 }),
      ];
    case "turnstile":
      return [
        query("token", conductorErrors.err1)
          .exists()
          .isLength({ min: 1, max: 1024 }),
      ];
  }
};

export default {
  initLogin,
  completeLogin,
  logout,
  handleSingleLogout,
  fallbackAuthLogin,
  getLibreTextsAdmins,
  getCampusAdmins,
  getUserBasicWithEmail,
  verifyRequest,
  optionalVerifyRequest,
  getUserAttributes,
  optionalGetUserAttributes,
  checkHasRole,
  checkHasRoleMiddleware,
  cloudflareSiteVerify,
  validate,
};
