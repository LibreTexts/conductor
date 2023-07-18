//
// LibreTexts Conductor
// messaging.js
//

'use strict';
import express from 'express';
import b62 from 'base62-random';
import { debugError } from '../debug.js';
import { body, query, param } from 'express-validator';
import User from '../models/user.js';
import Project from '../models/project.js';
import Task from '../models/task.js';
import Thread from '../models/thread.js';
import Message from '../models/message.js';
import conductorErrors from '../conductor-errors.js';
import mailAPI from './mail.js';
import projectsAPI from './projects.js';
import usersAPI from './users.js';
import { validateUUIDArray } from '../util/helpers.js';
import { conductor400Err } from '../util/errorutils.js';

const THREAD_NOTIFY_OPTIONS = ['all', 'specific', 'support', 'none'];

/**
 * Creates a new Discussion Thread within a Project.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createThread'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createDiscussionThread = (req, res) => {
    Project.findOne({
        projectID: req.body.projectID
    }).lean().then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                const thread = new Thread({
                    threadID: b62(14),
                    project: project.projectID,
                    title: req.body.title,
                    kind: req.body.kind,
                    defaultNotifSubject: req.body.defaultNotifSubject,
                    createdBy: req.user.decoded.uuid
                });
                return thread.save();
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((newThread) => {
        if (newThread) {
            return res.send({
                err: false,
                msg: 'New thread created successfully.',
                threadID: newThread.threadID
            });
        } else {
            throw(new Error('createfail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'createfail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};

const updateDiscussionThread = async (req, res) => {
    try {
      if (!req.body.threadID) {
        return conductor400Err(res);
      }

      const foundThread = await Thread.findOne({ threadID: req.body.threadID })
        .lean()
        .orFail();

      const foundProject = await Project.findOne({
        projectID: foundThread.project,
      })
        .lean()
        .orFail();
      if (!projectsAPI.checkProjectAdminPermission(foundProject, req.user)) {
        return res.send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }

      const updateObj = {
        title: req.body.title,
        defaultNotifSubject: req.body.defaultNotifSubject,
      };

      const updateRes = await Thread.updateOne(
        {
          threadID: req.body.threadID,
        },
        updateObj
      );

      if (updateRes.modifiedCount > 0) {
        return res.send({
          err: false,
          msg: "Thread updated successfully.",
        });
      } else {
        throw new Error("updatefail");
      }
    } catch (err) {
      if (err.name === "DocumentNotFoundError") {
        return res.send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      }
      debugError(err);
      return res.send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }
}


/**
 * Deletes a Discussion Thread and its messages within a Project.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteThread'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteDiscussionThread = (req, res) => {
    Thread.findOne({
        threadID: req.body.threadID
    }).lean().then((thread) => {
        if (thread) {
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Thread.deleteOne({
                    threadID: req.body.threadID
                });
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((threadDeleteRes) => {
        if (threadDeleteRes.deletedCount === 1) {
            return Message.deleteMany({
                thread: req.body.threadID
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).then((_msgDeleteRes) => {
        return res.send({
            err: false,
            msg: 'Thread and messages successfully deleted.'
        });
    }).catch((err) => {
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
 * Retrives all Discussion Threads within a Project and their most recent message.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getProjectThreads'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getProjectThreads = (req, res) => {
    let threadKind = 'project';
    if (req.query.kind) {
        threadKind = req.query.kind;
    }
    Project.findOne({
        projectID: req.query.projectID
    }).lean().then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Thread.aggregate([
                    {
                        $match: {
                            project: req.query.projectID,
                            kind: threadKind
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $lookup: {
                            from: 'messages',
                            let: {
                                threadID: '$threadID'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$thread', '$$threadID']
                                        }
                                    }
                                }, {
                                    $sort: {
                                        createdAt: -1
                                    }
                                }, {
                                    $limit: 1
                                }, {
                                    $project: {
                                        _id: 0,
                                        __v: 0
                                    }
                                }
                            ],
                            as: 'lastMessage'
                        }
                    }, {
                        $addFields: {
                            lastMessage: {
                                $arrayElemAt: ['$lastMessage', 0]
                            }
                        }
                    }, {
                        $lookup: {
                            from: 'users',
                            let: {
                                author: '$lastMessage.author'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$uuid', '$$author']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        uuid: 1,
                                        firstName: 1,
                                        lastName: 1
                                    }
                                }
                            ],
                            as: 'lastMessage.author'
                        }
                    }, {
                        $addFields: {
                            'lastMessage.author': {
                                $arrayElemAt: ['$lastMessage.author', 0]
                            }
                        }
                    }, {
                        $sort: {
                            'lastMessage.createdAt': -1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((threads) => {
        return res.send({
            err: false,
            projectID: req.query.projectID,
            threads: threads
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
 * Creates a new Message within a Project Thread.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function createThreadMessage(req, res) {
    try {

        const { threadID } = req.params;
        const thread = await Thread.findOne({ threadID }).lean();
        if (!thread) {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11,
            });
        }

        let resolvedNotifySetting = thread.defaultNotifSubject;
        if (req.body.notify) {
            resolvedNotifySetting = req.body.notify;
        }

        const project = await Project.findOne({ projectID: thread.project }).lean();
        if (!project) {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11,
            });
        }

        // check permission
        if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const message = await new Message({
            messageID: b62(15),
            thread: threadID,
            body: req.body.message,
            author: req.user.decoded.uuid,
        }).save();

        const user = await User.findOne(
            { uuid: req.user.decoded.uuid },
            { firstName: 1, lastName: 1 },
        ).lean();

        const notifyEmails = await getUsersToNotify(
            resolvedNotifySetting,
            req.user.decoded.uuid,
            project,
            null,
            req.body.notifyUsers || null,
        );
        if (Array.isArray(notifyEmails) && notifyEmails.length > 0) {
            // send email notifications
            let discussionKind = null;
            switch (thread.kind) {
                case 'peerreview':
                    discussionKind = 'Peer Review';
                    break;
                case 'a11y':
                    discussionKind = 'Accessibility';
                    break;
                default:
                    discussionKind = 'Project';
            }
            if (resolvedNotifySetting !== 'support') {
                mailAPI.sendNewProjectMessagesNotification(
                    notifyEmails,
                    project.projectID,
                    project.title,
                    project.orgID,
                    discussionKind,
                    thread.title,
                    message.body,
                    `${user.firstName} ${user.lastName}`,
                ).catch((e) => debugError(e));
    
                Thread.updateOne({ threadID }, { lastNotifSent: new Date() }).catch((e) => {
                    debugError(e);
                });
            } else {
                mailAPI.sendProjectSupportRequest(
                    notifyEmails,
                    { projectID: project.projectID, title: project.title },
                    {
                        kind: discussionKind,
                        threadTitle: thread.title,
                        body: message.body,
                        author: `${user.firstName} ${user.lastName}`,
                    },
                );
            }
        }

        return res.send({
            err: false,
            msg: 'Message successfully sent!',
            messageID: message.messageID,
        });
    } catch (e) {
        debugError(e);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

/**
 * Creates a new Message within a Task.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function createTaskMessage(req, res) {
    try {
        const DEFAULT_NOTIFY_SETTING = 'assigned';
        const resolvedNotifySetting = req.body.notify || DEFAULT_NOTIFY_SETTING;

        const { taskID } = req.params;
        const task = await Task.findOne({ taskID }).lean();
        if (!task) {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11,
            });
        }

        const project = await Project.findOne({ projectID: task.projectID }).lean();
        if (!project) {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11,
            });
        }

        // check permission
        if (!projectsAPI.checkProjectMemberPermission(project, req.user)) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const message = await new Message({
            messageID: b62(15),
            task: task.taskID,
            body: req.body.message,
            author: req.user.decoded.uuid,
        }).save();

        const user = await User.findOne(
            { uuid: req.user.decoded.uuid },
            { firstName: 1, lastName: 1 },
        ).lean();

        const notifyEmails = await getUsersToNotify(
            resolvedNotifySetting,
            req.user.decoded.uuid,
            project,
            task,
            req.body.notifyUsers || null,
        );
        if (Array.isArray(notifyEmails) && notifyEmails.length > 0) {
            // send email notifications
            let taskTitle = task.title;
            if (task.parent) {
                const parent = await Task.findOne({ taskID: task.parent }).lean();
                if (parent) {
                    taskTitle = `${parent.title}/${task.title}`;
                }
            }
            if (resolvedNotifySetting !== 'support') {
                mailAPI.sendNewProjectMessagesNotification(
                    notifyEmails,
                    project.projectID,
                    project.title,
                    project.orgID,
                    'Tasks',
                    taskTitle,
                    message.body,
                    `${user.firstName} ${user.lastName}`,
                ).catch((e) => debugError(e));
            } else {
                mailAPI.sendProjectSupportRequest(
                    notifyEmails,
                    { projectID: project.projectID, title: project.title },
                    {
                        kind: 'Tasks',
                        threadTitle: taskTitle,
                        body: message.body,
                        author: `${user.firstName} ${user.lastName}`,
                    },
                );
            }
        }

        return res.send({
            err: false,
            msg: 'Message successfully sent!',
            messageID: message.messageID,
        });
    } catch (e) {
        debugError(e);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

/**
 * Deletes a Message within a Project Thread or Task.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteMessage = (req, res) => {
    let message = null;
    Message.findOne({
        messageID: req.body.messageID
    }).lean().then((msgData) => {
        if (msgData) {
            message = msgData;
            if (msgData.thread && msgData.thread.length > 0) {
                return Thread.findOne({ threadID: msgData.thread }).lean();
            } else if (msgData.task && msgData.task.length > 0) {
                return Task.findOne({ taskID: msgData.task }).lean();
            } else {
                throw (new Error('missingparent'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((parentObj) => {
        if (parentObj) {
            const projectID = parentObj.project || parentObj.projectID;
            if (typeof (projectID) === 'string') {
                return Project.findOne({ projectID }).lean();
            }
        }
        throw (new Error('missingparent'));
    }).then((project) => {
        if (project) {
            if ((message.author === req.user?.decoded?.uuid)
                || (projectsAPI.checkProjectAdminPermission(project, req.user))
            ) {
                return Message.deleteOne({ messageID: req.body.messageID });
            } else {
                throw (new Error('unauth'));
            }
        }
        throw (new Error('missingparent'));
    }).then((msgDeleteRes) => {
        if (msgDeleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: 'Message successfully deleted.'
            });
        } else {
            throw(new Error('deletefail'));
        }
    }).catch((err) => {
        var errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err11;
        else if (err.message === 'missingparent') errMsg = conductorErrors.err1;
        else if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'deletefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves all Messages within a Project Thread.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getThreadMessages'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getThreadMessages = (req, res) => {
    Thread.findOne({
        threadID: req.query.threadID
    }).lean().then((thread) => {
        if (thread) {
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Message.aggregate([
                    {
                        $match: {
                            thread: req.query.threadID
                        }
                    }, {
                        $lookup: {
                            from: 'users',
                            let: {
                                author: '$author'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$uuid', '$$author']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        uuid: 1,
                                        firstName: 1,
                                        lastName: 1,
                                        avatar: 1
                                    }
                                }
                            ],
                            as: 'author'
                        }
                    }, {
                        $addFields: {
                            author: {
                                $arrayElemAt: ['$author', 0]
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $sort: {
                            createdAt: 1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((messages) => {
        return res.send({
            err: false,
            threadID: req.query.threadID,
            messages: messages
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
 * Retrieves all Messages within a Task.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getTaskMessages'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const getTaskMessages = (req, res) => {
    Task.findOne({
        taskID: req.query.taskID
    }).lean().then((task) => {
        if (task) {
            return Project.findOne({
                projectID: task.projectID
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                return Message.aggregate([
                    {
                        $match: {
                            task: req.query.taskID
                        }
                    }, {
                        $lookup: {
                            from: 'users',
                            let: {
                                author: '$author'
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$uuid', '$$author']
                                        }
                                    }
                                }, {
                                    $project: {
                                        _id: 0,
                                        uuid: 1,
                                        firstName: 1,
                                        lastName: 1,
                                        avatar: 1
                                    }
                                }
                            ],
                            as: 'author'
                        }
                    }, {
                        $addFields: {
                            author: {
                                $arrayElemAt: ['$author', 0]
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }, {
                        $sort: {
                            createdAt: 1
                        }
                    }
                ]);
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((messages) => {
        return res.send({
            err: false,
            taskID: req.query.taskID,
            messages: messages
        });
    }).catch((err) => {
        debugError(err);
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
 * Returns the emails of users to notify about new messages, depending on `notifySetting`.
 *
 * @param {string} notifySetting - Notification setting identifier.
 * @param {string} uuid - UUID of the current user.
 * @param {object} project - Project information object, including team.
 * @param {object} [task=null] - Task information object, if applicable.
 * @param {string[]} [notifyUsers=[]] - UUIDs of specific users to notify, if applicable.
 * @returns {Promise<string[]>} Array of user emails, or empty array if error encountered.
 */
async function getUsersToNotify(notifySetting, uuid, project, task = null, notifyUsers = []) {
    try {
        if (notifySetting === 'all') {
            const projectTeam = projectsAPI.constructProjectTeam(project, uuid);
            const emails = await usersAPI.getUserEmails(projectTeam);
            return emails;
        }
        if (notifySetting === 'specific' && Array.isArray(notifyUsers)) {
            const projectTeam = projectsAPI.constructProjectTeam(project, uuid).filter((item) => (
                notifyUsers.includes(item)
            ));
            const emails = await usersAPI.getUserEmails(projectTeam);
            return emails;
        }
        if (notifySetting === 'support') {
            return ['support@libretexts.org'];
        }
        if (notifySetting === 'assigned' && Array.isArray(task?.assignees)) {
            const assignees = task.assignees.filter((item) => item !== uuid);
            const emails = await usersAPI.getUserEmails(assignees);
            return emails;
        }
        return [];
    } catch (e) {
        debugError(e);
    }
}

/**
 * Validate a provided Thread Kind.
 * @returns {Boolean} true if valid Kind, false otherwise.
 */
const validateThreadKind = (kind) => {
    if (kind.length > 0) {
        if ((kind === 'project') || (kind === 'a11y') || (kind === 'peerreview')) return true;
    }
    return false
};

/**
 * Validates a provided notification setting option during thread message sending.
 *
 * @param {string} notifySetting - The notification setting identifier.
 * @returns {boolean} True if valid, false otherwise.
 */
function validateThreadMessageNotifySetting(notifySetting) {
    if (typeof (notifySetting) === 'string') {
        return THREAD_NOTIFY_OPTIONS.includes(notifySetting);
    }
    return false;
};

/**
 * Validates a provided notification setting option during task message sending.
 *
 * @param {string} notifySetting - The notification setting identifier.
 * @returns {boolean} True if valid, false otherwise.
 */
function validateTaskMessageNotifySetting(notifySetting) {
    if (typeof (notifySetting) === 'string') {
        return [...THREAD_NOTIFY_OPTIONS, 'assigned'].includes(notifySetting);
    }
    return false;
}

/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'createDiscussionThread':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
                body('kind', conductorErrors.err1).exists().isString().custom(validateThreadKind),
                body('defaultNotifSubject', conductorErrors.err1).exists().isString().custom(validateThreadMessageNotifySetting),
            ]
        case 'updateDiscussionThread':
            return [
                body('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 }),
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
                body('defaultNotifSubject', conductorErrors.err1).exists().isString().custom(validateThreadMessageNotifySetting),
            ]
        case 'deleteDiscussionThread':
            return [
                body('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 })
            ]
        case 'getProjectThreads':
            return [
                query('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                query('kind', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateThreadKind)
            ]
        case 'createThreadMessage':
            return [
                param('threadID', conductorErrors.err1).exists().isLength({ min: 14, max: 14 }),
                body('message', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 2000 }),
                body('notify', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateThreadMessageNotifySetting),
                body('notifyUsers', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUUIDArray),
            ]
        case 'createTaskMessage':
            return [
                param('taskID', conductorErrors.err1).exists().isLength({ min: 16, max: 16 }),
                body('message', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 2000 }),
                body('notify', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateTaskMessageNotifySetting),
                body('notifyUsers', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUUIDArray),
            ]
        case 'deleteMessage':
            return [
                body('messageID', conductorErrors.err1).exists().isString().isLength({ min: 15, max: 15 }),
            ]
        case 'getThreadMessages':
            return [
                query('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 })
            ]
        case 'getTaskMessages':
            return [
                query('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16 })
            ]
    }
};

export default {
    createDiscussionThread,
    updateDiscussionThread,
    deleteDiscussionThread,
    getProjectThreads,
    createThreadMessage,
    createTaskMessage,
    deleteMessage,
    getThreadMessages,
    getTaskMessages,
    validate
}
