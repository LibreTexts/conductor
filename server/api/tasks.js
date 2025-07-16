//
// LibreTexts Conductor
// tasks.js
//

'use strict';
import b62 from 'base62-random';
import date from 'date-and-time';
import { body, query } from 'express-validator';
import Task from '../models/task.js';
import Project from '../models/project.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';
import { validateUUIDArray } from '../util/helpers.js';
import projectsAPI from './projects.js';
import mailAPI from './mail.js';
import usersAPI from './users.js';
import { get } from 'http';

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
        if (req.body.hasOwnProperty('startDate')) newTaskData.startDate = req.body.startDate;
        if (req.body.hasOwnProperty('endDate')) newTaskData.endDate = req.body.endDate;
        if (newTaskData.startDate && newTaskData.endDate) {
            let startObj = date.parse(newTaskData.startDate, 'YYYY-MM-DD');
            let endObj = date.parse(newTaskData.endDate, 'YYYY-MM-DD');
            if (startObj instanceof Date && !isNaN(startObj.valueOf())
                && endObj instanceof Date && !isNaN(endObj.valueOf())
                && (endObj < startObj)) {
                throw(new Error('dateorder'));
            }
        }
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
        else if (err.message === 'dateorder') errMsg = conductorErrors.err33;
        else debugError(err);
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
        else debugError(err);
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
    let task;
    let project;
    let updateObj = {};
    let updateDependencies = false;
    let doUpdate = false;
    getTaskProjectAndCheckPermission(req.body.taskID, req.user)
    .then(({ taskData, projectData }) => {
        task = taskData;
        project = projectData;
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
        if (req.body.hasOwnProperty('startDate') && req.body.startDate !== task.startDate) {
            updateObj.startDate = req.body.startDate;
        }
        if (req.body.hasOwnProperty('endDate') && req.body.endDate !== task.endDate) {
            updateObj.endDate = req.body.endDate;
        }
        if ((updateObj.startDate || task.startDate) && (updateObj.endDate || task.endDate)) {
            let startDate = null;
            let endDate = null;
            if (updateObj.startDate) startDate = updateObj.startDate;
            else if (task.startDate) startDate = task.startDate;
            if (updateObj.endDate) endDate = updateObj.endDate;
            else if (task.endDate) endDate = task.endDate;
            let startObj = date.parse(startDate, 'YYYY-MM-DD');
            let endObj = date.parse(endDate, 'YYYY-MM-DD');
            if (startObj instanceof Date && !isNaN(startObj.valueOf())
                && endObj instanceof Date && !isNaN(endObj.valueOf())
                && (endObj < startObj)) {
                throw(new Error('dateorder'));
            }
        }
        if (updateObj.status === 'completed') {
            return Task.aggregate([
                {
                    $match: {
                        parent: task.taskID
                    }
                }
            ]);
        } else return [];
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
                let isValid = projectsAPI.checkProjectMemberPermission(project, item);
                return isValid;
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
        // only send update op if there are changes to be saved
        if (Object.keys(updateObj).length > 0) {
            doUpdate = true;
            return Task.updateOne({
                taskID: task.taskID
            }, updateObj);
        } else return {};
    }).then((updateRes) => {
        if (!doUpdate || (doUpdate && updateRes.modifiedCount === 1)) {
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
        else if (err.message === 'dateorder') errMsg = conductorErrors.err33;
        else debugError(err);
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
    getTaskProjectAndCheckPermission(req.body.taskID, req.user)
    .then(({ taskData, projectData }) => {
        task = taskData;
        // find subtasks
        return Task.aggregate([
            {
                $match: {
                    parent: task.taskID
                }
            }
        ]);
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
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        else debugError(err);
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
    getTaskProjectAndCheckPermission(req.query.taskID, req.user)
    .then(({ taskData, projectData }) => {
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
            if (projectsAPI.checkProjectGeneralPermission(project, req.user)) {
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
                       // lookup dependencies
                        $graphLookup: {
                            from: 'tasks',
                            startWith: '$dependencies',
                            connectFromField: 'dependencies',
                            connectToField: 'taskID',
                            as: 'dependencies',
                            maxDepth: 0
                        }
                    }, {
                        // lookup tasks being blocked
                         $graphLookup: {
                             from: 'tasks',
                             startWith: '$taskID',
                             connectFromField: 'taskID',
                             connectToField: 'dependencies',
                             as: 'blocking',
                             maxDepth: 0
                         }
                     }, {
                        // lookup subtasks
                        $graphLookup: {
                            from: 'tasks',
                            startWith: '$taskID',
                            connectFromField: 'taskID',
                            connectToField: 'parent',
                            as: 'subtasks'
                        }
                    }, {
                        $unwind: {
                            path: '$subtasks',
                            preserveNullAndEmptyArrays: true
                        }
                    }, {
                        // lookup subtasks dependencies
                        $lookup: {
                            from: 'tasks',
                            let: {
                                subDeps: '$subtasks.dependencies'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: [{ $type: '$$subDeps' }, 'array']
                                        }
                                    }
                                }, {
                                    $match: {
                                        $expr: {
                                            $in: ['$taskID', '$$subDeps']
                                        }
                                    }
                                }
                            ],
                            as: 'subtasks.dependencies'
                        }
                    }, {
                       // lookup subtasks assignees
                       $lookup: {
                           from: 'users',
                           let: {
                               subAssigns: '$subtasks.assignees'
                           },
                           pipeline: [
                               {
                                   $match: {
                                       $expr: {
                                           $eq: [{ $type: '$$subAssigns' }, 'array']
                                       }
                                   }
                               }, {
                                   $match: {
                                       $expr: {
                                           $in: ['$uuid', '$$subAssigns']
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
                           as: 'subtasks.assignees'
                       }
                   }, {
                       $addFields: {
                           subtasks: {
                               $cond: {
                                   if: {
                                      $ifNull: ['$subtasks.taskID', false]
                                   },
                                   then: '$subtasks',
                                   else: []
                               }
                           }
                       }
                   }, {
                        $group: {
                            _id: '$_id',
                            orgID: { $first: '$orgID' },
                            projectID: { $first: '$projectID' },
                            taskID: { $first: '$taskID'},
                            title: { $first: '$title' },
                            description: { $first: '$description' },
                            status: { $first: '$status' },
                            assignees: { $first: '$assignees' },
                            parent: { $first: '$parent' },
                            createdBy: { $first: '$createdBy' },
                            subtasks: { $push: '$subtasks' },
                            dependencies: { $first: '$dependencies' },
                            blocking: { $first: '$blocking' },
                            startDate: { $first: '$startDate' },
                            endDate: { $first: '$endDate' },
                            createdAt: { $first: '$createdAt' },
                            createdBy: { $first: '$createdBy' }
                        }
                    }, {
                        $addFields: {
                            subtasks: {
                                $filter: {
                                    input: '$subtasks',
                                    as: 'subtask',
                                    cond: {
                                        $eq: [{ $type: '$$subtask' }, 'object']
                                    }
                                }
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0,
                            subtasks: {
                                _id: 0,
                                __v: 0
                            }
                        }
                    }, {
                        $sort: {
                            title: 1,
                            'subtasks.title': -1
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
        let errMsg = conductorErrors.err6;
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
 * Assign a user to a task.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const addTaskAssignee = (req, res) => {
    let assignedTask = false;
    let project = {};
    let task = {};
    getTaskProjectAndCheckPermission(req.body.taskID, req.user)
    .then(({ taskData, projectData }) => {
        task = taskData;
        project = projectData;
        let isValid = projectsAPI.checkProjectMemberPermission(project, req.body.assignee);
        if (isValid) {
            let matchObj = {
                taskID: task.taskID
            };
            if (req.body.hasOwnProperty('subtasks') && req.body.subtasks === true
                && (!task.parent || task.parent === '')) {
                // allow assigning to subtasks if requested & task is a parent
                matchObj = {
                    $or: [
                        { taskID: task.taskID },
                        { parent: task.taskID }
                    ]
                };
            }
            return Task.updateMany(matchObj, {
                $addToSet: {
                    assignees: req.body.assignee
                }
            });
        } else {
            throw(new Error('notteam'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount > 0) {
            assignedTask = true;
            return usersAPI.getUserEmails([req.body.assignee]);
        } else {
            throw(new Error('updatefail'));
        }
    }).then((userEmails) => {
        if (userEmails && Array.isArray(userEmails) && userEmails.length > 0) {
            return mailAPI.sendAssignedToTaskNotification(userEmails[0],
                project.projectID, project.title, project.orgID, task.title);
        } else return {};
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Successfully assigned user!'
        });
    }).catch((err) => {
        if (assignedTask) {
            // return success even if notification fails
            return res.send({
                err: false,
                msg: 'Successfully assigned user!'
            });
        } else {
            let errMsg = conductorErrors.err6;
            if (err.message === 'notfound') errMsg = conductorErrors.err11;
            else if (err.message === 'unauth') errMsg = conductorErrors.err8;
            else if (err.message === 'notteam') errMsg = conductorErrors.err26;
            else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
            else debugError(err);
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
    });
};

/**
 * Assign a user to a task.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const assignAllMembersToTask = async (req, res) => {
    try {
      const { taskData, projectData } = await getTaskProjectAndCheckPermission(
        req.body.taskID,
        req.user
      );

      let matchObj = {
        taskID: taskData.taskID,
      };

      if (
        req.body.hasOwnProperty("subtasks") &&
        req.body.subtasks === true &&
        (!taskData.parent || taskData.parent === "")
      ) {
        // allow assigning to subtasks if requested & task is a parent
        matchObj = {
          $or: [{ taskID: taskData.taskID }, { parent: taskData.taskID }],
        };
      }

      const updateRes = await Task.updateMany(matchObj, {
        $addToSet: {
          assignees: projectData.members,
        },
      });

      const userEmails = [];
      if (updateRes.modifiedCount > 0) {
        const foundEmails = await usersAPI.getUserEmails([...projectData.members]);
        userEmails.push(...foundEmails);
      } else {
        throw new Error("updatefail");
      }

      if (userEmails && Array.isArray(userEmails) && userEmails.length > 0) {
        for (let i = 0; i < userEmails.length; i++) {
          const mailRes = mailAPI.sendAssignedToTaskNotification(
            userEmails[i],
            projectData.projectID,
            projectData.title,
            projectData.orgID,
            taskData.title
          );
        }
      }

      // ignore return value of Mailgun call
      return res.send({
        err: false,
        msg: "Successfully assigned users!",
      });
    } catch (err) {
      let errMsg = conductorErrors.err6;
      if (err.message === "updatefail") {
        errMsg = conductorErrors.err3;
      } else {
        debugError(err);
      }
      return res.send({
        err: true,
        errMsg: errMsg,
      });
    }
};

/**
 * Remove an assignee from a task.
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const removeTaskAssignee = (req, res) => {
    getTaskProjectAndCheckPermission(req.body.taskID, req.user)
    .then(({ taskData: task, projectData }) => {
        let matchObj = {
            taskID: task.taskID
        };
        if (req.body.hasOwnProperty('subtasks') && req.body.subtasks === true
            && (!task.parent || task.parent === '')) {
            // allow removing from subtasks if requested & task is a parent
            matchObj = {
                $or: [
                    { taskID: task.taskID },
                    { parent: task.taskID }
                ]
            };
        }
        return Task.updateMany(matchObj, {
            $pull: {
                assignees: req.body.assignee
            }
        });
    }).then((updateRes) => {
        if (updateRes.modifiedCount > 0) {
            return res.send({
                err: false,
                msg: 'Successfully unassigned user!'
            });
        } else {
            throw(new Error('updatefail'));
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Lookup a task and it's corresponding project, then check
 * if the given user has member permission(s) in the project.
 * @param {String} taskID - the internal taskID to lookup
 * @param {Object} user - the user object from the auth chain
 * @returns {Promise<[Object, Object]|Error>} a tuple of the task and project
 *  information, or throw an error
 */
const getTaskProjectAndCheckPermission = (taskID, user) => {
    let task = {};
    let project = {};
    return new Promise((resolve, reject) => {
        resolve(Task.findOne({
            taskID: taskID
        }).lean());
    }).then((taskData) => {
        if (taskData) {
            task = taskData;
            return Project.findOne({
                projectID: taskData.projectID
            }).lean();
        } else throw(new Error('notfound'));
    }).then((projectData) => {
        if (projectData) {
            project = projectData;
            if (projectsAPI.checkProjectMemberPermission(project, user)) {
                return {
                    taskData: task,
                    projectData: project
                };
            } else throw(new Error('unauth'));
        } else throw(new Error('notfound'));
    })
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
                body('dependencies', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateTaskIDArray),
                body('startDate', conductorErrors.err1).optional({ checkFalsy: true }).isDate({ format: 'YYYY-MM-DD', strictMode: true }),
                body('endDate', conductorErrors.err1).optional({ checkFalsy: true }).isDate({ format: 'YYYY-MM-DD', strictMode: true })
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
        case 'addTaskAssignee':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16}),
                body('assignee', conductorErrors.err1).exists().isString().isUUID(),
                body('subtasks', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
        case 'assignAllToTask':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16}),
                body('subtasks', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
        case 'removeTaskAssignee':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16}),
                body('assignee', conductorErrors.err1).exists().isString().isUUID(),
                body('subtasks', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean()
            ]
    }
};

export default {
    createTask,
    batchCreateTask,
    updateTask,
    deleteTask,
    getTask,
    getProjectTasks,
    validate,
    addTaskAssignee,
    assignAllMembersToTask,
    removeTaskAssignee
}
