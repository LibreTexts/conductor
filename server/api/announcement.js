'use strict';
const User = require('../models/user.js');
const Announcement = require('../models/announcement.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = require('../../config/keys.js');

const postAnnouncement = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.title !== null && req.body.message !== null && req.body.recipientGroups !== null) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    var user = {};
                    user.roles = userResult.roles;
                    user.uuid = userResult.uuid;
                    const foundAdminRole = user.roles.includes('admin');
                    if (foundAdminRole) {
                        var newAnnounce = new Announcement();
                        newAnnounce.author = user.uuid;
                        newAnnounce.title = req.body.title;
                        newAnnounce.message = req.body.message;
                        newAnnounce.recipientGroups = req.body.recipientGroups;
                        return newAnnounce.save();
                    } else {
                        response.err = true;
                        response.errMsg = "Sorry, you don't have the proper privileges to perform this action.";
                        return res.send(response);
                    }
                } else {
                    response.err = true;
                    response.errMsg = "Couldn't find a user with that identity.";
                    return res.send(response);
                }
            }).then((doc) => {
                response.err = false;
                response.msg = "Announcement posted.";
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
        response.errmsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getAllAnnouncements = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.findOne({
            uuid: decoded.uuid
        }).then((userResult) => {
            if (userResult) {
                var user = {};
                user.uuid = userResult.uuid;
                user.roles = userResult.roles;
                const arrayRoles = user.roles.concat(['all']);
                return Announcement.find({
                    recipientGroups: {
                        $in: arrayRoles
                    }
                }).sort({
                    _id: -1
                }).limit(50);
            } else {
                response.err = true;
                response.errMsg = "Couldn't find a user with that identity.";
                return res.send(response);
            }
        }).then((announceResults) => {
            if (announceResults.length > 0) {
                var resultArray = [];
                async.each(announceResults, (announce, callback) => {
                    User.findOne({
                        uuid: announce.author
                    }, (authorErr, authorResult) => {
                        if (!authorErr && authorResult) {
                            const processedAnnounce = {
                                author: {
                                    uuid: authorResult.uuid,
                                    firstName: authorResult.firstName,
                                    lastName: authorResult.lastName,
                                    avatar: authorResult.avatar
                                },
                                title: announce.title,
                                message: announce.message,
                                recipientGroups: announce.recipientGroups,
                                createdAt: announce.createdAt
                            };
                            resultArray.push(processedAnnounce);
                        }
                        callback();
                    });
                }, (err) => {
                    if (err) throw err;
                    response.err = false;
                    response.announcements = resultArray;
                    return res.send(response);
                });
            } else {
                response.err = false;
                response.msg = "No announcements available.";
                response.announcements = [];
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errmsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getRecentAnnouncement = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    var result = {};
    if (decoded != null) {
        User.findOne({
            uuid: decoded.uuid
        }).then((userResult) => {
            if (userResult) {
                var user = {};
                user.uuid = userResult.uuid;
                user.roles = userResult.roles;
                const arrayRoles = user.roles.concat(['all']);
                return Announcement.findOne({
                    recipientGroups: {
                        $in: arrayRoles
                    }
                }).sort({ _id: -1 });
            } else {
                throw("Couldn't find a user with that identity.");
            }
        }).then((announceResult) => {
            if (announceResult) {
                result.title = announceResult.title;
                result.message = announceResult.message;
                result.recipientGroups = announceResult.recipientGroups;
                result.createdAt = announceResult.createdAt;
                return User.findOne({ uuid: announceResult.author }).lean();
            } else {
                throw("none");
            }
        }).then((author) => {
            if (author) {
                result.author = {
                    uuid: author.uuid,
                    firstName: author.firstName,
                    lastName: author.lastName,
                    avatar: author.avatar
                };
            } else {
                result.author = {
                    uuid: "",
                    firstName: "Unknown",
                    lastName: "User"
                };
            }
            response.err = false;
            response.announcement = result;
            return res.send(response);
        }).catch((err) => {
            if (err === "none") {
                response.err = false;
                response.announcement = null;
            } else {
                response.err = true;
                response.errMsg = err;
                response.announcement = null;
            }
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errmsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};


module.exports = {
    postAnnouncement,
    getAllAnnouncements,
    getRecentAnnouncement
};
