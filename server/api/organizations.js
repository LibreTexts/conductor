//
// LibreTexts Conductor
// organizations.js
//

'use strict';
const User = require('../models/user.js');

const Organization = require('../models/organization.js');
const { body, query } = require('express-validator');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');


const getOrganizationInfo = (req, res, _next) => {
    Organization.findOne({
        orgID: req.query.orgID
    }, {
        _id: 0
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

const validate = (method) => {
    switch (method) {
        case 'getinfo':
            return [
                query('orgID', conductorErrors.err1).exists().isLength({ min: 2 })
            ]
    }
};

module.exports = {
    getOrganizationInfo,
    validate
};
