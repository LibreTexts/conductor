//
// LibreTexts Conductor
// auth.js

"use strict";
import express from "express";
import bcrypt from "bcryptjs";

import { body, query } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import axios from "axios";
import User from "../models/user.js";
import OAuth from "./oauth.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { assembleUrl, isEmptyString, isFullURL } from "../util/helpers.js";

const SALT_ROUNDS = 10;
const JWT_SECRET = new TextEncoder().encode(process.env.SECRETKEY);
const JWT_COOKIE_DOMAIN = (process.env.PRODUCTIONURLS || "").split(",")[0];

const oidcBase = `https://${process.env.OIDC_HOST}`;
const oidcAuth = `${oidcBase}/cas/oidc/authorize`;
const oidcToken = `${oidcBase}/cas/oidc/accessToken`;
const oidcCallbackProto =
  process.env.NODE_ENV === "production" ? "https" : "http";
const oidcCallbackHost = process.env.OIDC_CALLBACK_HOST ||
  process.env.CONDUCTOR_DOMAIN || "commons.libretexts.org";
const oidcCallback = `${oidcCallbackProto}://${oidcCallbackHost}/api/v1/oidc/libretexts`;
const oidcJWKS = `${oidcBase}/cas/oidc/jwks`;
const oidcProfile = `${oidcBase}/cas/oidc/profile`;
const oidcLogout = `${oidcBase}/cas/logout`;

/**
 * Creates a JWT for a local session.
 *
 * @param {string} uuid - The User UUID to initialize the session for.
 * @returns {string} The generated JWT.
 */
async function createSessionJWT(uuid) {
  return await new SignJWT({ uuid })
    .setSubject(uuid)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_COOKIE_DOMAIN)
    .setAudience(JWT_COOKIE_DOMAIN)
    .setExpirationTime('3d')
    .sign(JWT_SECRET);
}

/**
 * Splits a JWT for a local session into the "access" and "signed" components.
 *
 * @param sessionJWT - JWT to split into components.
 * @returns {string[]} The access and signed components.
 */
function splitSessionJWT(sessionJWT) {
  const splitJWT = sessionJWT.split('.');
  const access = splitJWT.slice(0, 2).join('.');
  const signed = splitJWT[2];
  return [access, signed];
}

/**
 * Attaches necessary cookies to the provided API response object
 * in order to create a local session.
 *
 * @param {express.Response} res - The response object to attach the session cookies to.
 * @param {string} uuid - The User UUID to initialize the session for.
 */
async function createAndAttachLocalSession(res, uuid) {
  const sessionJWT = await createSessionJWT(uuid);
  const [access, signed] = splitSessionJWT(sessionJWT);

  const prodCookieConfig = {
    secure: true,
    domain: JWT_COOKIE_DOMAIN,
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
  };
  res.cookie('conductor_access', access, {
    path: '/',
    ...(process.env.NODE_ENV === 'production' && prodCookieConfig),
  });
  res.cookie('conductor_signed', signed, {
    path: '/',
    httpOnly: true,
    ...(process.env.NODE_ENV === 'production' && prodCookieConfig),
  });
}

/**
 * Redirects the browser to CAS login screen after generating state and nonce parameters.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function initLogin(req, res) {
  const state = JSON.stringify({
    state: randomBytes(10).toString("hex"),
    orgID: process.env.ORG_ID,
    ...(req.query.redirectURI && {
      redirectURI: req.query.redirectURI,
    }),
  });
  const nonce = uuidv4();
  const nonceHash = await bcrypt.hash(nonce, SALT_ROUNDS);
  const params = new URLSearchParams({
    state,
    response_type: "code",
    client_id: process.env.OIDC_CLIENT_ID,
    redirect_uri: oidcCallback,
    nonce: nonceHash,
    scope: "openid profile email libretexts",
  });

  const prodCookieConfig = {
    sameSite: "lax",
    domain: process.env.OIDC_CALLBACK_HOST || process.env.CONDUCTOR_DOMAIN,
    secure: true,
  };
  if (process.env.CONDUCTOR_DOMAIN && process.env.CONDUCTOR_DOMAIN !== 'commons.libretexts.org') {
    const authRedirectURL = `${oidcCallbackProto}://${process.env.CONDUCTOR_DOMAIN}`;
    res.cookie("conductor_auth_redirect", authRedirectURL, {
      encode: String,
      httpOnly: true,
      ...(process.env.NODE_ENV === "production" && prodCookieConfig),
    });
  }
  res.cookie("oidc_state", state, {
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
async function completeLogin(req, res) {
  try {
    const formURLEncode = (value) =>
      encodeURIComponent(value).replace(/%20/g, "+");

    // Network agent for development
    const networkAgent =
      process.env.NODE_ENV === "production"
        ? null
        : new https.Agent({ rejectUnauthorized: false });

    // Compare state nonce
    const { oidc_state } = req.cookies;
    const { state: stateQuery } = req.query;

    let state = null;
    let stateCookie = null;
    try {
      state = JSON.parse(stateQuery);
      stateCookie = JSON.parse(oidc_state);
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
      ...(networkAgent && {
        httpsAgent: networkAgent,
      }),
    });
    const { access_token, id_token } = tokenRes?.data;
    if (!access_token || !id_token) {
      throw new Error("notokens");
    }

    // Verify ID token with CAS public key set
    const JWKS = createRemoteJWKSet(new URL(oidcJWKS), {
      ...(networkAgent && {
        agent: networkAgent,
      }),
    });
    const { payload } = await jwtVerify(id_token, JWKS, {
      issuer: `${oidcBase}/cas/oidc`,
      audience: process.env.OIDC_CLIENT_ID,
    });

    // Compare nonce hash
    const { oidc_nonce } = req.cookies;
    const { nonce } = payload;
    if (!nonce || !oidc_nonce) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err71,
      });
    }
    const nonceValid = await bcrypt.compare(oidc_nonce, nonce);
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
      httpsAgent: networkAgent,
    });
    const profileData = profileRes.data;
    const centralAttr = profileData.attributes;
    const authSub = profileData.sub || centralAttr.sub;
    const targetOrg = state.orgID || process.env.ORG_ID;

    let authUser = null;

    // Check if user exists locally and sync
    const existUser = await User.findOne({ centralID: authSub });
    if (existUser) {
      authUser = existUser;
      // Sync data that may have been changed in a delegated IdP
      let doSync = false;
      const centralToLocalAttrs = [
        ['email', 'email'],
        ['given_name', 'firstName'],
        ['family_name', 'lastName'],
        ['picture', 'avatar']
      ];
      
      for (const [central, auth] of centralToLocalAttrs) {
        if (centralAttr[central] !== authUser[auth]) {
          doSync = true;
          authUser[auth] = centralAttr[central];
        }
      }
      if (doSync) {
        await authUser.save();
      }
    }

    // User doesn't exist locally, create them now
    if (!authUser) {
      const newUser = new User({
        centralID: authSub,
        uuid: uuidv4(),
        firstName: centralAttr.given_name,
        lastName: centralAttr.family_name,
        email: centralAttr.email,
        authType: 'sso',
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
    await createAndAttachLocalSession(res, authUser.uuid);

    // Redirect user
    let redirectURL = req.hostname;
    if (req.cookies.conductor_auth_redirect) {
      redirectURL = req.cookies.conductor_auth_redirect;
    } else {
      const domain =
        process.env.NODE_ENV === "production"
          ? process.env.CONDUCTOR_DOMAIN
          : `localhost:${process.env.CLIENT_PORT || 3000}`;
      redirectURL = `${oidcCallbackProto}://${domain}`;
    }
    if (state.redirectURI && isFullURL(state.redirectURI)) {
      redirectURL = state.redirectURI;
    } else {
      // redirectURI is only a path or not provided
      redirectURL = assembleUrl([redirectURL, state.redirectURI ?? "home"]);
    }
    
    if (!state.redirectURI && isNewMember) {
      redirectURL = `${redirectURL}?newmember=true`;
    }

    return res.redirect(redirectURL);
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
async function logout(_req, res) {
  try {
    const prodCookieConfig = {
      secure: true,
      domain: JWT_COOKIE_DOMAIN,
    };
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

/**
 * Handles login using the fallback authentication method (system administrators).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function fallbackAuthLogin(req, res) {
  try {
    const formattedEmail = String(req.body.email).toLowerCase();
    const foundUser = await User.findOne({
      $and: [{ email: formattedEmail }, { authType: "traditional" }],
    });
    if (!foundUser) {
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
const getCampusAdmins = (campus) => {
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
const getUserBasicWithEmail = (uuid) => {
  return new Promise((resolve, reject) => {
    /* Validate argument and build match object */
    let matchObj = {};
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
async function verifyRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  try {
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return OAuth.authenticate(req, res, next);
    }
    const { payload } = await jwtVerify(authHeader, JWT_SECRET, {
      issuer: JWT_COOKIE_DOMAIN,
      audience: JWT_COOKIE_DOMAIN,
    });
    req.user = { decoded: payload };
    req.decoded = payload; // TODO: Remove and update other handlers
    return next();
  } catch (e) {
    let tokenExpired = false;
    if (e.code === 'ERR_JWT_EXPIRED') {
      tokenExpired = true;
    } else {
      debugError(e);
    }
    return res.status(401).send({
      err: true,
      errMsg: conductorErrors.err5,
      ...(tokenExpired && { tokenExpired }),
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
function optionalVerifyRequest(req, res, next) {
  if (req.headers.authorization) {
    return verifyRequest(req, res, next);
  }
  return next();
};

/**
 * Pulls the user record from the database and adds
 * its attributes (roles) to the
 * request object.
 * Method should only be called AFTER the 'verifyRequest'
 * method in a routing chain.
 */
const getUserAttributes = (req, res, next) => {
  if (req.user.decoded !== undefined) {
    return User.findOne({
      uuid: req.user.decoded.uuid,
    })
      .then((user) => {
        if (user) {
          if (user.roles !== undefined) {
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
 * Checks that the user has a certain role within the specified Organization.
 * NOTE: This method should NOT be used as middleware.
 * @param {Object} user - The user data object.
 * @param {String} org - The Organization identifier.
 * @param {String} role - The role identifier.
 * @returns {Boolean} True if user has role/permission, false otherwise.
 */
const checkHasRole = (user, org, role, silent = false) => {
  if (user.roles !== undefined && Array.isArray(user.roles)) {
    let foundRole = user.roles.find((element) => {
      if (element.org && element.role) {
        if (element.org === org && element.role === role) {
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
  if (!silent){
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
const checkHasRoleMiddleware = (org, role) => {
  return (req, res, next) => {
    if (req.user.roles !== undefined && Array.isArray(req.user.roles)) {
      const foundRole = req.user.roles.find((element) => {
        if (element.org && element.role) {
          if (element.org === org && element.role === role) {
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

async function cloudflareSiteVerify(req, res){
  try {
    if(!req.query.token){
      throw new Error('No token provided')
    }

    const formdata = new FormData();
    formdata.append('secret', process.env.CLOUDFLARE_TURNSTILE_SECRET);
    formdata.append('response', req.query.token);

    const cloudflareRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formdata, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    })

    if(!cloudflareRes.data){
      throw new Error('No response from Cloudflare')
    }
    
    const success = cloudflareRes.data.success || false;

    return res.send({
      err: false,
      success,
    })
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
const validate = (method) => {
  switch (method) {
    case 'fallbackAuthLogin':
      return [
        body('email', conductorErrors.err1).exists().isEmail(),
        body('password', conductorErrors.err1).exists().isLength({ min: 1 }),
      ]
    case 'turnstile': 
      return [
        query('token', conductorErrors.err1).exists().isLength({ min: 1, max: 1024 }),
      ]
  }
};

export default {
  initLogin,
  completeLogin,
  logout,
  fallbackAuthLogin,
  getLibreTextsAdmins,
  getCampusAdmins,
  getUserBasicWithEmail,
  verifyRequest,
  optionalVerifyRequest,
  getUserAttributes,
  checkHasRole,
  checkHasRoleMiddleware,
  cloudflareSiteVerify,
  validate,
};
