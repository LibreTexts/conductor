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
const { validateUUIDArray } = require('../util/helpers.js');

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
    let newTaskData = {
        orgID: process.env.ORG_ID,
        projectID: req.body.projectID,
        taskID: b62(16),
        title: req.body.title,
        description: '',
        status: 'available',
        assignees: [],
        parent: '',
        dependencies: [],
        createdBy: req.decoded.uuid
    };
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if ((req.decoded.uuid === project.owner) || (project.collaborators.includes(req.decoded.uuid))) {
                if (req.body.hasOwnProperty('parent')) {
                    return Task.findOne({
                        taskID: req.body.parent
                    }).lean();
                } else {
                    return {};
                }
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((parentTaskRes) => {
        if (parentTaskRes) {
            newTaskData.parent = parentTaskRes.taskID;
        } else if (!parentTaskRes && req.body.hasOwnProperty('parent')) {
            throw(new Error('ptnotfound'));
        }
        if (req.body.hasOwnProperty('description')) newTaskData.description = req.body.description;
        if (req.body.hasOwnProperty('assignees')) newTaskData.assignees = req.body.assignees;
        if (req.body.hasOwnProperty('dependencies')) newTaskData.dependencies = req.body.dependencies;
        let newTask = new Task(newTaskData);
        return newTask.save();
    }).then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: 'Task successfully created.',
                taskID: newDoc.taskID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'ptnotfound') errMsg = conductorErrors.err24;
        else if (err.message === 'createfail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
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
 * Validates that an array of strings contains only TaskIDs.
 * @param {string[]} arr  - the array of strings to validate
 * @returns {Boolean} true if valid array, false otherwise.
 */
const validateTaskIDArray = (arr) => {
    if (Array.isArray(arr)) {
        var validArray = true;
        arr.forEach((item) => {
            if (typeof(item) === 'string') {
                if (item.length !== 16) validArray = false;
            } else validArray = false;
        });
    }
    return false;
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
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 250 }),
                body('description', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateCreateStatus),
                body('assignees', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUUIDArray),
                body('parent', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 16, max: 16 }),
                body('dependencies', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateTaskIDArray)
            ]
    }
};

module.exports = {
    createTask,
    validate
};
