//
// LibreTexts Conductor
// middleware.js
//

'use strict';
const { validationResult } = require('express-validator');
const conductorErrors = require('./conductor-errors.js');


/**
 * Checks the results of the validation stage for an API route.
 * If there are no errors, the chain continues; otherwise, return an
 * error and the array of validation errors.
 */
const checkValidationErrors = (req, res, next) => {
    const validationErrors = validationResult(req);
    if (validationErrors.isEmpty()) {
        next();
    } else {
        return res.status(400).send({
            err: true,
            errMsg: conductorErrors.err2,
            errors: validationErrors.array()
        });
    }
};


/**
 * Checks that the route is being run on a LibreCommons server,
 * verified via an environment variable.
 */
const checkLibreCommons = (_req, res, next) => {
    if (process.env.ORG_ID === 'libretexts') {
            next();
    } else {
        return res.status(403).send({
            err: true,
            msg: conductorErrors.err4
        });
    }
};


/**
 * Verifies CORS properties (all routes)
 */
const corsHelper = (req, res, next) => {
    var allowedOrigins = [];
    var origin = req.headers.origin;
    if (process.env.NODE_ENV === 'production') {
        allowedOrigins = String(process.env.PRODUCTIONURLS).split(',');
    } else if (process.env.NODE_ENV === 'development') {
        allowedOrigins = ['http://localhost:3000'];
    }
    if (allowedOrigins.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Content-Security-Policy', "default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval' 'unsafe-dynamic'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob: ; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline'; frame-ancestors * data: blob: 'unsafe-inline';");
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization, Access-Control-Allow-Credentials, X-Requested-With');
    return next();
};


/**
 * Performs security header checks and reconstructs the
 * Authorization header from cookies/credentials (all routes).
 */
const authSanitizer = (req, res, next) => {
    if (req.method !== 'OPTIONS') {
        if (req.header('X-Requested-With') !== 'XMLHttpRequest') {
            return res.status(403).send({
                err: true,
                errMsg: "Invalid request."
            });
        }
        if (req.cookies.access_token !== undefined && req.cookies.signed_token !== undefined) {
            req.headers.authorization = req.cookies.access_token + '.' + req.cookies.signed_token;
        }
    }
    return next();
};

module.exports = {
    checkValidationErrors,
    checkLibreCommons,
    corsHelper,
    authSanitizer
}
