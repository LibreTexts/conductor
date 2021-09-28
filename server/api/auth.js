//
// LibreTexts Conductor
// auth.js

'use strict';
const User = require('../models/user.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { randomBytes } = require('crypto');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugServer, debugObject } = require('../debug.js');
const { isEmptyString } = require('../util/helpers.js');

const mailAPI = require('./mail.js');
const axios = require('axios');


const authURL = 'https://sso.libretexts.org/cas/oauth2.0/authorize';
const tokenURL = 'https://sso.libretexts.org/cas/oauth2.0/accessToken';
const callbackURL = 'https://commons.libretexts.org/api/v1/oauth/libretexts';
const profileURL = 'https://sso.libretexts.org/cas/oauth2.0/profile';


/**
 * Creates (Access & Signature) Conductor cookies given a JWT.
 * @param {string} token  - the full JWT
 * @returns {string[]} the generated cookies
 */
const createTokenCookies = (token) => {
    const splitToken = token.split('.');
    var accessCookie = 'conductor_access=' + splitToken[0] + '.' + splitToken[1] + '; Path=/;';
    var sigCookie = 'conductor_signed=' + splitToken[2] + '; Path=/;';
    if (process.env.NODE_ENV === 'production') {
        const domains = String(process.env.PRODUCTIONURLS).split(',');
        accessCookie += " Domain=" + domains[0] + ';';
        sigCookie += " Domain=" + domains[0] + ';';
    }
    return [accessCookie, sigCookie];
};


/**
 * Redirects the browser to the SSO authorization
 * flow initialization URI.
 */
const initSSO = (_req, res) => {
    return res.redirect(
        authURL + `?response_type=code&client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(callbackURL)}`
    );
};


/**
 * Accepts an authorization code from the
 * request's query string and exchanges it
 * via POST to CAS for an access token. The
 * access token is then used to retrieve the
 * the user's IdP profile and then locate or
 * create the user internally. Finally, a
 * standard Conductor authorization token
 * is issued.
 */
const oauthCallback = (req, res) => {
    var isNewMember = false;
    var payload = {};
    new Promise((resolve) => {
        if (req.query.code) {
            // get token from CAS using auth code
            console.log("CODE:");
            console.log(req.query.code);
            resolve(axios.post(tokenURL, {}, {
                params: {
                    'grant_type': 'authorization_code',
                    'client_id': process.env.OAUTH_CLIENT_ID,
                    'client_secret': process.env.OAUTH_CLIENT_SECRET,
                    'code': req.query.code,
                    'redirect_uri': callbackURL
                }
            }));
        } else {
            throw(new Error('nocode'));
        }
    }).then((axiosRes) => {
        if (axiosRes.data.access_token) {
            // get user profile from CAS using access token
            console.log("ACCESSDATA:");
            console.log(axiosRes.data);
            return axios.get(profileURL, {
                params: {
                    'access_token': axiosRes.data.access_token
                }
            });
        } else {
            throw(new Error('tokenfail'));
        }
    }).then((axiosRes) => {
        if (axiosRes.data && axiosRes.data.attributes) {
            console.log("USERDATA:");
            console.log(axiosRes.data);
            const attr = axiosRes.data.attributes;
            // find the user or create them if they do not exist yet
            return User.findOneAndUpdate({
                $and: [
                    { email: attr.email },
                    { authType: 'sso' }
                ]
            }, {
                $setOnInsert: {
                    uuid: uuidv4(),
                    firstName: attr.given_name,
                    lastName: attr.family_name,
                    email: attr.email,
                    avatar: attr.picture,
                    hash: '',
                    salt: '',
                    roles: [],
                    authType: 'sso'
                }
            }, {
                new: true,
                upsert: true
            });
        } else {
            throw(new Error('profilefail'));
        }
    }).then((user) => {
        if (user) {
            payload.uuid = user.uuid;
            // check if user is new organization member, update roles if so
            if (Array.isArray(user.roles)) {
                var foundRole = user.roles.find((item) => {
                    if (item.org === process.env.ORG_ID) {
                        return item;
                    }
                    return null;
                });
                if (foundRole === undefined) {
                    isNewMember = true;
                }
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
            } else {
                return {};
            }
        } else {
            throw(new Error('userretrieve'));
        }
    }).then((_updateRes) => {
        // issue auth token and return to login for entry
        jwt.sign(payload, process.env.SECRETKEY, {
            expiresIn: 86400
        },(err, token) => {
            if (!err && token !== null) {
                const cookiesToSet = createTokenCookies(token);
                res.setHeader('Set-Cookie', cookiesToSet);
                var redirectURL = '/dashboard';
                console.log("COOKIES:");
                console.log(req.cookies);
                if (req.cookies.conductor_sso_redirect) {
                    redirectURL = req.cookies.conductor_sso_redirect + '/dashboard';
                }
                if (isNewMember) redirectURL = redirectURL + '?newmember=true';
                return res.redirect(redirectURL);
            } else {
                throw(err);
            }
        });
    }).catch((err) => {
        var ssoDebug = 'SSO authentication failed — ';
        if (err.message === 'tokenfail' || err.message === 'profilefail' || err.message === 'userretrieve') {
            debugError(ssoDebug + err.message);
            return res.redirect('/login?ssofail=true');
        } else {
            debugError(err);
            return res.send({
                err: false,
                msg: conductorErrors.err6
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
    var isNewMember = false;
    var payload = {};
    const formattedEmail = String(req.body.email).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) {
            return Promise.all([bcrypt.compare(req.body.password, user.hash), user]);
        } else {
            throw(new Error('emailorpassword'));
        }
    }).then(([isMatch, user]) => {
        payload.uuid = user.uuid;
        if (isMatch) {
            if (Array.isArray(user.roles)) {
                var foundRole = user.roles.find((item) => {
                    if (item.org === process.env.ORG_ID) {
                        return item;
                    }
                    return null;
                });
                if (foundRole === undefined) {
                    isNewMember = true;
                }
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
            } else {
                return {};
            }
        } else {
            throw(new Error('emailorpassword'));
        }
    }).then((_updateRes) => {
        jwt.sign(payload, process.env.SECRETKEY, {
            expiresIn: 86400
        },(err, token) => {
            if (!err && token !== null) {
                const cookiesToSet = createTokenCookies(token);
                res.setHeader('Set-Cookie', cookiesToSet);
                return res.send({
                    err: false,
                    isNewMember: isNewMember
                });
            } else {
                throw(err);
            }
        });
    }).catch((err) => {
        var errMsg = '';
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
    var newUser = {
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
        var readyUser = new User(newUser);
        return readyUser.save();
    }).then((doc) => {
        if (doc) {
            return mailAPI.sendRegistrationConfirmation(doc.email, doc.firstName);
        } else {
            throw(new Error('notcreated'));
        }
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
        } else { // generic internal error
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
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
                throw(new Error('authtype'));
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
                throw(new Error('ratelimit'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}`;
            return mailAPI.sendPasswordReset(userEmail, userFirstName, resetLink);
        } else {
            throw(new Error('updatefailed')); // handle as generic internal error below
        }
    }).then((msg) => {
        if (msg) {
            return res.send({
                err: false,
                msg: "Password reset email has been sent."
            });
        } else {
            throw(new Error('msgfailed'));
        }
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
                } else {
                    throw(new Error('expired'));
                }
            } else {
                throw(new Error('notoken'));
            }
        } else {
            throw(new Error('notfound'));
        }
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
        } else {
            throw(new Error('updatefailed')); // handle as generic internal error below
        }
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
        } else {
            throw(new Error('notfound'));
        }
    }).then((isMatch) => {
        if (isMatch) {
            return bcrypt.genSalt(10);
        } else {
            throw(new Error('currentpass'));
        }
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
        } else {
            throw(new Error('updatefailed')) // handle as generic error below
        }
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
 * Middleware to verify the JWT provided in a
 * request's Authorization header.
 */
const verifyRequest = (req, res, next) => {
    var token = req.headers.authorization;
    try {
        const decoded = jwt.verify(token, process.env.SECRETKEY);
        req.user = {
            decoded: decoded
        };
        req.decoded = decoded; // TODO: REMOVE AND UPDATE OTHER LOGIC
        return next();
    } catch (err) {
        var response = {
            err: true,
            errMsg: conductorErrors.err5
        };
        if (err.name === 'TokenExpiredError') {
            response.tokenExpired = true;
        }
        return res.status(401).send(response);
    }
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
        User.findOne({
            uuid: req.user.decoded.uuid
        }).then((user) => {
            if (user) {
                if (user.roles !== undefined) {
                    req.user.roles = user.roles;
                }
                return next();
            } else {
                throw(new Error('nouser'));
            }
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
    } else {
        return res.status(400).send({
            err: true,
            errMsg: conductorErrors.err5
        });
    }
};


/**
 * Checks that the user has the role
 * specified in the @role parameter for
 * this organization.
 * NOTE: This method should NOT be used as
 *  middleware.
 */
const checkHasRole = (user, org, role) => {
    if ((user.roles !== undefined) && (Array.isArray(user.roles))) {
        var foundRole = user.roles.find((element) => {
            if (element.org && element.role) {
                if ((element.org === org) && (element.role === role)) {
                    return element;
                } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                    // OVERRIDE: SuperAdmins always have permission
                    return element;
                }
            }
            return null;
        });
        if (foundRole !== undefined) {
            return true;
        } else {
            return false;
        }
    } else {
        debugError(conductorErrors.err9);
        return false;
    }
};


/**
 * Checks that the user has the role
 * specified in the @role parameter.
 * Method should only be called AFTER the 'getUserAttributes'
 * method in a routing chain.
 */
const checkHasRoleMiddleware = (org, role) => {
    return (req, res, next) => {
        if ((req.user.roles !== undefined) && (Array.isArray(req.user.roles))) {
            var foundRole = req.user.roles.find((element) => {
                if (element.org && element.role) {
                    if ((element.org === org) && (element.role === role)) {
                        return element;
                    } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                        // OVERRIDE: SuperAdmins always have permission
                        return element;
                    }
                }
                return null;
            });
            if (foundRole !== undefined) {
                next();
            } else {
                return res.status(401).send({
                    err: true,
                    errMsg: conductorErrors.err8
                });
            }
        } else {
            debugError(conductorErrors.err9);
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err9
            });
        }
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
    if (typeof(password) === 'string') {
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
                body('lastName', conductorErrors.err1).exists().isLength({ min: 1, max: 100})
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
    }
}

module.exports = {
    initSSO,
    oauthCallback,
    login,
    register,
    resetPassword,
    completeResetPassword,
    changePassword,
    verifyRequest,
    getUserAttributes,
    checkHasRole,
    checkHasRoleMiddleware,
    validate
};
