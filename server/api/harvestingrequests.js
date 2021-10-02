//
// LibreTexts Conductor
// harvestingrequests.js
//

'use strict';
const HarvestingRequest = require('../models/harvestingrequest.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { threePartDateStringValidator } = require('../validators.js');
const { debugError } = require('../debug.js');

/**
 * Creates and saves a new HarvestingRequest model with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'addRequest'
 */
const addRequest = (req, res) => {
    if (!isEmptyString(req.body.dateIntegrate)) { // validate and convert to Date object
        const rawDI = String(req.body.dateIntegrate).split('-');
        const dateIntegrate = new Date(rawDI[2], rawDI[0]-1, rawDI[1], 0, 0, 0);
        req.body.dateIntegrate = dateIntegrate;
    }
    var newRequest = new HarvestingRequest(req.body);
    newRequest.save().then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "Harvesting request succesfully submitted."
            });
        } else {
            throw(conductorErrors.err3);
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Returns Harvesting Requests within a given date range.
 * VALIDATION: 'getRequests'
 */
const getRequests = (req, res) => {
    try {
        var sComp = String(req.query.startDate).split('-');
        var eComp = String(req.query.endDate).split('-');
        var sM, sD, sY;
        var eM, eD, eY;
        if ((sComp.length == 3) && (eComp.length == 3)) {
            sM = parseInt(sComp[0]) - 1;
            sD = parseInt(sComp[1]);
            sY = parseInt(sComp[2]);
            eM = parseInt(eComp[0]) - 1;
            eD = parseInt(eComp[1]);
            eY = parseInt(eComp[2]);
        }
        if (!isNaN(sM) && !isNaN(sD) && !isNaN(sY) && !isNaN(eM) && !isNaN(eD) && !isNaN(eY)) {
            var start = new Date(sY, sM, sD);
            start.setHours(0,0,0,0);
            var end = new Date(eY, eM, eD);
            end.setHours(23,59,59,999);
            HarvestingRequest.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: start,
                            $lte: end
                        }
                    }
                }, {
                    $project: {
                        _id: 0
                    }
                }, {
                    $sort: {
                        createdAt: 1
                    }
                }
            ]).then((requests) => {
                return res.status(200).send({
                    err: false,
                    requests: requests
                });
            }).catch((err) => {
                debugError(err);
                return res.status(500).send({
                    err: true,
                    errMsg: conductorErrors.err6
                });
            });
        } else {
            throw('timeparse-err')
        }
    } catch (err) {
        debugError(err);
        return res.status(400).send({
            err: true,
            errMsg: emmErrors.err3
        });
    }
};

const validate = (method) => {
    switch (method) {
        case 'addRequest':
            return [
                body('email', conductorErrors.err1).exists().isEmail(),
                body('title', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('library', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('license', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('dateIntegrate').optional({ checkFalsy: true }).custom(threePartDateStringValidator)
            ]
        case 'getRequests':
            return [
                query('startDate', conductorErrors.err1).exists().custom(threePartDateStringValidator),
                query('endDate', conductorErrors.err1).exists().custom(threePartDateStringValidator)
            ]
    }
};

module.exports = {
    addRequest,
    getRequests,
    validate
};
