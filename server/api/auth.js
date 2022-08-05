//
// LibreTexts Conductor
// auth.js

'use strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import cryptoRandomString from 'crypto-random-string';
import axios from 'axios';
import AccessToken from '../models/accesstoken.js';
import APIClient from '../models/apiclient.js';
import AuthCode from '../models/authcode.js';
import User from '../models/user.js';
import conductorErrors from '../conductor-errors.js';
import { debugError, debugServer } from '../debug.js';
import { isEmptyString, isValidDateObject, computeDateDifference } from '../util/helpers.js';
import mailAPI from './mail.js';

const tokenTime = 86400;
const authURL = 'https://sso.libretexts.org/cas/oauth2.0/authorize';
const tokenURL = 'https://sso.libretexts.org/cas/oauth2.0/accessToken';
const callbackURL = 'https://commons.libretexts.org/api/v1/oauth/libretexts';
const profileURL = 'https://sso.libretexts.org/cas/oauth2.0/profile';

const AUTH_CODE_LIFETIME = 30; // seconds
const ACCESS_TOKEN_LIFETIME = 43200; // seconds

/**
 * Creates (Access & Signature) Conductor cookies given a JWT.
 * @param {String} token  - the full JWT
 * @returns {String[]} the generated cookies
 */
const createTokenCookies = (token) => {
    const splitToken = token.split('.');
    var accessCookie = 'conductor_access=' + splitToken[0] + '.' + splitToken[1] + '; Path=/;';
    var sigCookie = 'conductor_signed=' + splitToken[2] + '; Path=/;';
    if (process.env.NODE_ENV === 'production') {
        const domains = String(process.env.PRODUCTIONURLS).split(',');
        accessCookie += " Domain=" + domains[0] + ';';
        sigCookie += " Domain=" + domains[0] + '; HttpOnly;';
    }
    return [accessCookie, sigCookie];
};


/**
 * Redirects the browser to the SSO authorization
 * flow initialization URI.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const initSSO = (_req, res) => {
    return res.redirect(
        authURL + `?response_type=code&client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackURL)}`
    );
};


/**
 * Accepts an authorization code from the request's query string and exchanges it
 * via POST to CAS for an access token. The access token is then used to retrieve the
 * the user's IdP profile and then locate or create the user internally. Finally, a
 * standard Conductor authorization token is issued.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const oauthCallback = (req, res) => {
    let payload = {};
    let ssoAttr = null;
    let doCreate = false;
    let isNewMember = true;
    let avatar = '/mini_logo.png';
    let user = {};
    let formattedEmail = '';
    return new Promise((resolve, reject) => {
        if (req.query.code) {
            // get token from CAS using auth code
            resolve(axios.post(tokenURL, {}, {
                params: {
                    'grant_type': 'authorization_code',
                    'client_id': process.env.OAUTH_CLIENT_ID,
                    'client_secret': process.env.OAUTH_CLIENT_SECRET,
                    'code': req.query.code,
                    'redirect_uri': callbackURL
                }
            }));
        }
        reject(new Error('nocode'));
    }).then((axiosRes) => {
        if (axiosRes.data.access_token) {
            // get user profile from CAS using access token
            return axios.get(profileURL, {
                params: {
                    'access_token': axiosRes.data.access_token
                }
            });
        }
        throw(new Error('tokenfail'));
    }).then((axiosRes) => {
        ssoAttr = axiosRes.data?.attributes;
        if (typeof (ssoAttr) === 'object' && typeof (ssoAttr.principalID) === 'string') {
            if (ssoAttr.hasOwnProperty('picture') && !isEmptyString(ssoAttr.picture)) {
                avatar = ssoAttr.picture;
            }
            // Check if user already exists
            formattedEmail = String(ssoAttr.principalID).toLowerCase();
            return User.findOne({ email: formattedEmail }).lean(); // TODO: use 'sub' field as principal key
        }
        throw(new Error('profilefail'));
    }).then((userData) => {
        if (userData) { // user exists
            if (userData.authType === 'sso') {
                user = userData;
                payload.uuid = userData.uuid;
                let updateInfo = {
                    firstName: ssoAttr.given_name,
                    lastName: ssoAttr.family_name,
                    authSub: ssoAttr.sub
                };
                // don't update from IdP if a Conductor-specific avatar is set
                if (userData.customAvatar !== true) updateInfo.avatar = avatar; 
                // sync info
                return User.updateOne({ uuid: userData.uuid }, updateInfo);
            }
            throw(new Error('authtype'));
        } else { // create user
            let newUUID = uuidv4();
            user.uuid = newUUID;
            payload.uuid = newUUID;
            let newUser = new User({
                uuid: newUUID,
                firstName: ssoAttr.given_name,
                lastName: ssoAttr.family_name,
                email: formattedEmail,
                avatar: avatar,
                hash: '',
                salt: '',
                roles: [],
                authType: 'sso',
                authSub: ssoAttr.sub
            });
            doCreate = true;
            return newUser.save();
        }
    }).then((userRes) => {
        if ((!doCreate && userRes.matchedCount === 1) || (doCreate && typeof(userRes) === 'object')) {
            // check if user is new organization member, update roles if so
            if (Array.isArray(user.roles)) {
                let foundRole = user.roles.find(item => item.org === process.env.ORG_ID);
                if (typeof(foundRole) !== undefined) isNewMember = false;
            }
            if (isNewMember) {
                return User.updateOne({ uuid: user.uuid }, {
                    $push: {
                        roles: {
                            org: process.env.ORG_ID,
                            role: 'member'
                        }
                    }
                });
            }
            return {};
        }
        throw(new Error('userupdatecreate'));
    }).then((_updateRes) => {
        // issue auth token and return to login for entry
        let token = jwt.sign(payload, process.env.SECRETKEY, { expiresIn: tokenTime });
        if (typeof(token) === 'string') {
            res.setHeader('Set-Cookie', createTokenCookies(token));
            let redirectURL = '/home';
            if (req.cookies.conductor_sso_redirect) {
                redirectURL = req.cookies.conductor_sso_redirect + '/home';
            }
            if (isNewMember) redirectURL = redirectURL + '?newmember=true';
            return res.redirect(redirectURL);
        }
        throw(new Error('tokensign'));
    }).catch((err) => {
        var ssoDebug = 'SSO authentication failed — ';
        if (err.message === 'tokenfail' || err.message === 'profilefail'
            || err.message === 'userretrieve' || err.message === 'userupdatecreate') {
            debugError(ssoDebug + err.message);
            return res.redirect('/login?ssofail=true');
        } else {
            debugError(err);
            let errMsg = conductorErrors.err6;
            if (err.message === 'authtype') errMsg = conductorErrors.err46;
            return res.send({
                err: false,
                msg: errMsg
            });
        }
    });
};


/**
 * Handles user login by finding a user account,
 * verifying the provided password, and issuing
 * authorization cookies.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'login'
 */
const login = (req, res, _next) => {
    var isNewMember = true;
    var payload = {};
    const formattedEmail = String(req.body.email).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) return Promise.all([bcrypt.compare(req.body.password, user.hash), user]);
        throw(new Error('emailorpassword'));
    }).then(([isMatch, user]) => {
        payload.uuid = user.uuid;
        if (isMatch) {
            if (Array.isArray(user.roles)) {
                let foundRole = user.roles.find(item => item.org === process.env.ORG_ID);
                if (foundRole !== undefined) isNewMember = false;
            }
            if (isNewMember) {
                return User.updateOne({ uuid: user.uuid }, {
                    $push: {
                        roles: {
                            org: process.env.ORG_ID,
                            role: 'member'
                        }
                    }
                });
            }
            return {};
        }
        throw(new Error('emailorpassword'));
    }).then((_updateRes) => {
        let token = jwt.sign(payload, process.env.SECRETKEY, { expiresIn: tokenTime });
        if (typeof(token) === 'string') {
            res.setHeader('Set-Cookie', createTokenCookies(token));
            return res.send({
                err: false,
                isNewMember: isNewMember
            });
        }
        throw(new Error('tokensign'))
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'emailorpassword') {
            errMsg = conductorErrors.err12;
        } else {
            debugError(err);
            errMsg = conductorErrors.err6;
        }
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Handles user registration by creating a User
 * model with the information in the request
 * body and hashing the provided password.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'register'
 */
const register = (req, res) => {
    const successMsg = "Succesfully registered user.";
    const formattedEmail = String(req.body.email).toLowerCase();
    let newUser = {
        uuid: uuidv4(),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: formattedEmail,
        avatar: '/mini_logo.png',
        hash: '',
        salt: '',
        roles: [],
        authType: 'traditional'
    };
    bcrypt.genSalt(10).then((salt) => {
        newUser.salt = salt;
        return bcrypt.hash(req.body.password, salt);
    }).then((hash) => {
        newUser.hash = hash;
        let readyUser = new User(newUser);
        return readyUser.save();
    }).then((doc) => {
        if (doc) return mailAPI.sendRegistrationConfirmation(doc.email, doc.firstName);
        throw (new Error('notcreated'));
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: successMsg
        });
    }).catch((err) => {
        if (err.status === 400) { // Mailgun failed, handle silently
            debugServer('Failed to send user registration welcome email.');
            return res.send({
                err: false,
                msg: successMsg
            });
        }
        // other internal errors
        let errMsg = conductorErrors.err6;
        if (err.message === 'notcreated') errMsg = conductorErrors.err3;
        else if (err.code === 11000) errMsg = conductorErrors.err47;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Searches for the user identified by the @email
 * in the request body. If the user is found,
 * a reset password link is generated and sent using
 * the mailAPI.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'resetPassword'
 */
const resetPassword = (req, res) => {
    var userEmail = '';
    var userFirstName = '';
    var resetToken = '';
    const formattedEmail = String(req.body.email).toLowerCase();
    User.findOne({
        email: formattedEmail
    }).then((user) => {
        if (user) {
            if (user.authType !== 'traditional') { // cannot reset passwords for SSO users
                throw (new Error('authtype'));
            }
            const currentTime = new Date();
            var allowedAttempt = true;
            if (user.lastResetAttempt) {
                const lastResetTime = new Date(user.lastResetAttempt);
                const minutesSince = (currentTime - lastResetTime) / (1000 * 60);
                if (minutesSince < 2) {
                    allowedAttempt = false;
                }
            }
            if (allowedAttempt) {
                userEmail = user.email,
                    userFirstName = user.firstName;
                const cryptoBuf = randomBytes(16);
                resetToken = cryptoBuf.toString('hex');
                const tokenExpiry = new Date(currentTime.getTime() + (30 * 60000)); // token expires after 30 minutes
                return User.updateOne({
                    email: userEmail
                }, {
                    lastResetAttempt: currentTime,
                    resetToken: resetToken,
                    tokenExpiry: tokenExpiry
                });
            } else {
                throw (new Error('ratelimit'));
            }
        } else {
            throw (new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            const resetLink = `https://commons.libretexts.org/resetpassword?token=${resetToken}`;
            return mailAPI.sendPasswordReset(userEmail, userFirstName, resetLink);
        }
        throw (new Error('updatefailed')); // handle as generic internal error below
    }).then((msg) => {
        if (msg) {
            return res.send({
                err: false,
                msg: "Password reset email has been sent."
            });
        }
        throw (new Error('msgfailed'));
    }).catch((err) => {
        var errMsg = '';
        if (err.message === 'notfound') {
            errMsg = conductorErrors.err7;
        } else if (err.message === 'authtype') {
            errMsg = conductorErrors.err20;
        } else if (err.message === 'ratelimit') {
            errMsg = conductorErrors.err17;
        } else {
            debugError(err);
            errMsg = conductorErrors.err6;
        }
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Searches for the user currently holding
 * the @token in the request body. If the user is found,
 * the token expiration date is checked. If the token is
 * still valid, the new password is hashed and saved
 * to the database.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'completeResetPassword'
 */
const completeResetPassword = (req, res) => {
    var userUUID = '';
    var newSalt = '';
    const currentTime = new Date();
    User.findOne({
        resetToken: req.body.token
    }).then((user) => {
        if (user) {
            if (user.tokenExpiry) {
                const expiryDate = new Date(user.tokenExpiry);
                if (expiryDate > currentTime) {
                    userUUID = user.uuid;
                    return bcrypt.genSalt(10);
                }
                throw (new Error('expired'));
            }
            throw (new Error('notoken'));
        }
        throw (new Error('notfound'));
    }).then((salt) => {
        newSalt = salt;
        return bcrypt.hash(req.body.password, salt);
    }).then((hash) => {
        return User.updateOne({ uuid: userUUID }, {
            hash: hash,
            salt: newSalt,
            lastResetAttempt: currentTime,
            resetToken: '',
            tokenExpiry: currentTime
        });
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: "Password updated successfully."
            });
        }
        throw (new Error('updatefailed')); // handle as generic internal error below
    }).catch((err) => {
        var errMsg = '';
        if (err.message === 'notfound') { // couldn't find user via token, likely already used
            errMsg = conductorErrors.err21;
        } else if (err.message === 'notoken') {
            errMsg = conductorErrors.err18;
        } else if (err.message === 'expired') {
            errMsg = conductorErrors.err19;
        } else {
            debugError(err);
            errMsg = conductorErrors.err6;
        }
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Searches for the user identified by the uuid in the request
 * authorization token, then attempts to match the @currentPassword
 * in the request body against their currently stored password.
 * If passwords match, the @newPassword in the request body
 * is hashed and stored in the User's record.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'changePassword'
 */
const changePassword = (req, res) => {
    var newSalt = '';
    var userEmail = '';
    var userFirstName = '';
    var successMsg = "Password updated successfully.";
    User.findOne({ uuid: req.decoded.uuid }).then((user) => {
        if (user) {
            userEmail = user.email;
            userFirstName = user.firstName;
            return bcrypt.compare(req.body.currentPassword, user.hash);
        }
        throw (new Error('notfound'));
    }).then((isMatch) => {
        if (isMatch) return bcrypt.genSalt(10);
        throw (new Error('currentpass'));
    }).then((salt) => {
        newSalt = salt;
        return bcrypt.hash(req.body.newPassword, salt);
    }).then((hash) => {
        return User.updateOne({ uuid: req.decoded.uuid }, {
            salt: newSalt,
            hash: hash
        });
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return mailAPI.sendPasswordChangeNotification(userEmail, userFirstName);
        }
        throw (new Error('updatefailed')) // handle as generic error below
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: successMsg
        });
    }).catch((err) => {
        if (err.status === 400) { // Mailgun failed, handle silently
            debugServer('Failed to send password change notification email.');
            return res.send({
                err: false,
                msg: successMsg
            });
        } else { // other errors
            var errMsg = '';
            if (err.message === 'notfound') {
                errMsg = conductorErrors.err7;
            } else if (err.message === 'currentpass') {
                errMsg = conductorErrors.err23;
            } else {
                debugError(err);
                errMsg = conductorErrors.err6;
            }
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
    });
};


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
            $or: [
                { role: 'superadmin' },
                { role: 'campusadmin' }
            ]
        };
    } else {
        roleMatch = { role: 'superadmin' }; 
    }
    return User.aggregate([{
        $match: {
            roles: {
                $elemMatch: {
                    $and: [
                        { org: 'libretexts' },
                        { ...roleMatch }
                    ]
                }
            }
        }
    }, {
        $project: {
            _id: 0,
            uuid: 1,
            email: 1,
            firstName: 1,
            lastName: 1
        }
    }]).then((admins) => {
        return admins;
    }).catch((err) => {
        throw (err);
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
            resolve(User.aggregate([{
                $match: {
                    roles: {
                        $elemMatch: {
                            $and: [{
                                org: campus
                            }, {
                                role: 'campusadmin'
                            }]
                        }
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    uuid: 1,
                    email: 1,
                    firstName: 1,
                    lastName: 1
                }
            }]));
        } else {
            reject('missingcampus');
        }
    }).then((admins) => {
        return admins;
    }).catch((err) => {
        throw (err);
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
        if (typeof (uuid) === 'string') {
            matchObj.uuid = uuid;
        } else if (typeof (uuid) === 'object' && Array.isArray(uuid)) {
            matchObj.uuid = {
                $in: uuid
            };
        } else reject('missingarg');
        /* Lookup user(s) */
        resolve(User.aggregate([{
            $match: matchObj
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                email: 1,
                firstName: 1,
                lastName: 1
            }
        }]));
    }).then((users) => {
        return users;
    }).catch((err) => {
        throw (err);
    });
};

/**
 * Generates and saves an AuthCode for a given API Client on behalf of a user.
 *
 * @param {string} apiClientID - The internal API Client identifier.
 * @param {string} user - The user's UUID.
 * @returns {Promise<[string,number]|null>} The generated AuthCode and lifetime (in seconds),
 *  or null if error encountered.
 */
async function createAuthCode(apiClientID, user) {
  if (
    typeof (apiClientID) !== 'string'
    || apiClientID.length < 1
    || typeof (user) !== 'string'
    || user.length < 1
  ) {
    return null;
  }
  try {
    const code = cryptoRandomString({ length: 6, type: 'base64' });
    const authCode = new AuthCode({
      issued: new Date(),
      expiresIn: AUTH_CODE_LIFETIME,
      code,
      apiClientID,
      user,
    });
    await authCode.save();
    updateAPIClientLastUsed(apiClientID);
    return [code, AUTH_CODE_LIFETIME];
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Exchanges an AuthCode for an AccessToken to authenticate further requests from an API Client
 * on behalf of a user.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function createAccessToken(req, res) {
  try {
    const { clientID, clientSecret, code } = req.body;

    /* Find API Client */
    const apiClient = await APIClient.findOne({ clientID }).lean();
    if (!apiClient) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11
      });
    }

    /* Validate API Client Secret */
    const match = await bcrypt.compare(clientSecret, apiClient.clientSecret);
    if (!match) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err67,
      });
    }

    /* Validate provided AuthCode */
    const authCode = await AuthCode.findOne({ code }).lean();
    if (!authCode) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (!isValidDateObject(authCode.issued) || !authCode.hasOwnProperty('expiresIn')) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err68,
      });
    }
    if (computeDateDifference(authCode.issued, new Date()) > (authCode.expiresIn * 1000)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err69,
      });
    }

    /* Create AccessToken */
    const token = cryptoRandomString({ length: 32, type: 'base64' });
    const expiresIn = ACCESS_TOKEN_LIFETIME;
    const accessToken = new AccessToken({
      user: authCode.user,
      apiClientID: apiClient.clientID,
      issued: new Date(),
      expiresIn,
      token,
    });
    await accessToken.save();

    await AuthCode.deleteOne({ code });
    updateAPIClientLastUsed(apiClient.clientID);
    return res.send({
      err: false,
      msg: 'Successfully generated Access Token!',
      accessToken: token,
      expiresIn,
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
 * Updates an API Client's key database entry with the current datetime in its 'lastUsed' field.
 *
 * @param {string} clientID - Internal identifier of the API Client.
 * @returns {void}
 */
function updateAPIClientLastUsed(clientID) {
  if (typeof (clientID) !== 'string') {
    return;
  }
  APIClient.updateOne({ clientID }, { lastUsed: new Date() }).catch((e) => {
    console.warn('Error updating APIClient Last Used time:');
    console.warn(e);
  });
}

/**
 * Verifies an Access Token provided in a request from an API Client on behalf of a user.
 *
 * @param {express.Request} req - Incoming request object, with token in authorization header.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next function to run in the middleware chain.
 */
async function verifyAPIClientRequest(req, res, next) {
  try {
    const exprInvalidRes = { err: true, errMsg: conductorErrors.err70 };
    const token = req.headers.authorization.replace('Bearer ', '');

    const accessToken = await AccessToken.findOne({ token }).lean();
    if (!accessToken) {
      return res.status(401).send(exprInvalidRes);
    }

    /* Validate access token */
    if (!isValidDateObject(accessToken.issued) || !accessToken.hasOwnProperty('expiresIn')) {
      return res.status(401).send({
        err: true,
        errMsg: conductorErrors.err68,
      });
    }
    if (computeDateDifference(accessToken.issued, new Date()) > (accessToken.expiresIn * 1000)) {
      return res.status(401).send(exprInvalidRes);
    }

    /* Retrieve API Client info */
    const apiClient = await APIClient.findOne({ clientID: accessToken.apiClientID }).lean();
    if (!apiClient) {
      return res.status(401).send(exprInvalidRes);
    }
    const { clientID, scopes } = apiClient;

    /* Perform HIGH-LEVEL check on scope access */
    if (!Array.isArray(scopes)) {
      return res.status(401).send(exprInvalidRes);
    }
    const path = req.route.path;
    const resourcePath = path.split('/').filter((part) => part.length !== 0);
    const resourcePrefix = resourcePath[0];

    const hasResourcePrefixScope = () => {
      const foundScope = scopes.find((entry) => entry.startsWith(resourcePrefix));
      if (foundScope) {
        return true;
      }
      return false;
    };
    if (!hasResourcePrefixScope()) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    /* Save information to request object for later use */
    req.user = {
      decoded: { uuid: accessToken.user },
    };
    req.decoded = {
      uuid: accessToken.user,
    }; // TODO: Remove and update other handlers
    req.apiClient = {
      clientID,
      scopes,
    };

    updateAPIClientLastUsed(clientID);
    return next();
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Verifies the JWT provided by a user or a Bearer access token provided by
 * an API client in the Authorization header.
 *
 * @param {express.Request} req - Incoming request object, with cookies already processed.
 * @param {express.Response} res - Outgoing response object.
 * @param {express.NextFunction} next - The next function to run in the middleware chain.
 */
function verifyRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  try {
    if (typeof (authHeader) === 'string' && authHeader.startsWith('Bearer ')) {
      return verifyAPIClientRequest(req, res, next);
    }
    const decoded = jwt.verify(authHeader, process.env.SECRETKEY);
    req.user = { decoded };
    req.decoded = decoded; // TODO: Remove and update other handlers
    return next();
  } catch (e) {
    let tokenExpired = false;
    if (e.name === 'TokenExpiredError') {
      tokenExpired = true;
    } else {
      debugError(e);
    }
    return res.status(401).send({
      err: true,
      errMsg: conductorErrors.err5,
      ...(tokenExpired && { tokenExpired }),
    })
  }
}

/**
 * Middleware to optionally verify a request if authorization
 * headers are present.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 * @param {Object} next - the next function in the middleware chain.
 */
const optionalVerifyRequest = (req, res, next) => {
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
            uuid: req.user.decoded.uuid
        }).then((user) => {
            if (user) {
                if (user.roles !== undefined) {
                    req.user.roles = user.roles;
                }
                return next();
            }
            throw (new Error('nouser'));
        }).catch((err) => {
            if (err.message === 'nouser') {
                return res.send(401).send({
                    err: true,
                    errMsg: conductorErrors.err7
                });
            } else {
                debugError(err);
                return res.status(500).send({
                    err: true,
                    errMsg: conductorErrors.err6
                });
            }
        });
    }
    return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err5
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
const checkHasRole = (user, org, role) => {
    if ((user.roles !== undefined) && (Array.isArray(user.roles))) {
        let foundRole = user.roles.find((element) => {
            if (element.org && element.role) {
                if ((element.org === org) && (element.role === role)) {
                    return element;
                } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                    // OVERRIDE: SuperAdmins always have permission
                    return element;
                } else if ((element.org === process.env.ORG_ID) && (element.role === 'campusadmin')) {
                    // OVERRIDE: CampusAdmins always have permission in their own instance
                    return element;
                }
                return null;
            }
        });
        if (foundRole !== undefined) return true;
        return false;
    }
    debugError(conductorErrors.err9);
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
        if ((req.user.roles !== undefined) && (Array.isArray(req.user.roles))) {
            const foundRole = req.user.roles.find((element) => {
                if (element.org && element.role) {
                    if ((element.org === org) && (element.role === role)) {
                        return element;
                    } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                        // OVERRIDE: SuperAdmins always have permission
                        return element;
                    } else if ((element.org === process.env.ORG_ID) && (element.role === 'campusadmin')) {
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
                errMsg: conductorErrors.err8
            });
        }
        debugError(conductorErrors.err9);
        return res.status(400).send({
            err: true,
            errMsg: conductorErrors.err9
        });
    }
};


/**
 * Accepts a string, @password, and validates
 * it against Conductor password standards.
 * Returns a boolean:
 *  TRUE:  Password meets standards
 *  FALSE: Password does not meet standards
 *         or is not a string
 */
const passwordValidator = (password) => {
    if (typeof (password) === 'string') {
        if (password.length > 8) { // password should be 8 characters or longer
            if (/\d/.test(password)) { // password should contain at least one number
                return true;
            }
        }
    }
    return false;
};


/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method) => {
  switch (method) {
    case 'login':
      return [
        body('email', conductorErrors.err1).exists().isEmail(),
        body('password', conductorErrors.err1).exists().isLength({ min: 1 }),
      ]
    case 'register':
      return [
        body('email', conductorErrors.err1).exists().isEmail(),
        body('password', conductorErrors.err1).exists().isString().custom(passwordValidator),
        body('firstName', conductorErrors.err1).exists().isLength({ min: 2, max: 100 }),
        body('lastName', conductorErrors.err1).exists().isLength({ min: 1, max: 100 })
      ]
    case 'resetPassword':
      return [
        body('email', conductorErrors.err1).exists().isEmail()
      ]
    case 'completeResetPassword':
      return [
        body('token', conductorErrors.err1).exists().isString(),
        body('password', conductorErrors.err1).exists().isString().custom(passwordValidator)
      ]
    case 'changePassword':
      return [
        body('currentPassword', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
        body('newPassword', conductorErrors.err1).exists().isString().custom(passwordValidator)
      ]
    case 'createAccessToken':
      return [
        body('clientID', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 100 }),
        body('clientSecret', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 100 }),
        body('code', conductorErrors.err1).exists().isString().isLength({ min: 6, max: 6 }),
      ]
  }
}

export default {
    initSSO,
    oauthCallback,
    login,
    register,
    resetPassword,
    completeResetPassword,
    changePassword,
    getLibreTextsAdmins,
    getCampusAdmins,
    getUserBasicWithEmail,
    createAuthCode,
    createAccessToken,
    verifyRequest,
    optionalVerifyRequest,
    getUserAttributes,
    checkHasRole,
    checkHasRoleMiddleware,
    validate
}
