//
// LibreTexts Conductor
// api.js
//

'use strict';
const express = require('express');

/* Route Middleware */
const middleware = require('./middleware.js');

/* Interfaces */
const authAPI = require('./api/auth.js');
const usersAPI = require('./api/users.js');
const orgAPI = require('./api/organizations.js');
const adoptionReportAPI = require('./api/adoptionreports.js');
const harvestingRequestsAPI = require('./api/harvestingrequests.js');
const collectionsAPI = require('./api/collections.js');
const booksAPI = require('./api/books.js');
const homeworkAPI = require('./api/homework.js');
const librariesAPI = require('./api/libraries.js');
//const mailAPI = require('./api/mail.js'); // (enable for development only)
//const searchAPI = require('./api/search.js');
const announcementAPI = require('./api/announcements.js');
const sharedProjectsAPI = require('./api/projects.js');
const harvestingTargetsAPI = require('./api/harvestingtargets.js');
const harvestingProjectsAPI = require('./api/harvestingprojects.js');


var router = express.Router();

const ssoRoutes = ['/oauth/libretexts', '/auth/initsso'];

router.use(middleware.middlewareFilter(ssoRoutes, middleware.corsHelper));
router.use(middleware.middlewareFilter(ssoRoutes, middleware.authSanitizer));


/* Auth */
router.route('/auth/login').post(authAPI.validate('login'),
    middleware.checkValidationErrors, authAPI.login);

router.route('/auth/register').post(authAPI.validate('register'),
    middleware.checkValidationErrors, authAPI.register);

router.route('/auth/resetpassword').post(authAPI.validate('resetPassword'),
    middleware.checkValidationErrors, authAPI.resetPassword);

router.route('/auth/resetpassword/complete').post(
    authAPI.validate('completeResetPassword'), middleware.checkValidationErrors,
    authAPI.completeResetPassword);

router.route('/auth/changepassword').put(authAPI.verifyRequest,
    authAPI.validate('changePassword'), middleware.checkValidationErrors,
    authAPI.changePassword);


// SSO/OAuth (excluded from CORS/Auth routes)
router.route('/oauth/libretexts').get(authAPI.oauthCallback);

router.route('/auth/initsso').get(authAPI.initSSO);


/* Organizations */
router.route('/org/info').get(orgAPI.validate('getinfo'),
    middleware.checkValidationErrors, orgAPI.getOrganizationInfo);


/* Adoption Reports */
// (submission route can be anonymous)
router.route('/adoptionreport').post(middleware.checkLibreCommons,
    adoptionReportAPI.validate('submitReport'),
    middleware.checkValidationErrors, adoptionReportAPI.submitReport);

router.route('/adoptionreports').get(middleware.checkLibreCommons,
    authAPI.verifyRequest, authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    adoptionReportAPI.validate('getReports'), middleware.checkValidationErrors,
    adoptionReportAPI.getReports);

router.route('/adoptionreport/delete').delete(middleware.checkLibreCommons,
    authAPI.verifyRequest, authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    adoptionReportAPI.validate('deleteReport'), middleware.checkValidationErrors,
    adoptionReportAPI.deleteReport);


/* OER/Harvesting Requests */
// (submission route can be anonymous)
router.route('/harvestingrequest').post(middleware.checkLibreCommons,
    harvestingRequestsAPI.validate('addRequest'),
    middleware.checkValidationErrors, harvestingRequestsAPI.addRequest);

router.route('/harvestingrequests').get(middleware.checkLibreCommons,
    authAPI.verifyRequest, authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    harvestingRequestsAPI.validate('getRequests'),
    middleware.checkValidationErrors, harvestingRequestsAPI.getRequests);


/* Commons Collections */
router.route('/commons/collections').get(
    collectionsAPI.getCommonsCollections);

router.route('/commons/collections/all').get(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.getAllCollections);

router.route('/commons/collection').get(
    collectionsAPI.validate('getCollection'), middleware.checkValidationErrors,
    collectionsAPI.getCollection);

router.route('/commons/collection/create').post(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.validate('createCollection'),
    middleware.checkValidationErrors, collectionsAPI.createCollection);

router.route('/commons/collection/edit').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.validate('editCollection'),
    middleware.checkValidationErrors, collectionsAPI.editCollection);

router.route('/commons/collection/delete').delete(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.validate('deleteCollection'),
    middleware.checkValidationErrors, collectionsAPI.deleteCollection);

router.route('/commons/collection/addresource').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.validate('addCollResource'),
    middleware.checkValidationErrors, collectionsAPI.addResourceToCollection);

router.route('/commons/collection/removeresource').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    collectionsAPI.validate('remCollResource'),
    middleware.checkValidationErrors,
    collectionsAPI.removeResourceFromCollection);


/* Libraries Directory */
router.route('/commons/libraries').get(librariesAPI.getLibraries);

router.route('/commons/libraries/main').get(
    librariesAPI.getMainLibraries);

router.route('/commons/libraries/shelves').get(
    librariesAPI.validate('getLibraryShelves'),
    middleware.checkValidationErrors,
    librariesAPI.getLibraryShelves);

/* Commons Management */
router.route('/commons/syncwithlibs').post(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    booksAPI.syncWithLibraries);


/* Commons Books/Catalogs */
router.route('/commons/catalog').get(
    booksAPI.validate('getCommonsCatalog'), middleware.checkValidationErrors,
    booksAPI.getCommonsCatalog);

router.route('/commons/mastercatalog').get(
    booksAPI.validate('getMasterCatalog'), middleware.checkValidationErrors,
    booksAPI.getMasterCatalog);

router.route('/commons/book').get(booksAPI.validate('getBookDetail'),
    middleware.checkValidationErrors, booksAPI.getBookDetail);

router.route('/commons/book/summary').get(booksAPI.validate('getBookSummary'),
    middleware.checkValidationErrors, booksAPI.getBookSummary);

router.route('/commons/book/toc').get(booksAPI.validate('getBookTOC'),
    middleware.checkValidationErrors, booksAPI.getBookTOC);

router.route('/commons/filters').get(booksAPI.getCatalogFilterOptions);

router.route('/commons/catalogs/addresource').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    booksAPI.validate('addBookToCustomCatalog'),
    middleware.checkValidationErrors,
    booksAPI.addBookToCustomCatalog);

router.route('/commons/catalogs/removeresource').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    booksAPI.validate('removeBookFromCustomCatalog'),
    middleware.checkValidationErrors,
    booksAPI.removeBookFromCustomCatalog);


/* Homework */
router.route('/commons/homework/all').get(homeworkAPI.getAllHomework);

router.route('/commons/homework/adapt').get(homeworkAPI.getADAPTCatalog);


router.route('/commons/homework/syncadapt').post(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    homeworkAPI.syncADAPTCommons);


/* Search */
//router.route('/search').get(authAPI.verifyRequest, searchAPI.performSearch);


/* Users */
router.route('/user/basicinfo').get(authAPI.verifyRequest,
    usersAPI.basicUserInfo);

router.route('/user/accountinfo').get(authAPI.verifyRequest,
    usersAPI.basicAccountInfo);

router.route('/user/name').put(authAPI.verifyRequest,
    usersAPI.validate('editUserName'), middleware.checkValidationErrors,
    usersAPI.editUserName);

router.route('/user/email').put(authAPI.verifyRequest,
    usersAPI.validate('updateUserEmail'), middleware.checkValidationErrors,
    usersAPI.updateUserEmail);

router.route('/users').get(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    usersAPI.getUsersList);

router.route('/user/delete').put(authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    usersAPI.validate('deleteUser'), middleware.checkValidationErrors,
    usersAPI.deleteUser);


/* Announcements */
router.route('/announcements/create').post(authAPI.verifyRequest,
    authAPI.getUserAttributes, announcementAPI.validate('postAnnouncement'),
    middleware.checkValidationErrors, announcementAPI.postAnnouncement);
router.route('/announcements/all').get(authAPI.verifyRequest,
    announcementAPI.getAllAnnouncements);
router.route('/announcements/recent').get(authAPI.verifyRequest,
    announcementAPI.getRecentAnnouncement);


/* Projects (General) */
router.route('/projects/all').get(authAPI.verifyRequest,
    sharedProjectsAPI.getAllUserProjects);
router.route('/projects/recent').get(authAPI.verifyRequest,
    sharedProjectsAPI.getRecentUserProjects);


/* Harvesting */

// Targetlist
router.route('/harvesting/targetlist/all').get(authAPI.verifyRequest,
    harvestingTargetsAPI.getAllTargets);
router.route('/harvesting/targetlist/add').post(authAPI.verifyRequest,
    harvestingTargetsAPI.addTarget);
router.route('/harvesting/targetlist/targets/detail').get(
    authAPI.verifyRequest, harvestingTargetsAPI.getTargetDetail);
router.route('/harvesting/targetlist/targets/update').post(
    authAPI.verifyRequest, harvestingTargetsAPI.updateTarget);
router.route('/harvesting/targetlist/targets/delete').post(
    authAPI.verifyRequest, harvestingTargetsAPI.deleteTarget);

// Projects
router.route('/harvesting/projects/addexisting').post(
    authAPI.verifyRequest, harvestingProjectsAPI.addExistingProject);
router.route('/harvesting/projects/newfromtarget').post(
    authAPI.verifyRequest, harvestingProjectsAPI.newProjectFromTarget);
router.route('/harvesting/projects/newforassignee').post(
    authAPI.verifyRequest, harvestingProjectsAPI.newProjectForAssignee);
router.route('/harvesting/projects/detail').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getProjectDetail);
router.route('/harvesting/projects/update').post(
    authAPI.verifyRequest, harvestingProjectsAPI.updateProject);
router.route('/harvesting/projects/flag').post(
    authAPI.verifyRequest, harvestingProjectsAPI.flagProject);
router.route('/harvesting/projects/unflag').post(
    authAPI.verifyRequest, harvestingProjectsAPI.unflagProject);
router.route('/harvesting/projects/markcompleted').post(
    authAPI.verifyRequest, harvestingProjectsAPI.markProjectCompleted);
router.route('/harvesting/projects/delete').post(
    authAPI.verifyRequest, harvestingProjectsAPI.deleteProject);
router.route('/harvesting/projects/current').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getCurrentProjects);
router.route('/harvesting/projects/flagged').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getFlaggedProjects);
router.route('/harvesting/projects/recentlycompleted').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getRecentlyCompletedProjects);
router.route('/harvesting/projects/completed').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getAllCompletedProjects);
router.route('/harvesting/projects/updates/all').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getAllProgressUpdates);
router.route('/harvesting/projects/updates/new').post(
    authAPI.verifyRequest, harvestingProjectsAPI.addProgressUpdate);
router.route('/harvesting/projects/updates/delete').post(
    authAPI.verifyRequest, harvestingProjectsAPI.deleteProgressUpdate);
router.route('/harvesting/projects/updates/feed').get(
    authAPI.verifyRequest, harvestingProjectsAPI.getUpdatesFeed);

module.exports = router;
