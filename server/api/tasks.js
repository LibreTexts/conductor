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
 * Creates the number of new Tasks specified by the value in the request body.
 * If requested, the specified number of subtasks is also created for each.
 * request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'batchCreateTask'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const batchCreateTask = (req, res) => {
    let taskOps = [];
    let titlePrefix = String(req.body.titlePrefix).trim();
    let subtitlePrefix = '';
    let addSubtasks = false;
    if (req.body.addSubtasks === true && req.body.subtitlePrefix && req.body.hasOwnProperty('subtasks')) {
        addSubtasks = true;
        subtitlePrefix = String(req.body.subtitlePrefix).trim();
    }
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                if (isNaN(req.body.tasks) || (addSubtasks && isNaN(req.body.subtasks))) {
                    throw(new Error('number'));
                }
                for (let i = 1; i <= req.body.tasks; i++) {
                    let newTaskID = b62(16);
                    taskOps.push({
                        orgID: process.env.ORG_ID,
                        projectID: project.projectID,
                        taskID: newTaskID,
                        title: `${titlePrefix} ${i}`,
                        description: '',
                        status: 'available',
                        assignees: [],
                        parent: '',
                        dependencies: [],
                        createdBy: req.decoded.uuid
                    });
                    if (addSubtasks) {
                        for (let j = 1; j <= req.body.subtasks; j++) {
                            taskOps.push({
                                orgID: process.env.ORG_ID,
                                projectID: project.projectID,
                                taskID: b62(16),
                                title: `${subtitlePrefix} ${i}.${j}`,
                                description: '',
                                status: 'available',
                                assignees: [],
                                parent: newTaskID,
                                dependencies: [],
                                createdBy: req.decoded.uuid
                            });
                        }
                    }
                }
                return Task.insertMany(taskOps);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((_insertRes) => {
        return res.send({
            err: false,
            msg: 'Successfully added tasks.'
        });
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'insertfail') errMsg = conductorErrors.err3;
        else if (err.message === 'number') errMsg = conductorErrors.err2;
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
    let updateObj = {};
    let updateDependencies = false;
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
                if (req.body.hasOwnProperty('title') && req.body.title !== task.title) {
                    updateObj.title = req.body.title;
                }
                if (req.body.hasOwnProperty('description') && req.body.description !== task.description) {
                    updateObj.description = req.body.description;
                }
                if (req.body.hasOwnProperty('status') && req.body.status !== task.status) {
                    updateObj.status = req.body.status;
                }
                if (updateObj.status === 'completed') {
                    return Task.aggregate([
                        {
                            $match: {
                                parent: task.taskID
                            }
                        }
                    ]);
                } else {
                    return [];
                }
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((subtasks) => {
        // check that a task is not being marked completed before subtasks are complete
        if (subtasks.length > 0) {
            let foundNotCompleted = subtasks.find((item) => item.status !== 'completed');
            if (foundNotCompleted !== undefined) {
                throw(new Error('subnotcomplete'));
            }
        }
        // continue building update object
        if (req.body.hasOwnProperty('assignees') && Array.isArray(req.body.assignees)) {
            // verify all assignees are project members
            let validAssignees = true;
            req.body.assignees.forEach((item) => {
                if (item !== project.owner) {
                    validAssignees = false;
                } else if (!project.collaborators.includes(item)) {
                    validAssignees = false;
                }
            });
            if (validAssignees) {
                updateObj.assignees = req.body.assignees;
            } else {
                throw(new Error('assignees'));
            }
        }
        if (req.body.hasOwnProperty('dependencies') && Array.isArray(req.body.dependencies)) {
            if (req.body.dependencies.length > 0) {
                updateDependencies = true;
                // dependencies need to be resolved/sanitized
                if (task.parent !== '') {
                    // a task can't be dependent on its own parent task (circular dependency)
                    let foundParent = req.body.dependencies.find((item) => item === task.parent);
                    if (foundParent !== undefined) throw(new Error('parentdep'));
                }
                // a task can't be dependent on itself (circular dependency)
                let foundSelf = req.body.dependencies.find((item) => item === task.taskID);
                if (foundSelf !== undefined) throw(new Error('selfdep'));
                // lookup valid dependencies
                return Task.aggregate([
                    {
                        $match: {
                            taskID: {
                                $in: req.body.dependencies
                            }
                        }
                    }
                ]);
            } else if (req.body.dependencies.length === 0) {
                updateDependencies = true;
            }
        }
        return [];
    }).then((dependencies) => {
        if (updateDependencies) {
            if (req.body.dependencies.length > 0 && dependencies.length > 0) {
                let depIDs = dependencies.map((item) => item.taskID).filter((item) => (item !== undefined && item !== null));
                updateObj.dependencies = depIDs;
                if (task.status === 'completed' || updateObj.status === 'completed') {
                    // a task can't be marked completed until its dependencies are completed
                    let foundNotCompleted = dependencies.find((item) => item.status !== 'completed');
                    if (foundNotCompleted !== undefined) {
                        throw(new Error('depnotcompleted'));
                    }
                }
            } else if (req.body.dependencies.length > 0 && dependencies.length === 0) {
                // dependencies were provided but none were found, empty the array
                updateObj.dependencies = [];
            } else if (req.body.dependencies.length === 0) {
                // dependencies were cleared
                updateObj.dependencies = [];
            }
        }
        return Task.updateOne({
            taskID: task.taskID
        }, updateObj);
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
        else if (err.message === 'assignees') errMsg = conductorErrors.err26;
        else if (err.message === 'depnotcompleted') errMsg = conductorErrors.err25;
        else if (err.message === 'subnotcomplete') errMsg = conductorErrors.err30;
        else if (err.message === 'parentdep') errMsg = conductorErrors.err27;
        else if (err.message === 'selfdep') errMsg = conductorErrors.err31;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Delete the Task identified by the taskID in the request body and any of
 * its subtasks.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteTask'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteTask = (req, res) => {
    var task;
    let tasksToDelete = [];
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
                return Task.aggregate([
                    {
                        $match: {
                            parent: task.taskID
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((subtasks) => {
        if (subtasks.length > 0) {
            subtasks.forEach((item) => {
                tasksToDelete.push(item.taskID);
            });
        }
        tasksToDelete.push(task.taskID);
        tasksToDelete = tasksToDelete.filter(item => (item !== undefined && item !== null));
        return Task.deleteMany({
            taskID: {
                $in: tasksToDelete
            }
        });
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === tasksToDelete.length) {
            return res.send({
                err: false,
                msg: "Successfully deleted task and any subtasks."
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).catch((err) => {
        console.log(err);
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
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
                        // lookup subtasks
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
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $unwind: '$subtasks'
                    }, {
                        // lookup subdependencies
                        $lookup: {
                            from: 'tasks',
                            let: {
                                deps: 'reviews.dependencies'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$taskID', '$$deps']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'subdependencies'
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
        //console.log(tasks);
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
{
   $graphLookup: {
       from: 'tasks',
       startWith: '$subtasks.dependencies',
       connectFromField: 'subtasks.dependencies',
       connectToField: 'taskID',
       as: 'dependencyGraph',
       maxDepth: 3
   }
}
**/


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
        case 'batchCreateTask':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('tasks', conductorErrors.err1).exists().isNumeric().toInt(),
                body('titlePrefix', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 150 }),
                body('addSubtasks', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
                body('subtasks', conductorErrors.err1).optional({ checkFalsy: true }).isNumeric().toInt(),
                body('subtitlePrefix', conductorErrors.err1).optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 150 })
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
        case 'deleteTask':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16 })
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
    batchCreateTask,
    updateTask,
    deleteTask,
    getTask,
    getProjectTasks,
    validate
};
