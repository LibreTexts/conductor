//
// LibreTexts Conductor
// auth.js

'use strict';
const User = require('../models/user.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');
const { isEmptyString } = require('../util/helpers.js');


/**
 * Handles user login by finding a user account,
 * verifying the provided password, and issuing
 * authorization cookies.
 */
const login = (req, res, _next) => {
    const formattedEmail = String(req.body.email).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) {
            return Promise.all([bcrypt.compare(req.body.password, user.hash), user]);
        } else {
            throw(new Error("Couldn't find an account with that email."));
        }
    }).then(([isMatch, user]) => {
        const payload = {
            uuid: user.uuid
        };
        if (isMatch) {
            jwt.sign(payload, process.env.SECRETKEY, {
                expiresIn: 86400
            },(err, token) => {
                if (!err && token !== null) {
                    const splitToken = token.split('.');
                    var accessCookie = 'access_token=' + splitToken[0] + '.' + splitToken[1] + '; Path=/;';
                    var sigCookie = 'signed_token=' + splitToken[2] + '; Path=/; HttpOnly;';
                    if (process.env.NODE_ENV === 'production') {
                        const domains = String(process.env.PRODUCTIONURLS).split(',');
                        accessCookie += " Domain=" + domains[0] + ';';
                        sigCookie += " Domain=" + domains[0] + '; Secure;';
                    }
                    const cookiesToSet = [accessCookie, sigCookie];
                    res.setHeader('Set-Cookie', cookiesToSet);
                    return res.send({
                        err: false
                    });
                } else {
                    throw(err);
                }
            });
        } else {
            throw(new Error("Incorrect password."));
        }
    }).catch((err) => {
        return res.send({
            err: true,
            errMsg: err.message
        });
    });
};

/**
 * Verifies the JWT provided in a request's Authorization
 * header.
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
            errMsg: "Invalid token. Try signing out and in again."
        };
        if (err.name === 'TokenExpiredError') {
            response.tokenExpired = true;
        }
        return res.status(401).send(response);
    }
};

/**
 * Pulls the user record from the database and adds
 * its attributes (organization identifier and roles) to the
 * request object.
 */
const getUserAttributes = (req, res, next) => {
    if (req.user.decoded !== undefined) {
        User.findOne({
            uuid: req.user.decoded.uuid
        }).then((user) => {
            if (user) {
                if (!(user.org === undefined) && !(isEmptyString(user.org))) {
                    req.user.org = user.org;
                    req.user.roles = user.roles;
                    next();
                } else {
                    throw('noorg');
                }
            } else {
                throw('nouser');
            }
        }).catch((err) => {
            if (err === 'nouser') {
                return res.send(401).send({
                    err: true,
                    errMsg: conductorErrors.err7
                });
            } else if (err === 'noorg') {
                return res.send(401).send({
                    err: true,
                    errMsg: conductorErrors.err10
                })
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
 * Checks that the user has at least one of the roles
 * specified in the @roles array.
 * Method should only be called AFTER the 'getUserAttributes'
 * method in a routing chain.
 */
const checkHasRoles = (roles) => {
    return (req, res, next) => {
        if (req.user.roles !== undefined) {
            if (roles.some((role) => { return req.user.roles.includes(role) })) {
                next();
            } else {
                return res.status(401).send({
                    err: true,
                    errMsg: conductorErrors.err8
                });
            }
        } else {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err5
            });
        }
    }
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
    }
}

module.exports = {
    login,
    verifyRequest,
    getUserAttributes,
    checkHasRoles,
    validate
};
