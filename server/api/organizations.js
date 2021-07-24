//
// LibreTexts Conductor
// organizations.js
//

'use strict';
const User = require('../models/user.js');

const Organization = require('../models/organization.js');
const { body, param } = require('express-validator');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');


const getOrganizationInfo = (req, res, _next) => {
    Organization.findOne({
        orgID: req.params.orgID
    }).then((org) => {
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

const validate = (method) => {
    switch (method) {
        case 'getinfo':
            return [
                param('orgID', err1).exists().isLength({ min: 2 })
            ]
    }
};

module.exports = {
    getOrganizationInfo,
    validate
};
