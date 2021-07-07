'use strict';
const User = require('../models/user.js');
const AdminTask = require('../models/admintask.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const keys = require('../../config/keys.js');

const addTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.title != null) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    if (userResult.roles.includes('admin')) {
                        var newTask = new AdminTask({
                            adminTaskID: b62(10),
                            title: req.body.title,
                            status: req.body.status,
                            description: req.body.description
                        });
                        return newTask.save();
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    response.err = false;
                    response.msg = "New admin task added.";
                    response.id = newDoc.adminTaskID;
                    return res.send(response);
                } else {
                    throw("An error occured saving the new task.");
                }
            }).catch((err) => {
                console.log(err);
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getAllTasks = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        AdminTask.aggregate([
            {
                $match: {
                    status: {
                        $in: ['ready', 'wait', 'review']
                    }
                }
            }, {
                $limit: 50
            }, {
                $project: {
                    _id: 0,
                    "id": "$adminTaskID",
                    title: 1,
                    status: 1
                }
            }
        ]).then((taskResults) => {
            console.log(taskResults);
            if (taskResults.length > 0) {
                response.err = false;
                response.tasks = taskResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No tasks available.";
                response.tasks = [];
                return res.send(response);
            }
        }).catch((err) => {
            console.log(err);
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getTaskDetail = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        AdminTask.aggregate([
            {
                $match: {
                    adminTaskID: req.query.id
                }
            }, {
                $limit: 1
            }, {
                $project: {
                    _id: 0,
                    "id": "$adminTaskID",
                    title: 1,
                    status: 1,
                    description: 1
                }
            }
        ]).then((taskResults) => {
            if (taskResults.length > 0) {
                response.err = false;
                response.task = taskResults[0];
            } else {
                response.err = true;
                response.errMsg = "Couldn't find a task with that ID.";
                response.task = null;
            }
            return res.send(response);
        }).catch((err) => {
            console.log(err);
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const updateTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        AdminTask.findOne({
            adminTaskID: req.body.id
        }).then((taskResult) => {
            var result = {};
            if (taskResult != null) {
                var toSet = {};
                if (req.body.title) {
                    toSet.title = req.body.title;
                }
                if (req.body.status) {
                    toSet.status = req.body.status;
                }
                if (req.body.description) {
                    toSet.description = req.body.description;
                }
                return AdminTask.updateOne({
                    adminTaskID: req.body.id
                }, { $set: toSet });
            } else {
                throw("Couldn't find a task with that ID.");
            }
        }).then((updatedTask) => {
            if (updatedTask) {
                response.err = false;
                response.id = req.body.id;
                return res.send(response);
            } else {
                response.err = true;
                response.errMsg = "Couldn't update the task with that ID.";
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const deleteTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.id != null) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    var user = {};
                    user.roles = userResult.roles;
                    const foundAdminRole = user.roles.includes('admin');
                    if (foundAdminRole) {
                        return AdminTask.deleteOne({
                            adminTaskID: req.body.id
                        });
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((deleteResult) => {
                if (deleteResult.deletedCount == 1) {
                    response.err = false;
                    response.deletedTask = true;
                    return res.send(response);
                } else {
                    throw("An error occurred deleting the task. Check the ID.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

module.exports = {
    addTask,
    getAllTasks,
    getTaskDetail,
    updateTask,
    deleteTask
};
