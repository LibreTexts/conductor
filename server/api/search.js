'use strict';
const mongoose = require('mongoose');
const User = require('../models/user.js');
const AdminProject = require('../models/adminproject.js');
const DevelopmentProject = require('../models/developmentproject.js');
const HarvestingProject = require('../models/harvestingproject.js');
const AdminTask = require('../models/admintask.js');
const DevTask = require('../models/devtask.js');
const TextbookTarget = require('../models/textbooktarget.js');

const performSearch = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    var roles = [];
    var aProjRes = [];
    var dProjRes = [];
    var hProjRes = [];
    var aTaskRes = [];
    var dTaskRes = [];
    var hTargetRes = [];
    var userResults = [];
    var adminPriv = false;
    var devPriv = false;
    var harPriv = false;
    if (decoded != null && req.query.query != null) {
        var query = req.query.query;
        const queryRegex = {
            $regex: query,
            $options: 'i'
        };
        var chain = User.findOne({
            uuid: decoded.uuid
        });
        chain = chain.then((user) => {
            if (user) {
                roles = user.roles;
                if (roles.includes('admin')) {
                    adminPriv = true;
                    devPriv = true;
                    harPriv = true;
                }
                if (roles.includes('dev')) {
                    devPriv = true;
                }
                if (roles.includes('harvest')) {
                    harPriv = true;
                }
                return User.find({
                    $or: [
                        {firstName: queryRegex},
                        {lastName: queryRegex}
                    ]
                });
            } else {
                throw("Couldn't find a user with that identity.");
            }
        }).then((foundUsers) => {
            console.log("Admin: ", adminPriv);
            console.log("Dev: ", devPriv);
            console.log("Harvest: ", harPriv);
            console.log(foundUsers);
            if (foundUsers.length > 0) {
                foundUsers.forEach((item) => {
                    var obj = {
                        firstName: item.firstName,
                        lastName: item.lastName
                    };
                    userResults.push(obj);
                });
            }
        });

        if (adminPriv == true) {
            console.log("ADMIN PRIV!");
            chain = chain.then(() => {
                console.log("SEARCH1");
                return AdminProject.find({
                    $or: [
                        {title: queryRegex},
                        {description: queryRegex}
                    ]
                });
            }).then((foundAProjs) => {
                console.log("SEARCH2");
                foundAProjs.forEach((item) => {
                    var obj = {
                        projectID: item.projectID,
                        title: item.title,
                        status: item.status
                    };
                    aProjRes.push(obj);
                });
                return AdminTask.find({
                    $or: [
                        {title: queryRegex},
                        {description: queryRegex}
                    ]
                });
            }).then((foundATasks) => {
                console.log("SEARCH3");
                foundATasks.forEach((item) => {
                    var obj = {
                        adminTaskID: item.adminTaskID,
                        title: item.title,
                        status: item.status
                    };
                    aTaskRes.push(obj);
                });
            });
        }

        chain = chain.then(() => {
            console.log(userResults);
            var resultCount = aProjRes.length + dProjRes.length + hProjRes.length + aTaskRes.length
                + dTaskRes.length + hTargetRes.length + userResults.length;
            response.err = false;
            response.resultCount = resultCount;
            response.users = userResults;
            response.adminTasks = aTaskRes;
            response.adminProjs = aProjRes;
            return res.send(response);
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
        return chain;
    }
};

module.exports = {
    performSearch
};
