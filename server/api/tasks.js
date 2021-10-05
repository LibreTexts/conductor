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

const projectsAPI = require('./projects.js');
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
    let projectData = {};
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                projectData = project;
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
        if (req.body.hasOwnProperty('status')) newTaskData.status = req.body.status;
        if (req.body.hasOwnProperty('description')) newTaskData.description = req.body.description;
        if (req.body.hasOwnProperty('assignees')) newTaskData.assignees = req.body.assignees;
        if (req.body.hasOwnProperty('dependencies')) newTaskData.dependencies = req.body.dependencies;
        if (newTaskData.assignees.length > 0) {
            // verify all assignees are project members
            let validAssignees = true;
            newTaskData.assignees.forEach((item) => {
                if (item !== projectData.owner) {
                    validAssignees = false;
                } else if (!projectData.collaborators.includes(item)) {
                    validAssignees = false;
                }
            });
            if (!validAssignees) {
                throw(new Error('assignees'));
            }
        }
        if (newTaskData.dependencies.length > 0) {
            // dependencies need to be resolved/sanitized
            if (newTaskData.parent !== '') {
                // a task can't be dependent on its own parent task (circular dependency)
                let foundParent = newTaskData.dependencies.find((item) => item === newTaskData.parent);
                if (foundParent !== undefined) throw(new Error('parentdep'));
            }
            return Task.aggregate([
                {
                    $match: {
                        taskID: {
                            $in: newTaskData.dependencies
                        }
                    }
                }
            ]);
        } else {
            return [];
        }
    }).then((dependencies) => {
        if (newTaskData.dependencies.length > 0 && dependencies.length > 0) {
            if (newTaskData.status === 'completed') {
                // a task can't be marked completed until its dependencies are completed
                let foundNotCompleted = dependencies.find((item) => item.status !== 'completed');
                if (foundNotCompleted !== undefined) {
                    throw(new Error('depnotcompleted'));
                }
            }
            let depIDs = dependencies.map((item) => item.taskID).filter((item) => (item !== undefined && item !== null));
            newTaskData.dependencies = depIDs;
        } else if (newTaskData.dependencies.length > 0 && dependencies.length == 0) {
            // dependencies were provided but none were found, empty the array
            newTaskData.dependencies = [];
        }
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
        else if (err.message === 'assignees') errMsg = conductorErrors.err26;
        else if (err.message === 'parentdep') errMsg = conductorErrors.err27;
        else if (err.message === 'depnotcompleted') errMsg = conductorErrors.err25;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Updates the Task identified by the taskID in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'updateTask'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const updateTask = (req, res) => {
    var task;
    Task.findOne({
        taskID: req.body.taskID
    }).lean().then((taskData) => {
        if (taskData) {
            task = taskData;
            return Project.findOne({
                projectID: task.projectID
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                // build update object
                let updateObj = {};
                if (req.body.hasOwnProperty('title') && req.body.title !== task.title) {
                    updateObj.title = req.body.title;
                }
                if (req.body.hasOwnProperty('description') && req.body.description !== task.description) {
                    updateObj.description = req.body.description;
                }
                if (req.body.hasOwnProperty('status') && req.body.status !== task.status) {
                    updateObj.status = req.body.status;
                }
                if (req.body.hasOwnProperty('assignees')) {
                    updateObj.assignees = req.body.assignees;
                }
                if (req.body.hasOwnProperty('dependencies')) {
                    updateObj.dependencies = req.body.dependencies;
                }
                return Task.updateOne({
                    taskID: task.taskID
                }, updateObj);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: "Successfully updated task."
            });
        } else {
            throw(new Error('updatefail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves information about the Task identified by the taskID in the request
 * query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getTask'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getTask = (req, res) => {
    Task.findOne({
        taskID: req.query.taskID
    }).lean().then((taskData) => {
        if (taskData) {
            return Project.findOne({
                projectID: taskData.projectID
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Task.aggregate([
                    {
                        $match: {
                            taskID: req.query.taskID
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        // lookup parent
                        $lookup: {
                            from: 'tasks',
                            let: {
                                parent: '$parent'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$taskID', '$$parent']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'parent'
                        }
                    }, {
                        $addFields: {
                            parent: {
                                $arrayElemAt: ['$parent', 0]
                            }
                        }
                    }, {
                        // lookup dependencies
                        $lookup: {
                            from: 'tasks',
                            let: {
                                deps: '$dependencies'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $in: ['$taskID', '$$deps']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'dependencies'
                        }
                    }, {
                        // lookup tasks being blocked
                        $lookup: {
                            from: 'tasks',
                            let: {
                                taskID: '$taskID'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $in: ['$$taskID', '$dependencies']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'blocking'
                        }
                    }, {
                        // lookup assignees
                        $lookup: {
                            from: 'users',
                            let: {
                                assignees: '$assignees'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $in: ['$uuid', '$$assignees']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        uuid: 1,
                                        firstName: 1,
                                        lastName: 1,
                                        avatar: 1,
                                        email: 1
                                    }
                                }
                            ],
                            as: 'assignees'
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((taskRes) => {
        if (taskRes.length > 0) {
            let task = taskRes[0];
            return res.send({
                err: false,
                task: task
            });
        } else {
            throw(new Error('notfound'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves all Tasks and subtasks belonging to the Project identified by
 * the projectID in the request query.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProjectTasks'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getProjectTasks = (req, res) => {
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Task.aggregate([
                    {
                        $match: {
                            $and: [
                                {
                                    projectID: req.query.projectID
                                }, {
                                    parent: {
                                        $in: ['', null]
                                    }
                                }
                            ]
                        }
                    }, {
                        $lookup: {
                            from: 'tasks',
                            let: {
                                taskID: '$taskID'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$parent', '$$taskID']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'subtasks'
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __V: 0
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((tasks) => {
        return res.send({
            err: false,
            tasks: tasks
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Validate a provided Task Status option during a task creation or update.
 * @returns {Boolean} true if valid option, false otherwise.
 */
const validateStatus = (status) => {
    if ((status === 'available')
        || (status === 'inprogress')
        || (status === 'completed')) return true;
    return false;
};


/**
 * Validates that an array of strings contains only TaskIDs.
 * @param {string[]} arr  - the array of strings to validate
 * @returns {Boolean} true if valid array, false otherwise.
 */
const validateTaskIDArray = (arr) => {
    if (Array.isArray(arr)) {
        let validArray = true;
        arr.forEach((item) => {
            if (typeof(item) === 'string') {
                if (item.length !== 16) validArray = false;
            } else validArray = false;
        });
        return validArray;
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
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateStatus),
                body('assignees', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUUIDArray),
                body('parent', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 16, max: 16 }),
                body('dependencies', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateTaskIDArray)
            ]
        case 'updateTask':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16 }),
                body('title', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 250 }),
                body('description', conductorErrors.err1).optional({ checkFalsy: true }).isString(),
                body('status', conductorErrors.err1).optional({ checkFalsy: true }).isString().custom(validateStatus),
                body('assignees', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUUIDArray),
                body('dependencies', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateTaskIDArray)
            ]
        case 'getTask':
            return [
                query('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16 })
            ]
        case 'getProjectTasks':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 })
            ]
    }
};

module.exports = {
    createTask,
    updateTask,
    getTask,
    getProjectTasks,
    validate
};
