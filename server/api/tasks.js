//
// LibreTexts Conductor
// tasks.js
//

'use strict';
const User = require('../models/user.js');
const Task = require('../models/task.js');
const Project = require('../models/project.js');
const Message = require('../models/message.js');
const { body, query } = require('express-validator');
const b62 = require('base62-random');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');

const mailAPI = require('./mail.js');


/**
 * Creates a new Task within the specified Project using the values specified in the
 * request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createTask'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createTask = (req, res) => {
};


/**
 * Validate a provided Task Status option during creation.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateCreateStatus = (status) => {
    if ((status === 'available') || (status === 'inprogress')) return true;
    return false
};


/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'createTask':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
                body('description', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateCreateStatus),
                body('assignees', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
                body('parent', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 16, max: 16 }),
                body('dependencies', conductorErrors.err1).optional({ checkFalsy: true }).isArray(),
            ]
    }
};

module.exports = {
    createTask,
    validate
};
