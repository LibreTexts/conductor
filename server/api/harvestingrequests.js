//
// LibreTexts Conductor
// harvestingrequests.js
//

'use strict';
const HarvestingRequest = require('../models/harvestingrequest.js');
const { body, validationResult } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/Helpers.js');
const { threePartDateStringValidator } = require('../validators.js');

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
        return res.send({
            err: true,
            errMsg: err.toString()
        });
    });
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
    }
};

module.exports = {
    addRequest,
    validate
};
