//
// LibreTexts Conductor
// middleware.js
//

'use strict';
import { validationResult } from 'express-validator';
import conductorErrors from './conductor-errors.js';

/**
 * Checks the results of the validation stage for an API route.
 * If there are no errors, the chain continues; otherwise, return an
 * error and the array of validation errors.
 * @param {Object} req    - the route request object
 * @param {Object} res    - the route response object
 * @param {function} next - the route's next middleware function to be ran
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
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next function in the middleware chain.
 */
const checkLibreCommons = (_req, res, next) => {
    if (process.env.ORG_ID === 'libretexts') return next();
    else {
        return res.status(403).send({
            err: true,
            msg: conductorErrors.err4
        });
    }
};


/**
 * Verifies that a request has provided a valid key from the LibreTexts API.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next function in the middleware chain.
 */
const checkLibreAPIKey = (req, res, next) => {
    if (typeof (req.headers?.authorization) === 'string') {
        const foundToken = req.headers.authorization.replace('Bearer ', '');
        if (!process.env.LIBRE_API_KEY || process.env.LIBRE_API_KEY.length === 0) {
            return res.status(500).send({ errMsg: conductorErrors.err6 });
        }
        if (process.env.LIBRE_API_KEY === foundToken) return next();
    }
    return res.status(401).send({ errMsg: conductorErrors.err5 });
};


/**
 * Verifies CORS properties (all routes).
 * 
 * @param {object} req - The route request object.
 * @param {object} res - The route response object.
 * @param {function} next - The route's next middleware function to be ran.
 */
const corsHelper = (req, res, next) => {
    let allowedOrigins = [];
    let origin = req.headers.origin;
    if (process.env.NODE_ENV === 'production') {
        allowedOrigins = String(process.env.PRODUCTIONURLS).split(',');
    } else if (process.env.NODE_ENV === 'development') {
        if (process.env.DEVELOPMENTURLS) {
            allowedOrigins = String(process.env.DEVELOPMENTURLS).split(',');
        } else {
            allowedOrigins = ['http://localhost:3000'];
        }
    }
    /* Check if origin is in the allowedOrigns array OR if the origin is from the libretexts.org domain */
    if ((allowedOrigins.indexOf(origin) > -1) || (origin && (origin.indexOf(".libretexts.org") > -1))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization, Access-Control-Allow-Credentials, X-Requested-With');
    return next();
};


/**
 * Performs security header checks and reconstructs the Authorization header from
 * cookies/credentials (all routes).
 * 
 * @param {object} req - The route request object.
 * @param {object} res - The route response object.
 * @param {function} next - The route's next middleware function to be ran.
 */
const authSanitizer = (req, res, next) => {
    if (req.method !== 'OPTIONS') {
        if (req.header('X-Requested-With') !== 'XMLHttpRequest') {
            return res.status(403).send({
                err: true,
                errMsg: "Invalid request."
            });
        }
        if (req.cookies.conductor_access !== undefined && req.cookies.conductor_signed !== undefined) {
            req.headers.authorization = req.cookies.conductor_access + '.' + req.cookies.conductor_signed;
        }
    }
    return next();
};


/**
 * Checks if a route is a member of an array of paths to exclude from the given middleware. If so,
 * the route immediately progresses to its respective middleware chain, otherwise, the middleware
 * is activated.
 * @param {string[]} paths       - an array of paths to exclude from the middleware
 * @param {function} middleware  - the middleware function to execute if the path is not excluded
 */
const middlewareFilter = (paths, middleware) => {
    return (req, res, next) => {
        if (paths.includes(req._parsedUrl.pathname)) {
            return next();
        } else {
            return middleware(req, res, next);
        }
    }
};

export default {
    checkValidationErrors,
    checkLibreCommons,
    checkLibreAPIKey,
    corsHelper,
    authSanitizer,
    middlewareFilter
}
