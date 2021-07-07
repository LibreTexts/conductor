'use strict';
const User = require('../models/user.js');
const TextbookTarget = require('../models/textbooktarget.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');

const addTarget = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.title != null) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    if (userResult.roles.includes('admin')) {
                        var newTarget = new TextbookTarget({
                            textbookTargetID: b62(10),
                            title: req.body.title,
                            library: req.body.library,
                            shelf: req.body.shelf,
                            originalURL: req.body.originalURL,
                            type: req.body.type,
                            status: req.body.status,
                            notes: req.body.notes
                        });
                        return newTarget.save();
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    response.err = false;
                    response.msg = "New textbook target added.";
                    response.id = newDoc.textbookTargetID;
                    return res.send(response);
                } else {
                    throw("An error occured saving the new target.");
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

const getAllTargets = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        TextbookTarget.find({
            status: {
                $in: ['ready', 'wait', 'review']
            }
        }, {}, {
            $sort: {
                title: 1
            }
        }).limit(50).then((targetResults) => {
            if (targetResults.length > 0) {
                var resultArray = [];
                targetResults.forEach((result) => {
                    const processedTarget = {
                        id: result.textbookTargetID,
                        title: result.title,
                        library: result.library,
                        shelf: result.shelf,
                        type: result.type,
                        status: result.status
                    };
                    resultArray.push(processedTarget);
                });
                response.err = false;
                response.targets = resultArray;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No targets available.";
                response.targets = [];
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

const getTargetDetail = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        TextbookTarget.findOne({
            textbookTargetID: req.query.id
        }).then((targetResult) => {
            var result = {};
            if (targetResult != null) {
                result = {
                    id: targetResult.textbookTargetID,
                    title: targetResult.title,
                    library: targetResult.library,
                    shelf: targetResult.shelf,
                    originalURL: targetResult.originalURL,
                    type: targetResult.type,
                    status: targetResult.status,
                    projectID: targetResult.projectID,
                    notes: targetResult.notes
                };
                response.err = false;
                response.target = result;
                return res.send(response);
            } else {
                response.err = true;
                response.errMsg = "Couldn't find a target with that ID.";
                response.target = null;
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

const updateTarget = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    var id;
    if (decoded != null) {
        TextbookTarget.findOne({
            textbookTargetID: req.body.id
        }).then((targetResult) => {
            var result = {};
            if (targetResult != null) {
                id = targetResult.textbookTargetID;
                var toSet = {};
                if (req.body.title) {
                    toSet.title = req.body.title;
                }
                if (req.body.library) {
                    toSet.library = req.body.library;
                }
                if (req.body.shelf) {
                    toSet.shelf = req.body.shelf;
                }
                if (req.body.originalURL) {
                    toSet.originalURL = req.body.originalURL;
                }
                if (req.body.type) {
                    toSet.type = req.body.type;
                }
                if (req.body.status) {
                    toSet.status = req.body.status;
                }
                if (req.body.notes) {
                    toSet.notes = req.body.notes;
                }
                return TextbookTarget.updateOne({
                    textbookTargetID: id
                }, { $set: toSet });
            } else {
                throw("Couldn't find a target with that ID.");
            }
        }).then((updatedTarget) => {
            if (updatedTarget) {
                response.err = false;
                response.id = id;
                return res.send(response);
            } else {
                response.err = true;
                response.errMsg = "Couldn't update the target with that ID.";
                response.target = null;
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

const deleteTarget = (req, res, next) => {
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
                    user.uuid = userResult.uuid;
                    const foundAdminRole = user.roles.includes('admin');
                    if (foundAdminRole) {
                        return TextbookTarget.deleteOne({
                            textbookTargetID: req.body.id
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
                    response.deletedTarget = true;
                    return res.send(response);
                } else {
                    throw("An error occurred deleting the target. Check the ID.");
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
    addTarget,
    getAllTargets,
    getTargetDetail,
    updateTarget,
    deleteTarget
};
