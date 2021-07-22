//
// LibreTexts Conductor
// auth.js

'use strict';
const User = require('../models/user.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');

const login = (req, res, next) => {
    var response = {};
    const emailReq = req.body.email;
    const passwordReq = req.body.password;
    if (emailReq === "" || passwordReq === "") {
        response.err = true;
        response.errmsg = "Empty fields.";
        return res.send(response);
    }
    const formattedEmail = String(emailReq).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) {
            return Promise.all([bcrypt.compare(passwordReq, user.hash), user]);
        } else {
            throw("Couldn't find an account with that email.");
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
            throw("Incorrect password.");
        }
    }).catch((err) => {
        response.err = true;
        response.errMsg = err;
        return res.send(response);
    });
};

const verifyRequest = (req, res, next) => {
    var token = req.headers.authorization;
    try {
        const decoded = jwt.verify(token, process.env.SECRETKEY);
        req.decoded = decoded;
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

const checkHasRoles = (roles) => {
    return (req, res, next) => {
        if (req.decoded !== undefined) {
            User.findOne({
                uuid: req.decoded.uuid
            }).then((user) => {
                if (user) {
                    if (roles.some((role) => { return user.roles.includes(role) })) {
                        req.roles = user.roles;
                        next();
                    } else {
                        return res.status(401).send({
                            err: true,
                            errMsg: conductorErrors.err8
                        });
                    }
                } else {
                    throw('nouser');
                }
            }).catch((err) => {
                if (err.toString() === 'nouser') {
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
    }
};

module.exports = {
    login,
    verifyRequest,
    checkHasRoles
};
