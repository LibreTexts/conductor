'use strict';
const express = require('express');
// Interfaces
const authInterface = require('./api/auth.js');
const userInterface = require('./api/user.js');
const searchInterface = require('./api/search.js');
const announcementInterface = require('./api/announcement.js');
const sharedProjectsInterface = require('./api/projects.js');

const adminTasksInterface = require('./api/admintasks.js');
const adminProjectsInterface = require('./api/adminprojects.js');

const devTasksInterface = require('./api/devtasks.js');
const developmentProjectsInterface = require('./api/developmentprojects.js');

const harvestingTargetsInterface = require('./api/harvestingtargets.js');
const harvestingProjectsInterface = require('./api/harvestingprojects.js');


var router = express.Router();

router.use((req, res, next) => {
    var allowedOrigins = [];
    var origin = req.headers.origin;
    if (process.env.NODE_ENV === 'production') {
        allowedOrigins = [process.env.PRODUCTIONURL];
    } else if (process.env.NODE_ENV === 'development') {
        console.log('[SERVER]: METHOD: ', req.method);
        allowedOrigins = ['http://localhost:7000'];
    }
    if (allowedOrigins.indexOf(origin) > -1) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.method !== 'OPTIONS') {
        if (req.header('X-Requested-With') !== 'XMLHttpRequest') {
            return res.status(403).send({
                err: true,
                errMsg: "Invalid request."
            });
        }
        if (req.cookies.access_token !== undefined && req.cookies.signed_token !== undefined) {
            req.headers.authorization = req.cookies.access_token + '.' + req.cookies.signed_token;
        }
    }
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization, Access-Control-Allow-Credentials, X-Requested-With');
    return next();
});

/* Auth */
router.route('/v1/auth/login').post(authInterface.login);

/* Search */
//router.route('/v1/search').get(authInterface.verifyRequest, searchInterface.performSearch);

/* Users */
//router.route('/v1/user/createuserbasic').post(userInterface.createUserBasic);
router.route('/v1/user/basicinfo').get(authInterface.verifyRequest, userInterface.basicUserInfo);
router.route('/v1/user/accountinfo').get(authInterface.verifyRequest, userInterface.basicAccountInfo);
router.route('/v1/user/getadmins').get(authInterface.verifyRequest, userInterface.getAdmins);
router.route('/v1/user/getdevelopers').get(authInterface.verifyRequest, userInterface.getDevelopers);
router.route('/v1/user/getharvesters').get(authInterface.verifyRequest, userInterface.getHarvesters);

/* Announcements */
router.route('/v1/announcements/create').post(authInterface.verifyRequest, announcementInterface.postAnnouncement);
router.route('/v1/announcements/all').get(authInterface.verifyRequest, announcementInterface.getAllAnnouncements);
router.route('/v1/announcements/recent').get(authInterface.verifyRequest, announcementInterface.getRecentAnnouncement);

/* Projects (General) */
router.route('/v1/projects/all').get(authInterface.verifyRequest, sharedProjectsInterface.getAllUserProjects);
router.route('/v1/projects/recent').get(authInterface.verifyRequest, sharedProjectsInterface.getRecentUserProjects);

/* Harvesting */
// Targetlist
router.route('/v1/harvesting/targetlist/all').get(authInterface.verifyRequest, harvestingTargetsInterface.getAllTargets);
router.route('/v1/harvesting/targetlist/add').post(authInterface.verifyRequest, harvestingTargetsInterface.addTarget);
router.route('/v1/harvesting/targetlist/targets/detail').get(authInterface.verifyRequest, harvestingTargetsInterface.getTargetDetail);
router.route('/v1/harvesting/targetlist/targets/update').post(authInterface.verifyRequest, harvestingTargetsInterface.updateTarget);
router.route('/v1/harvesting/targetlist/targets/delete').post(authInterface.verifyRequest, harvestingTargetsInterface.deleteTarget);

// Projects
router.route('/v1/harvesting/projects/addexisting').post(authInterface.verifyRequest, harvestingProjectsInterface.addExistingProject);
router.route('/v1/harvesting/projects/newfromtarget').post(authInterface.verifyRequest, harvestingProjectsInterface.newProjectFromTarget);
router.route('/v1/harvesting/projects/newforassignee').post(authInterface.verifyRequest, harvestingProjectsInterface.newProjectForAssignee);
router.route('/v1/harvesting/projects/detail').get(authInterface.verifyRequest, harvestingProjectsInterface.getProjectDetail);
router.route('/v1/harvesting/projects/update').post(authInterface.verifyRequest, harvestingProjectsInterface.updateProject);
router.route('/v1/harvesting/projects/flag').post(authInterface.verifyRequest, harvestingProjectsInterface.flagProject);
router.route('/v1/harvesting/projects/unflag').post(authInterface.verifyRequest, harvestingProjectsInterface.unflagProject);
router.route('/v1/harvesting/projects/markcompleted').post(authInterface.verifyRequest, harvestingProjectsInterface.markProjectCompleted);
router.route('/v1/harvesting/projects/delete').post(authInterface.verifyRequest, harvestingProjectsInterface.deleteProject);
router.route('/v1/harvesting/projects/current').get(authInterface.verifyRequest, harvestingProjectsInterface.getCurrentProjects);
router.route('/v1/harvesting/projects/flagged').get(authInterface.verifyRequest, harvestingProjectsInterface.getFlaggedProjects);
router.route('/v1/harvesting/projects/recentlycompleted').get(authInterface.verifyRequest, harvestingProjectsInterface.getRecentlyCompletedProjects);
router.route('/v1/harvesting/projects/completed').get(authInterface.verifyRequest, harvestingProjectsInterface.getAllCompletedProjects);
router.route('/v1/harvesting/projects/updates/all').get(authInterface.verifyRequest, harvestingProjectsInterface.getAllProgressUpdates);
router.route('/v1/harvesting/projects/updates/new').post(authInterface.verifyRequest, harvestingProjectsInterface.addProgressUpdate);
router.route('/v1/harvesting/projects/updates/delete').post(authInterface.verifyRequest, harvestingProjectsInterface.deleteProgressUpdate);
router.route('/v1/harvesting/projects/updates/feed').get(authInterface.verifyRequest, harvestingProjectsInterface.getUpdatesFeed);

/* Development */
// Task Queue
router.route('/v1/development/taskqueue/all').get(authInterface.verifyRequest, devTasksInterface.getAllTasks);
router.route('/v1/development/taskqueue/add').post(authInterface.verifyRequest, devTasksInterface.addTask);
router.route('/v1/development/taskqueue/tasks/detail').get(authInterface.verifyRequest, devTasksInterface.getTaskDetail);
router.route('/v1/development/taskqueue/tasks/update').post(authInterface.verifyRequest, devTasksInterface.updateTask);
router.route('/v1/development/taskqueue/tasks/delete').post(authInterface.verifyRequest, devTasksInterface.deleteTask);

// Projects
router.route('/v1/development/projects/addexisting').post(authInterface.verifyRequest, developmentProjectsInterface.addExistingProject);
router.route('/v1/development/projects/newfromtask').post(authInterface.verifyRequest, developmentProjectsInterface.newProjectFromTask);
router.route('/v1/development/projects/newforassignee').post(authInterface.verifyRequest, developmentProjectsInterface.newProjectForAssignee);
router.route('/v1/development/projects/detail').get(authInterface.verifyRequest, developmentProjectsInterface.getProjectDetail);
router.route('/v1/development/projects/update').post(authInterface.verifyRequest, developmentProjectsInterface.updateProject);
router.route('/v1/development/projects/flag').post(authInterface.verifyRequest, developmentProjectsInterface.flagProject);
router.route('/v1/development/projects/unflag').post(authInterface.verifyRequest, developmentProjectsInterface.unflagProject);
router.route('/v1/development/projects/markcompleted').post(authInterface.verifyRequest, developmentProjectsInterface.markProjectCompleted);
router.route('/v1/development/projects/delete').post(authInterface.verifyRequest, developmentProjectsInterface.deleteProject);
router.route('/v1/development/projects/current').get(authInterface.verifyRequest, developmentProjectsInterface.getCurrentProjects);
router.route('/v1/development/projects/flagged').get(authInterface.verifyRequest, developmentProjectsInterface.getFlaggedProjects);
router.route('/v1/development/projects/recentlycompleted').get(authInterface.verifyRequest, developmentProjectsInterface.getRecentlyCompletedProjects);
router.route('/v1/development/projects/completed').get(authInterface.verifyRequest, developmentProjectsInterface.getAllCompletedProjects);
router.route('/v1/development/projects/updates/all').get(authInterface.verifyRequest, developmentProjectsInterface.getAllProgressUpdates);
router.route('/v1/development/projects/updates/new').post(authInterface.verifyRequest, developmentProjectsInterface.addProgressUpdate);
router.route('/v1/development/projects/updates/delete').post(authInterface.verifyRequest, developmentProjectsInterface.deleteProgressUpdate);
router.route('/v1/development/aio/all').get(authInterface.verifyRequest, developmentProjectsInterface.getAIOFeed);

/* Administration */
// Task Queue
router.route('/v1/admin/taskqueue/all').get(authInterface.verifyRequest, adminTasksInterface.getAllTasks);
router.route('/v1/admin/taskqueue/add').post(authInterface.verifyRequest, adminTasksInterface.addTask);
router.route('/v1/admin/taskqueue/tasks/detail').get(authInterface.verifyRequest, adminTasksInterface.getTaskDetail);
router.route('/v1/admin/taskqueue/tasks/update').post(authInterface.verifyRequest, adminTasksInterface.updateTask);
router.route('/v1/admin/taskqueue/tasks/delete').post(authInterface.verifyRequest, adminTasksInterface.deleteTask);

// Projects
router.route('/v1/admin/projects/addexisting').post(authInterface.verifyRequest, adminProjectsInterface.addExistingProject);
router.route('/v1/admin/projects/newfromtask').post(authInterface.verifyRequest, adminProjectsInterface.newProjectFromTask);
router.route('/v1/admin/projects/detail').get(authInterface.verifyRequest, adminProjectsInterface.getProjectDetail);
router.route('/v1/admin/projects/update').post(authInterface.verifyRequest, adminProjectsInterface.updateProject);
router.route('/v1/admin/projects/addassignee').post(authInterface.verifyRequest, adminProjectsInterface.addProjectAssignee);
router.route('/v1/admin/projects/markcompleted').post(authInterface.verifyRequest, adminProjectsInterface.markProjectCompleted);
router.route('/v1/admin/projects/delete').post(authInterface.verifyRequest, adminProjectsInterface.deleteProject);
router.route('/v1/admin/projects/current').get(authInterface.verifyRequest, adminProjectsInterface.getCurrentProjects);
router.route('/v1/admin/projects/recentlycompleted').get(authInterface.verifyRequest, adminProjectsInterface.getRecentlyCompletedProjects);
router.route('/v1/admin/projects/completed').get(authInterface.verifyRequest, adminProjectsInterface.getAllCompletedProjects);
router.route('/v1/admin/projects/updates/all').get(authInterface.verifyRequest, adminProjectsInterface.getAllProgressUpdates);
router.route('/v1/admin/projects/updates/new').post(authInterface.verifyRequest, adminProjectsInterface.addProgressUpdate);
router.route('/v1/admin/projects/updates/delete').post(authInterface.verifyRequest, adminProjectsInterface.deleteProgressUpdate);
router.route('/v1/admin/projects/updates/feed').get(authInterface.verifyRequest, adminProjectsInterface.getUpdatesFeed);

module.exports = router;
