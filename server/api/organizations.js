//
// LibreTexts Conductor
// organizations.js
//

'use strict';
const Organization = require('../models/organization.js');
const { body, query } = require('express-validator');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');


/**
 * Retrieves basic information about
 * the Organization specified by @orgID
 * in the request query.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getinfo'
 */
const getOrganizationInfo = (req, res, _next) => {
    Organization.findOne({
        orgID: req.query.orgID
    }, {
        _id: 0,
        aliases: 0
    }).lean().then((org) => {
        if (org) {
            return res.send({
                err: false,
                ...org
            });
        } else {
            throw('notfound')
        }
    }).catch((err) => {
        if (err === 'notfound') {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11
            })
        } else {
            debugError(err);
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Updates the Organization identified
 * by @orgID in the request body. Method
 * should be restricted to users with
 * elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getinfo'
 */
const updateOrganizationInfo = (req, res) => {
    var updateObj = {};
    if (req.body.coverPhoto) updateObj.coverPhoto = req.body.coverPhoto;
    if (req.body.largeLogo) updateObj.largeLogo = req.body.largeLogo;
    if (req.body.mediumLogo) updateObj.mediumLogo = req.body.mediumLogo;
    if (req.body.smallLogo) updateObj.smallLogo = req.body.smallLogo;
    if (req.body.aboutLink) updateObj.aboutLink = req.body.aboutLink;
    if (req.body.commonsHeader) updateObj.commonsHeader = req.body.commonsHeader;
    if (req.body.commonsMessage) updateObj.commonsMessage = req.body.commonsMessage;
    Organization.findOneAndUpdate({
        orgID: req.body.orgID
    }, updateObj).then((updatedOrg) => {
        if (updatedOrg) {
            return res.send({
                err: false,
                updatedOrg: updatedOrg
            });
        } else {
            throw(new Error('notfound'));
        }
    }).catch((err) => {
        if (err.message === 'notfound') {
            return res.send({
                err: true,
                errMsg: conductorErrors.err11
            });
        } else {
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method) => {
    switch (method) {
        case 'getinfo':
            return [
                query('orgID', conductorErrors.err1).exists().isLength({ min: 2 })
            ]
        case 'updateinfo':
            return [
                body('orgID', conductorErrors.err1).exists().isLength({ min: 2 }),
                body('coverPhoto', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('largeLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('mediumLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('smallLogo', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 2 }),
                body('aboutLink', conductorErrors.err1).optional({ checkFalsy: true }).isString().isURL(),
                body('commonsHeader', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('commonsMessage', conductorErrors.err1).optional({ checkFalsy: true }).isString()
            ]
    }
};

module.exports = {
    getOrganizationInfo,
    updateOrganizationInfo,
    validate
};
