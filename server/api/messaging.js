//
// LibreTexts Conductor
// messaging.js
//

'use strict';
const User = require('../models/user.js');
const Project = require('../models/project.js');
const Task = require('../models/task.js');
const Thread = require('../models/thread.js');
const Message = require('../models/message.js');
const { body, query } = require('express-validator');
const b62 = require('base62-random');
const { validate: uuidValidate } = require('uuid');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const { isEmptyString } = require('../util/helpers.js');

const authAPI = require('./auth.js');
const mailAPI = require('./mail.js');
const projectsAPI = require('./projects.js');
const usersAPI = require('./users.js');


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
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createThreadMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createThreadMessage = (req, res) => {
    let discussionKind = null;
    let threadTitle = null;
    let projectData = {};
    let sentMessage = false;
    let sentMsgData = {};
    let allowNotif = true;
    let sentNotif = false;
    const currentTime = new Date();
    Thread.findOne({
        threadID: req.body.threadID
    }).lean().then((thread) => {
        if (thread) {
            if (thread.hasOwnProperty('lastNotifSent')) {
                // rate limit email notifications
                const lastNotifTime = new Date(thread.lastNotifSent);
                const minutesSince = (currentTime - lastNotifTime) / (1000 * 60);
                if (minutesSince < 15) {
                    allowNotif = false;
                }
            }
            threadTitle = thread.title;
            switch (thread.kind) {
                case 'peerreview':
                    discussionKind = 'Peer Review';
                    break;
                case 'a11y':
                    discussionKind = 'accessibility';
                    break;
                default:
                    discussionKind = 'Project';
            }
            return Project.findOne({
                projectID: thread.project
            }).lean();
        } else {
            throw(new Error('notfound'));
        }
    }).then((project) => {
        if (project) {
            projectData = project;
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                const message = new Message({
                    messageID: b62(15),
                    thread: req.body.threadID,
                    body: req.body.message,
                    author: req.user.decoded.uuid
                });
                return message.save();
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((newMsg) => {
        if (newMsg) {
            sentMessage = true;
            sentMsgData = newMsg;
            if (allowNotif) {
                let projectTeam = projectsAPI.constructProjectTeam(projectData, req.user.decoded.uuid);
                return usersAPI.getUserEmails(projectTeam);
            } else {
                return [];
            }
        } else {
            throw(new Error('createfail'));
        }
    }).then((teamEmails) => {
        if (allowNotif && Array.isArray(teamEmails) && teamEmails.length > 0) {
            // send email notifications
            sentNotif = true;
            return mailAPI.sendNewProjectMessagesNotification(teamEmails, projectData.projectID,
                projectData.title, projectData.orgID, discussionKind, threadTitle, sentMsgData.body);
        } else {
            return {};
        }
    }).then(() => {
        // ignore return value of Mailgun call
        if (sentNotif) {
            return Thread.updateOne({
                threadID: req.body.threadID
            }, {
                lastNotifSent: currentTime
            });
        } else {
            return {};
        }
    }).then(() => {
        // ignore return value of update
        return res.send({
            err: false,
            msg: 'Message successfully sent.',
            messageID: sentMsgData.messageID
        });
    }).catch((err) => {
        debugError(err);
        // return success as long as message was sent, ignoring notification failures
        if (sentMessage) {
            return res.send({
                err: false,
                msg: 'Message successfully sent.',
                messageID: sentMsgData.messageID
            });
        } else {
            debugError(err);
            var errMsg = conductorErrors.err6;
            if (err.message === 'notfound') errMsg = conductorErrors.err11;
            else if (err.message === 'unauth') errMsg = conductorErrors.err8;
            else if (err.message === 'createfail') errMsg = conductorErrors.err3;
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
    });
};


/**
 * Creates a new Message within a Task.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'createTaskMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const createTaskMessage = (req, res) => {
    let task = {};
    let project = {};
    let sentMessage = false;
    let sentMsgData = {};
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
    }).then((projectData) => {
        if (projectData) {
            project = projectData;
            if (projectsAPI.checkProjectMemberPermission(project, req.user)) {
                const message = new Message({
                    messageID: b62(15),
                    task: task.taskID,
                    body: req.body.message,
                    author: req.user.decoded.uuid
                });
                return message.save();
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
    }).then((newMsg) => {
        if (newMsg) {
            sentMessage = true;
            sentMsgData = newMsg;
            let projectTeam = projectsAPI.constructProjectTeam(projectData, req.user.decoded.uuid);
            return usersAPI.getUserEmails(projectTeam);
        } else {
            throw(new Error('createfail'));
        }
    }).then((teamEmails) => {
        if (Array.isArray(teamEmails) && teamEmails.length > 0) {
            return mailAPI.sendNewProjectMessagesNotification(teamEmails, project.projectID,
                project.title, project.orgID, 'Tasks', task.title, sentMsgData.body);
        } else {
            return {};
        }
    }).then(() => {
        // ignore return value of Mailgun call
        return res.send({
            err: false,
            msg: 'Message successfully sent.',
            messageID: sentMsgData.messageID
        });
    }).catch((err) => {
        // return success as long as message was sent, ignoring notification failures
        if (sentMessage) {
            return res.send({
                err: false,
                msg: 'Message successfully sent.',
                messageID: sentMsgData.messageID
            });
        } else {
            debugError(err);
            var errMsg = conductorErrors.err6;
            if (err.message === 'notfound') errMsg = conductorErrors.err11;
            else if (err.message === 'unauth') errMsg = conductorErrors.err8;
            else if (err.message === 'createfail') errMsg = conductorErrors.err3;
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
    });
};


/**
 * Deletes a Message within a Project Thread or Task.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteMessage'
 * @param {Object} req - the express.js request object.
 * @param {Object} res - the express.js response object.
 */
const deleteMessage = (req, res) => {
    Message.findOne({
        messageID: req.body.messageID
    }).lean().then((message) => {
        if (message) {
            if ((message.author === req.user?.decoded?.uuid)
                || (authAPI.checkHasRole(req.user, 'libretexts', 'superadmin'))) {
                    return Message.deleteOne({
                        messageID: req.body.messageID
                    })
            } else {
                throw(new Error('unauth'));
            }
        } else {
            throw(new Error('notfound'));
        }
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
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'createDiscussionThread':
            return [
                body('projectID', conductorErrors.err1).exists().isString().isLength({ min: 10, max: 10 }),
                body('title', conductorErrors.err1).exists().isString().isLength({ min: 1 }),
                body('kind', conductorErrors.err1).exists().isString().custom(validateThreadKind)
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
                body('threadID', conductorErrors.err1).exists().isString().isLength({ min: 14, max: 14 }),
                body('message', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 2000 })
            ]
        case 'createTaskMessage':
            return [
                body('taskID', conductorErrors.err1).exists().isString().isLength({ min: 16, max: 16 }),
                body('message', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 2000 })
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

module.exports = {
    createDiscussionThread,
    deleteDiscussionThread,
    getProjectThreads,
    createThreadMessage,
    createTaskMessage,
    deleteMessage,
    getThreadMessages,
    getTaskMessages,
    validate
};
