'use strict';
const express = require('express');
// Interfaces
const authAPI = require('./api/auth.js');
const userAPI = require('./api/user.js');
const searchAPI = require('./api/search.js');
const announcementAPI = require('./api/announcement.js');
const sharedProjectsAPI = require('./api/projects.js');

const adminTasksAPI = require('./api/admintasks.js');
const adminProjectsAPI = require('./api/adminprojects.js');

const devTasksAPI = require('./api/devtasks.js');
const developmentProjectsAPI = require('./api/developmentprojects.js');

const harvestingTargetsAPI = require('./api/harvestingtargets.js');
const harvestingProjectsAPI = require('./api/harvestingprojects.js');


var router = express.Router();

router.use((req, res, next) => {
    var allowedOrigins = [];
    var origin = req.headers.origin;
    if (process.env.NODE_ENV === 'production') {
        allowedOrigins = String(process.env.PRODUCTIONURLS).split(',');
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
router.route('/v1/auth/login').post(authAPI.login);

/* Search */
//router.route('/v1/search').get(authAPI.verifyRequest, searchAPI.performSearch);

/* Users */
//router.route('/v1/user/createuserbasic').post(userAPI.createUserBasic);
router.route('/v1/user/basicinfo').get(authAPI.verifyRequest, userAPI.basicUserInfo);
router.route('/v1/user/accountinfo').get(authAPI.verifyRequest, userAPI.basicAccountInfo);
router.route('/v1/user/getadmins').get(authAPI.verifyRequest, userAPI.getAdmins);
router.route('/v1/user/getdevelopers').get(authAPI.verifyRequest, userAPI.getDevelopers);
router.route('/v1/user/getharvesters').get(authAPI.verifyRequest, userAPI.getHarvesters);

/* Announcements */
router.route('/v1/announcements/create').post(authAPI.verifyRequest, announcementAPI.postAnnouncement);
router.route('/v1/announcements/all').get(authAPI.verifyRequest, announcementAPI.getAllAnnouncements);
router.route('/v1/announcements/recent').get(authAPI.verifyRequest, announcementAPI.getRecentAnnouncement);

/* Projects (General) */
router.route('/v1/projects/all').get(authAPI.verifyRequest, sharedProjectsAPI.getAllUserProjects);
router.route('/v1/projects/recent').get(authAPI.verifyRequest, sharedProjectsAPI.getRecentUserProjects);

/* Harvesting */
// Targetlist
router.route('/v1/harvesting/targetlist/all').get(authAPI.verifyRequest, harvestingTargetsAPI.getAllTargets);
router.route('/v1/harvesting/targetlist/add').post(authAPI.verifyRequest, harvestingTargetsAPI.addTarget);
router.route('/v1/harvesting/targetlist/targets/detail').get(authAPI.verifyRequest, harvestingTargetsAPI.getTargetDetail);
router.route('/v1/harvesting/targetlist/targets/update').post(authAPI.verifyRequest, harvestingTargetsAPI.updateTarget);
router.route('/v1/harvesting/targetlist/targets/delete').post(authAPI.verifyRequest, harvestingTargetsAPI.deleteTarget);

// Projects
router.route('/v1/harvesting/projects/addexisting').post(authAPI.verifyRequest, harvestingProjectsAPI.addExistingProject);
router.route('/v1/harvesting/projects/newfromtarget').post(authAPI.verifyRequest, harvestingProjectsAPI.newProjectFromTarget);
router.route('/v1/harvesting/projects/newforassignee').post(authAPI.verifyRequest, harvestingProjectsAPI.newProjectForAssignee);
router.route('/v1/harvesting/projects/detail').get(authAPI.verifyRequest, harvestingProjectsAPI.getProjectDetail);
router.route('/v1/harvesting/projects/update').post(authAPI.verifyRequest, harvestingProjectsAPI.updateProject);
router.route('/v1/harvesting/projects/flag').post(authAPI.verifyRequest, harvestingProjectsAPI.flagProject);
router.route('/v1/harvesting/projects/unflag').post(authAPI.verifyRequest, harvestingProjectsAPI.unflagProject);
router.route('/v1/harvesting/projects/markcompleted').post(authAPI.verifyRequest, harvestingProjectsAPI.markProjectCompleted);
router.route('/v1/harvesting/projects/delete').post(authAPI.verifyRequest, harvestingProjectsAPI.deleteProject);
router.route('/v1/harvesting/projects/current').get(authAPI.verifyRequest, harvestingProjectsAPI.getCurrentProjects);
router.route('/v1/harvesting/projects/flagged').get(authAPI.verifyRequest, harvestingProjectsAPI.getFlaggedProjects);
router.route('/v1/harvesting/projects/recentlycompleted').get(authAPI.verifyRequest, harvestingProjectsAPI.getRecentlyCompletedProjects);
router.route('/v1/harvesting/projects/completed').get(authAPI.verifyRequest, harvestingProjectsAPI.getAllCompletedProjects);
router.route('/v1/harvesting/projects/updates/all').get(authAPI.verifyRequest, harvestingProjectsAPI.getAllProgressUpdates);
router.route('/v1/harvesting/projects/updates/new').post(authAPI.verifyRequest, harvestingProjectsAPI.addProgressUpdate);
router.route('/v1/harvesting/projects/updates/delete').post(authAPI.verifyRequest, harvestingProjectsAPI.deleteProgressUpdate);
router.route('/v1/harvesting/projects/updates/feed').get(authAPI.verifyRequest, harvestingProjectsAPI.getUpdatesFeed);

/* Development */
// Task Queue
router.route('/v1/development/taskqueue/all').get(authAPI.verifyRequest, devTasksAPI.getAllTasks);
router.route('/v1/development/taskqueue/add').post(authAPI.verifyRequest, devTasksAPI.addTask);
router.route('/v1/development/taskqueue/tasks/detail').get(authAPI.verifyRequest, devTasksAPI.getTaskDetail);
router.route('/v1/development/taskqueue/tasks/update').post(authAPI.verifyRequest, devTasksAPI.updateTask);
router.route('/v1/development/taskqueue/tasks/delete').post(authAPI.verifyRequest, devTasksAPI.deleteTask);

// Projects
router.route('/v1/development/projects/addexisting').post(authAPI.verifyRequest, developmentProjectsAPI.addExistingProject);
router.route('/v1/development/projects/newfromtask').post(authAPI.verifyRequest, developmentProjectsAPI.newProjectFromTask);
router.route('/v1/development/projects/newforassignee').post(authAPI.verifyRequest, developmentProjectsAPI.newProjectForAssignee);
router.route('/v1/development/projects/detail').get(authAPI.verifyRequest, developmentProjectsAPI.getProjectDetail);
router.route('/v1/development/projects/update').post(authAPI.verifyRequest, developmentProjectsAPI.updateProject);
router.route('/v1/development/projects/flag').post(authAPI.verifyRequest, developmentProjectsAPI.flagProject);
router.route('/v1/development/projects/unflag').post(authAPI.verifyRequest, developmentProjectsAPI.unflagProject);
router.route('/v1/development/projects/markcompleted').post(authAPI.verifyRequest, developmentProjectsAPI.markProjectCompleted);
router.route('/v1/development/projects/delete').post(authAPI.verifyRequest, developmentProjectsAPI.deleteProject);
router.route('/v1/development/projects/current').get(authAPI.verifyRequest, developmentProjectsAPI.getCurrentProjects);
router.route('/v1/development/projects/flagged').get(authAPI.verifyRequest, developmentProjectsAPI.getFlaggedProjects);
router.route('/v1/development/projects/recentlycompleted').get(authAPI.verifyRequest, developmentProjectsAPI.getRecentlyCompletedProjects);
router.route('/v1/development/projects/completed').get(authAPI.verifyRequest, developmentProjectsAPI.getAllCompletedProjects);
router.route('/v1/development/projects/updates/all').get(authAPI.verifyRequest, developmentProjectsAPI.getAllProgressUpdates);
router.route('/v1/development/projects/updates/new').post(authAPI.verifyRequest, developmentProjectsAPI.addProgressUpdate);
router.route('/v1/development/projects/updates/delete').post(authAPI.verifyRequest, developmentProjectsAPI.deleteProgressUpdate);
router.route('/v1/development/aio/all').get(authAPI.verifyRequest, developmentProjectsAPI.getAIOFeed);

/* Administration */
// Task Queue
router.route('/v1/admin/taskqueue/all').get(authAPI.verifyRequest, adminTasksAPI.getAllTasks);
router.route('/v1/admin/taskqueue/add').post(authAPI.verifyRequest, adminTasksAPI.addTask);
router.route('/v1/admin/taskqueue/tasks/detail').get(authAPI.verifyRequest, adminTasksAPI.getTaskDetail);
router.route('/v1/admin/taskqueue/tasks/update').post(authAPI.verifyRequest, adminTasksAPI.updateTask);
router.route('/v1/admin/taskqueue/tasks/delete').post(authAPI.verifyRequest, adminTasksAPI.deleteTask);

// Projects
router.route('/v1/admin/projects/addexisting').post(authAPI.verifyRequest, adminProjectsAPI.addExistingProject);
router.route('/v1/admin/projects/newfromtask').post(authAPI.verifyRequest, adminProjectsAPI.newProjectFromTask);
router.route('/v1/admin/projects/detail').get(authAPI.verifyRequest, adminProjectsAPI.getProjectDetail);
router.route('/v1/admin/projects/update').post(authAPI.verifyRequest, adminProjectsAPI.updateProject);
router.route('/v1/admin/projects/addassignee').post(authAPI.verifyRequest, adminProjectsAPI.addProjectAssignee);
router.route('/v1/admin/projects/markcompleted').post(authAPI.verifyRequest, adminProjectsAPI.markProjectCompleted);
router.route('/v1/admin/projects/delete').post(authAPI.verifyRequest, adminProjectsAPI.deleteProject);
router.route('/v1/admin/projects/current').get(authAPI.verifyRequest, adminProjectsAPI.getCurrentProjects);
router.route('/v1/admin/projects/recentlycompleted').get(authAPI.verifyRequest, adminProjectsAPI.getRecentlyCompletedProjects);
router.route('/v1/admin/projects/completed').get(authAPI.verifyRequest, adminProjectsAPI.getAllCompletedProjects);
router.route('/v1/admin/projects/updates/all').get(authAPI.verifyRequest, adminProjectsAPI.getAllProgressUpdates);
router.route('/v1/admin/projects/updates/new').post(authAPI.verifyRequest, adminProjectsAPI.addProgressUpdate);
router.route('/v1/admin/projects/updates/delete').post(authAPI.verifyRequest, adminProjectsAPI.deleteProgressUpdate);
router.route('/v1/admin/projects/updates/feed').get(authAPI.verifyRequest, adminProjectsAPI.getUpdatesFeed);

module.exports = router;
