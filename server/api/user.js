'use strict';
const mongoose = require('mongoose');
const User = require('../models/user.js');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const createUserBasic = (req, res, next) => {
    var response = {};
    var newUser = new User();
    newUser.uuid = uuidv4();
    newUser.firstName = req.body.firstName;
    newUser.lastName = req.body.lastName;
    newUser.email = req.body.email;
    newUser.roles = req.body.roles;
    bcrypt.genSalt(10).then((salt) => {
        newUser.salt = salt;
        return bcrypt.hash(req.body.password, salt);
    }).then((hash) => {
        newUser.hash = hash;
        return newUser.save();
    }).then((doc) => {
        response.err = false;
        response.msg = "New user created.";
        return res.send(response);
    }).catch((err) => {
        response.err = true;
        response.msg = "Error creating user.";
        response.errMsg = err;
        return res.send(response);
    });
};

const basicUserInfo = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.findOne({
            uuid: decoded.uuid
        }).then((userResult) => {
            if (userResult !== null) {
                response.err = false;
                var user = {};
                user.firstName = userResult.firstName;
                user.lastName = userResult.lastName;
                user.roles = userResult.roles;
                user.avatar = userResult.avatar;
                response.user = user;
                return res.send(response);
            } else {
                response.err = true;
                response.errMsg = "Couldn't find a user with that identity.";
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

const basicAccountInfo = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.findOne({
            uuid: decoded.uuid
        }).then((userResult) => {
            if (userResult !== null) {
                response.err = false;
                var account = {};
                account.email = userResult.email;
                account.firstName = userResult.firstName;
                account.lastName = userResult.lastName;
                account.roles = userResult.roles;
                account.avatar = userResult.avatar;
                if (account.createdAt != null) {
                    account.createdAt = userResult.createdAt;
                } else {
                    account.createdAt = userResult._id.getTimestamp();
                }
                response.account = account;
                return res.send(response);
            } else {
                response.err = true;
                response.errMsg = "Couldn't find a user with that identity.";
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

const getAdmins = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.find({
            roles: 'admin'
        }, {
            _id: 0,
            __v: 0,
            email: 0,
            hash: 0,
            salt: 0,
        }).then((userResults) => {
            if (userResults.length > 0) {
                response.err = false;
                response.admins = userResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No results found.";
                response.admins = [];
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

const getDevelopers = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.find({
            roles: 'dev'
        }, {
            _id: 0,
            __v: 0,
            email: 0,
            hash: 0,
            salt: 0,
        }).then((userResults) => {
            if (userResults.length > 0) {
                response.err = false;
                response.developers = userResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No results found.";
                response.admins = [];
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

const getHarvesters = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        User.find({
            roles: 'harvest'
        }, {
            _id: 0,
            __v: 0,
            email: 0,
            hash: 0,
            salt: 0,
        }).then((userResults) => {
            if (userResults.length > 0) {
                response.err = false;
                response.harvesters = userResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No results found.";
                response.admins = [];
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

module.exports = {
    createUserBasic,
    basicUserInfo,
    basicAccountInfo,
    getAdmins,
    getDevelopers,
    getHarvesters
};
