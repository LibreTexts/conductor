'use strict';
const User = require('../models/user.js');
const DevTask = require('../models/devtask.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');

const addTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != undefined) {
        if (req.body.title != undefined) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    if (userResult.roles.includes('admin')) {
                        var newTask = new DevTask({
                            devTaskID: b62(10),
                            title: req.body.title,
                            status: req.body.status,
                            description: req.body.description,
                            resourceURL: req.body.resourceURL
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
                    response.msg = "New dev task added.";
                    response.id = newDoc.devTaskID;
                    return res.send(response);
                } else {
                    throw("An error occured saving the new task.");
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

const getAllTasks = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevTask.aggregate([
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
                    "id": "$devTaskID",
                    title: 1,
                    status: 1
                }
            }
        ]).then((taskResults) => {
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
    if (decoded != undefined) {
        if (req.query.id !== undefined) {
            DevTask.aggregate([
                {
                    $match: {
                        devTaskID: req.query.id
                    }
                }, {
                    $limit: 1
                }, {
                    $project: {
                        _id: 0,
                        "id": "$devTaskID",
                        title: 1,
                        status: 1,
                        description: 1,
                        resourceURL: 1
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

const updateTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevTask.findOne({
            devTaskID: req.body.id
        }).then((taskResult) => {
            var result = {};
            if (taskResult != undefined) {
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
                if (req.body.resourceURL) {
                    toSet.resourceURL = req.body.resourceURL;
                }
                return DevTask.updateOne({
                    devTaskID: req.body.id
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
                    if (userResult.roles.includes('admin')) {
                        return DevTask.deleteOne({
                            devTaskID: req.body.id
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
