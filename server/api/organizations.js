//
// LibreTexts Conductor
// organizations.js
//

'use strict';
import { body, query } from 'express-validator';
import Organization from '../models/organization.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';

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
 * Retrieves basic information about
 * all known Organizations. Method
 * should be restricted to users with
 * elevated privileges.
 */
const getAllOrganizations = (req, res) => {
    Organization.aggregate([
        {
            $match: {}
        }, {
            $project: {
                _id: 0,
                aliases: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((orgs) => {
        return res.send({
            err: false,
            orgs: orgs
        });
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};


/**
 * Updates the Organization identified
 * by @orgID in the request body. Method
 * should be restricted to users with
 * elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'updateinfo'
 */
const updateOrganizationInfo = (req, res) => {
    var updateObj = {};
    if (req.body.hasOwnProperty('coverPhoto')) updateObj.coverPhoto = req.body.coverPhoto;
    if (req.body.hasOwnProperty('largeLogo')) updateObj.largeLogo = req.body.largeLogo;
    if (req.body.hasOwnProperty('mediumLogo')) updateObj.mediumLogo = req.body.mediumLogo;
    if (req.body.hasOwnProperty('smallLogo')) updateObj.smallLogo = req.body.smallLogo;
    if (req.body.hasOwnProperty('aboutLink')) updateObj.aboutLink = req.body.aboutLink;
    if (req.body.hasOwnProperty('commonsHeader')) updateObj.commonsHeader = req.body.commonsHeader;
    if (req.body.hasOwnProperty('commonsMessage')) updateObj.commonsMessage = req.body.commonsMessage;
    if (req.body.hasOwnProperty('mainColor')) updateObj.mainColor = req.body.mainColor;
    Organization.findOneAndUpdate({ orgID: req.body.orgID }, updateObj, {
        new: true, lean: true
    }).then((updatedOrg) => {
        if (updatedOrg) {
            // prune Org info before returning
            delete updatedOrg._id;
            delete updatedOrg.createdAt;
            delete updatedOrg.updatedAt;
            delete updatedOrg.aliases;
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
                body('commonsMessage', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('mainColor', conductorErrors.err1).optional({ checkFalsy: true }).isString().isHexColor()
            ]
    }
};

export default {
    getOrganizationInfo,
    getAllOrganizations,
    updateOrganizationInfo,
    validate
}
