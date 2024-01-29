/**
 * @file Defines all routes for the Conductor API.
 * @author LibreTexts <info@libretexts.org>
 */

'use strict';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import middleware from './middleware.js'; // Route middleware
import assetTagFrameworkAPI from './api/assettagframeworks.js';
import authorsAPI from './api/authors.js';
import authAPI from './api/auth.js';
import centralIdentityAPI from './api/central-identity.js';
import usersAPI from './api/users.js';
import orgsAPI from './api/organizations.js';
import alertsAPI from './api/alerts.js';
import adoptionReportAPI from './api/adoptionreports.js';
import harvestingRequestsAPI from './api/harvestingrequests.js';
import collectionsAPI from './api/collections.js';
import booksAPI from './api/books.js';
import homeworkAPI from './api/homework.js';
import librariesAPI from './api/libraries.js';
import searchAPI from './api/search.js';
import announcementAPI from './api/announcements.js';
import peerReviewAPI from './api/peerreview.js';
import projectsAPI from './api/projects.js';
import projectfilesAPI from './api/projectfiles.js';
import tasksAPI from './api/tasks.js';
import msgAPI from './api/messaging.js';
import transFeedbackAPI from './api/translationfeedback.js';
import OAuth from './api/oauth.js';
import apiClientsAPI from './api/apiclients.js';
import CIDDescriptorsAPI from './api/ciddescriptors.js';
import analyticsAPI from './api/analytics.js';
import orgEventsAPI from './api/orgevents.js';
import paymentsAPI from './api/payments.js';
import kbAPI from './api/kb.js';
import supportAPI from './api/support.js';

import * as centralIdentityValidators from './api/validators/central-identity.js';
import * as kbValidators from './api/validators/kb.js';
import * as supportValidators from './api/validators/support.js';
import * as ProjectValidators from './api/validators/projects.js';
import * as ProjectFileValidators from './api/validators/projectfiles.js';
import * as SearchValidators from './api/validators/search.js';
import * as AssetTagFrameworkValidators from './api/validators/assettagframeworks.js';
import * as AuthorsValidators from './api/validators/authors.js';

const router = express.Router();

const ssoRoutes = ['/auth/login', '/auth/logout', '/oidc/libretexts'];
const apiAuthRoutes = ['/oauth2.0/authorize', '/oauth2.0/accessToken'];

router.use(middleware.middlewareFilter(['/payments/webhook'], bodyParser.json()));
router.use(bodyParser.urlencoded({ extended: false }));

router.use(cors({
  origin: function (origin, callback) {
    /* Build dynamic origins list */
    let allowedOrigins = [];
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins = String(process.env.PRODUCTIONURLS).split(',');
      allowedOrigins.push(/\.libretexts\.org$/); // any LibreTexts subdomain
    }
    if (process.env.NODE_ENV === 'development') {
      if (process.env.DEVELOPMENTURLS) {
        allowedOrigins = String(process.env.DEVELOPMENTURLS).split(',');
      } else {
        allowedOrigins = ['localhost:5000'];
      }
    }

    /* Check provided origin */
    const foundOrigin = allowedOrigins.find((allowed) => {
      if (typeof (allowed) === 'string') {
        return allowed === origin;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    if (foundOrigin) {
      return callback(null, origin);
    }
    return callback(null, 'https://libretexts.org'); // default
  },
  methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 7200,
}));

router.use(middleware.authSanitizer);

router.use(middleware.middlewareFilter(
  [
    ...ssoRoutes,
    ...apiAuthRoutes,
    '/commons/kbexport',
    '/analytics/learning/init',
    '/payments/webhook',
  ],
  middleware.requestSecurityHelper,
));

/* Auth */
router.route('/oidc/libretexts').get(authAPI.completeLogin);

router.route('/auth/login').get(authAPI.initLogin);

router.route('/auth/logout').get(authAPI.logout);

router.route('/auth/fallback-auth').post(
  authAPI.validate('fallbackAuthLogin'),
  middleware.checkValidationErrors,
  authAPI.fallbackAuthLogin,
);

/* LibreOne Auth */
router.route('/central-identity/users').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getUsers'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getUsers
)

router.route('/central-identity/users/:id').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getUser'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getUser
)
.patch(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('updateUser'),
  middleware.checkValidationErrors,
  centralIdentityAPI.updateUser
)

router.route('/central-identity/users/:id/applications').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getUserApplications'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getUserApplications
).post(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('addUserApplications'),
  middleware.checkValidationErrors,
  centralIdentityAPI.addUserApplications
)

router.route('/central-identity/users/:id/applications/:applicationId').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(centralIdentityValidators.CheckUserApplicationAccessValidator),
  centralIdentityAPI.checkUserApplicationAccess
).delete(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('deleteUserApplication'),
  middleware.checkValidationErrors,
  centralIdentityAPI.deleteUserApplication
)

router.route('/central-identity/users/:id/orgs').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getUserOrgs'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getUserOrgs
).post(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('addUserOrgs'),
  middleware.checkValidationErrors,
  centralIdentityAPI.addUserOrgs
)

router.route('/central-identity/users/:id/orgs/:orgId').delete(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('deleteUserOrg'),
  middleware.checkValidationErrors,
  centralIdentityAPI.deleteUserOrg
)

router.route('/central-identity/apps').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.getApplicationsPriveledged
)

router.route('/central-identity/public/apps').get(
  middleware.checkCentralIdentityConfig,
  centralIdentityAPI.getApplicationsPublic
)

router.route('/central-identity/orgs').get(
  middleware.checkCentralIdentityConfig,
  centralIdentityAPI.validate('getOrgs'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getOrgs
)

router.route('/central-identity/adapt-orgs').get(
  centralIdentityAPI.validate('getADAPTOrgs'), // Don't need checkCentralIdentityConfig here because it's does not require a valid API key
  middleware.checkValidationErrors,
  centralIdentityAPI.getADAPTOrgs
)

router.route('/central-identity/systems').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.getSystems
)

router.route('/central-identity/services').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.getServices
)

router.route('/central-identity/verification-requests').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getVerificationRequests'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getVerificationRequests
)

router.route('/central-identity/verification-requests/:id').get(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('getVerificationRequest'),
  middleware.checkValidationErrors,
  centralIdentityAPI.getVerificationRequest
).patch(
  middleware.checkCentralIdentityConfig,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  centralIdentityAPI.validate('updateVerificationRequest'),
  middleware.checkValidationErrors,
  centralIdentityAPI.updateVerificationRequest
)

// Public route
router.route('/central-identity/licenses').get(
  middleware.checkCentralIdentityConfig,
  centralIdentityAPI.getLicenses
)

/* OAuth (server) */
router.route('/oauth2.0/authorize').get(authAPI.verifyRequest, OAuth.authorize());

router.route('/oauth2.0/accessToken').post(OAuth.token());


/* Organizations */
router.route('/orgs').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  orgsAPI.getAllOrganizations,
);

router.route('/orgs/libregrid').get(orgsAPI.getLibreGridOrganizations);

router.route('/org').get(orgsAPI.getCurrentOrganization);

router.route('/org/:orgID')
  .get(
    orgsAPI.validate('getinfo'),
    middleware.checkValidationErrors,
    orgsAPI.getOrganizationInfo,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    orgsAPI.validate('updateinfo'),
    middleware.checkValidationErrors,
    orgsAPI.updateOrganizationInfo,
  );

router.route('/org/:orgID/branding-images/:assetName').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  orgsAPI.validate('updateBrandingImageAsset'),
  middleware.checkValidationErrors,
  orgsAPI.assetUploadHandler,
  orgsAPI.updateBrandingImageAsset,
);

/* Asset Tag Frameworks */
router.route('/assettagframeworks').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  assetTagFrameworkAPI.validate('getFrameworks'),
  middleware.checkValidationErrors,
  assetTagFrameworkAPI.getFrameworks,
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  assetTagFrameworkAPI.validate('createFramework'),
  middleware.checkValidationErrors,
  assetTagFrameworkAPI.createFramework,
);

router.route('/assettagframeworks/campusdefault/:orgID').get(
  middleware.validateZod(AssetTagFrameworkValidators.getCampusDefaultFrameworkValidator),
  assetTagFrameworkAPI.getCampusDefaultFramework,
);

router.route('/assettagframeworks/:uuid').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  assetTagFrameworkAPI.validate('getFramework'),
  middleware.checkValidationErrors,
  assetTagFrameworkAPI.getFramework,
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  assetTagFrameworkAPI.validate('updateFramework'),
  middleware.checkValidationErrors,
  assetTagFrameworkAPI.updateFramework,
)

/* Authors */
router.route('/authors').get(
  middleware.validateZod(AuthorsValidators.GetAllAuthorsValidator),
  authorsAPI.getAuthors,
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(AuthorsValidators.CreateAuthorValidator),
  authorsAPI.createAuthor,
);

router.route('/authors/bulk').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(AuthorsValidators.BulkCreateAuthorsValidator),
  authorsAPI.bulkCreateAuthors,
);

router.route('/authors/:id').get(
  middleware.validateZod(AuthorsValidators.GetAuthorValidator),
  authorsAPI.getAuthor,
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(AuthorsValidators.UpdateAuthorValidator),
  authorsAPI.updateAuthor,
).delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(AuthorsValidators.DeleteAuthorValidator),
  authorsAPI.deleteAuthor,
);


/* Adoption Reports */
// (submission route can be anonymous)
router.route('/adoptionreport').post(
  middleware.checkLibreCommons,
  adoptionReportAPI.validate('submitReport'),
  middleware.checkValidationErrors,
  adoptionReportAPI.submitReport,
);

router.route('/adoptionreports').get(
  middleware.checkLibreCommons,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  adoptionReportAPI.validate('getReports'),
  middleware.checkValidationErrors,
  adoptionReportAPI.getReports,
);

router.route('/adoptionreport/delete').delete(
  middleware.checkLibreCommons,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  adoptionReportAPI.validate('deleteReport'),
  middleware.checkValidationErrors,
  adoptionReportAPI.deleteReport,
);


/* Translation Feedback */
// (submission route can be anonymous)
router.route('/translationfeedback').post(
  middleware.checkLibreCommons,
  transFeedbackAPI.validate('submitFeedback'),
  middleware.checkValidationErrors,
  transFeedbackAPI.submitFeedback,
);

router.route('/translationfeedback/export').get(
  middleware.checkLibreCommons,
  transFeedbackAPI.validate('exportFeedback'),
  middleware.checkValidationErrors,
  transFeedbackAPI.exportFeedback,
);


/* OER/Harvesting Requests */
// (submission route can be anonymous)
router.route('/harvestingrequest')
  .post(
    middleware.checkLibreCommons,
    authAPI.optionalVerifyRequest,
    harvestingRequestsAPI.validate('addRequest'),
    middleware.checkValidationErrors,
    harvestingRequestsAPI.addRequest,
  ).delete(
    middleware.checkLibreCommons,
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    harvestingRequestsAPI.validate('deleteRequest'),
    middleware.checkValidationErrors,
    harvestingRequestsAPI.deleteRequest,
  );

router.route('/harvestingrequest/decline').patch(
  middleware.checkLibreCommons,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  harvestingRequestsAPI.validate('declineRequest'),
  middleware.checkValidationErrors,
  harvestingRequestsAPI.declineRequest
);

router.route('/harvestingrequest/convert').post(
  middleware.checkLibreCommons,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  harvestingRequestsAPI.validate('convertRequest'),
  middleware.checkValidationErrors,
  harvestingRequestsAPI.convertRequest,
);

router.route('/harvestingrequests').get(
  middleware.checkLibreCommons,
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  harvestingRequestsAPI.validate('getRequests'),
  middleware.checkValidationErrors,
  harvestingRequestsAPI.getRequests,
);

/* Commons Collections */
router.route('/commons/collections').get(collectionsAPI.getCommonsCollections);

router.route('/commons/collections/all').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.getAllCollections,
);

//These are defined first because of the nature in which route params fall-through
router.route('/commons/collection/:collID/resources').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('addCollResource'),
  middleware.checkValidationErrors,
  collectionsAPI.addResourceToCollection,
);

router.route('/commons/collection/:collID/resources/:resourceID').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('remCollResource'),
  middleware.checkValidationErrors,
  collectionsAPI.removeResourceFromCollection,
);

router.route('/commons/collection/:collID/assets/:assetName').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('updateCollectionImageAsset'),
  middleware.checkValidationErrors,
  collectionsAPI.assetUploadHandler,
  collectionsAPI.updateCollectionImageAsset,
);
// end

router.route('/commons/collection/:collID?').get(
  collectionsAPI.validate('getCollection'),
  middleware.checkValidationErrors,
  collectionsAPI.getCollection,
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('createCollection'),
  middleware.checkValidationErrors,
  collectionsAPI.createCollection,
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('editCollection'),
  middleware.checkValidationErrors,
  collectionsAPI.editCollection,
).delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  collectionsAPI.validate('deleteCollection'),
  middleware.checkValidationErrors,
  collectionsAPI.deleteCollection,
);

// Data export endpoint for 3rd-party content hosts
router.route('/commons/kbexport').get(
  middleware.checkLibreCommons,
  booksAPI.retrieveKBExport,
);


/* Libraries Directory */
router.route('/commons/libraries').get(librariesAPI.getLibraries);

router.route('/commons/libraries/main').get(librariesAPI.getMainLibraries);

router.route('/commons/libraries/shelves').get(
  librariesAPI.validate('getLibraryShelves'),
  middleware.checkValidationErrors,
  librariesAPI.getLibraryShelves,
);


/* Commons Management */
router.route('/commons/syncwithlibs').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  booksAPI.syncWithLibraries,
);

router.route('/commons/syncwithlibs/automated').put(
  middleware.checkLibreAPIKey,
  booksAPI.runAutomatedSyncWithLibraries,
);


/* Commons Books/Catalogs */
router.route('/commons/catalog').get(
  middleware.validateZod(booksAPI.getCommonsCatalogSchema),
  booksAPI.getCommonsCatalog,
);

router.route('/commons/mastercatalog').get(
  middleware.validateZod(booksAPI.getMasterCatalogSchema),
  booksAPI.getMasterCatalog,
);

router.route('/commons/book').post(
  authAPI.verifyRequest,
  middleware.validateZod(booksAPI.createBookSchema),
  booksAPI.createBook,
)

router.route('/commons/book/:bookID').get(
  middleware.validateZod(booksAPI.getWithBookIDParamSchema),
  booksAPI.getBookDetail,
);

router.route('/commons/book/:bookID/summary').get(
  middleware.validateZod(booksAPI.getWithBookIDParamSchema),
  booksAPI.getBookSummary,
);

router.route('/commons/book/:bookID/files/:fileID?').get(
  middleware.validateZod(booksAPI.getBookFilesSchema),
  booksAPI.getBookFiles,
);

router.route('/commons/book/:bookID/files/:fileID/download').get(
  middleware.validateZod(booksAPI.downloadBookFileSchema),
  booksAPI.downloadBookFile,
);

router.route('/commons/book/:bookID/toc').get(
  middleware.validateZod(booksAPI.getWithBookIDParamSchema),
  booksAPI.getBookTOC,
);

router.route('/commons/book/:bookID/licensereport').get(
  middleware.validateZod(booksAPI.getWithBookIDParamSchema),
  booksAPI.getLicenseReport,
);

router.route('/commons/book/:bookID/peerreviews').get(
  middleware.validateZod(booksAPI.getWithBookIDParamSchema),
  booksAPI.getBookPeerReviews,
);

router.route('/commons/filters').get(booksAPI.getCatalogFilterOptions);

router.route('/commons/catalogs/addresource').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(booksAPI.getWithBookIDBodySchema),
  booksAPI.addBookToCustomCatalog,
);

router.route('/commons/catalogs/removeresource').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  middleware.validateZod(booksAPI.getWithBookIDBodySchema),
  booksAPI.removeBookFromCustomCatalog,
);


/* Homework */
router.route('/commons/homework/all').get(homeworkAPI.getAllHomework);

router.route('/commons/homework/adapt').get(homeworkAPI.getADAPTCatalog);


router.route('/commons/homework/sync').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  homeworkAPI.syncHomework,
);

router.route('/commons/homework/sync/automated').put(
  middleware.checkLibreAPIKey,
  homeworkAPI.runAutomatedHomeworkSync,
);

/* Search */
router.route('/search/autocomplete').get(
  middleware.validateZod(SearchValidators.autocompleteSchema),
  searchAPI.getAutocompleteResults
)
router.route('/search/assets').get(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(SearchValidators.assetSearchSchema),
  searchAPI.assetsSearch,
);
router.route('/search/books').get(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(SearchValidators.bookSearchSchema),
  searchAPI.booksSearch,
);
router.route('/search/homework').get(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(SearchValidators.homeworkSearchSchema),
  searchAPI.homeworkSearch,
);
router.route('/search/projects').get(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(SearchValidators.projectSearchSchema),
  searchAPI.projectsSearch,
);
router.route('/search/users').get(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(SearchValidators.userSearchSchema),
  searchAPI.usersSearch,
);



/* Users */
router.route('/user/basicinfo').get(
  authAPI.verifyRequest,
  usersAPI.getBasicUserInfo,
);

router.route('/user/accountinfo').get(
  authAPI.verifyRequest,
  usersAPI.getBasicAccountInfo,
);

router.route('/user/admininfo').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  usersAPI.validate('getUserInfoAdmin'),
  middleware.checkValidationErrors,
  usersAPI.getUserInfoAdmin,
);

router.route('/user/authorizedapps').get(
  authAPI.verifyRequest,
  usersAPI.getAuthorizedApplications,
);

router.route('/user/authorizedapps/:clientID').delete(
  authAPI.verifyRequest,
  usersAPI.validate('removeAuthorizedApplication'),
  middleware.checkValidationErrors,
  usersAPI.removeUserAuthorizedApplication,
);

router.route('/user/roles').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  usersAPI.validate('getUserRoles'),
  middleware.checkValidationErrors,
  usersAPI.getUserRoles,
);

router.route('/user/role/update').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  usersAPI.validate('updateUserRole'),
  middleware.checkValidationErrors,
  usersAPI.updateUserRole,
);

router.route('/user/instructorprofile')
  .get(
    authAPI.verifyRequest,
    usersAPI.getInstructorProfile,
  ).put(
    authAPI.verifyRequest,
    usersAPI.validate('updateInstructorProfile'),
    middleware.checkValidationErrors,
    usersAPI.updateUserInstructorProfile,
  );

router.route('/user/projects').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  projectsAPI.validate('getUserProjectsAdmin'),
  middleware.checkValidationErrors,
  projectsAPI.getUserProjectsAdmin,
);

router.route('/users').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
  usersAPI.getUsersList,
);

router.route('/users/basic').get(
  authAPI.verifyRequest,
  usersAPI.getBasicUsersList,
);


/* Announcements */
router.route('/announcement')
  .post(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    announcementAPI.validate('postAnnouncement'),
    middleware.checkValidationErrors,
    announcementAPI.postAnnouncement,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    announcementAPI.validate('deleteAnnouncement'),
    middleware.checkValidationErrors,
    announcementAPI.deleteAnnouncement,
  );

router.route('/announcements/all').get(
  authAPI.verifyRequest,
  announcementAPI.getAllAnnouncements,
);

router.route('/announcements/recent').get(
  authAPI.verifyRequest,
  announcementAPI.getRecentAnnouncement,
);

router.route('/announcements/system').get(announcementAPI.getSystemAnnouncement);


/* Alerts */
router.route('/alert')
  .get(
    authAPI.verifyRequest,
    alertsAPI.validate('getAlert'),
    middleware.checkValidationErrors,
    alertsAPI.getAlert,
  ).post(
    authAPI.verifyRequest,
    alertsAPI.validate('createAlert'),
    middleware.checkValidationErrors,
    alertsAPI.createAlert,
  ).delete(
    authAPI.verifyRequest,
    alertsAPI.validate('deleteAlert'),
    middleware.checkValidationErrors,
    alertsAPI.deleteAlert,
  );

router.route('/alerts').get(
  authAPI.verifyRequest,
  alertsAPI.validate('getUserAlerts'),
  middleware.checkValidationErrors,
  alertsAPI.getUserAlerts,
);

router.route('/alerts/processdaily').put(
  middleware.checkLibreAPIKey,
  alertsAPI.processDailyAlerts,
);

// Analytics
router.route('/analytics/accessrequest/:requestID')
  .put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    analyticsAPI.validate('completeAnalyticsAccessRequest'),
    middleware.checkValidationErrors,
    analyticsAPI.completeAnalyticsAccessRequest,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
    analyticsAPI.validate('deleteAnalyticsAccessRequest'),
    middleware.checkValidationErrors,
    analyticsAPI.deleteAnalyticsAccessRequest,
  );

router.route('/analytics/accessrequests').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'superadmin'),
  analyticsAPI.getAnalyticsAccessRequests,
);

router.route('/analytics/courses')
  .get(
    authAPI.verifyRequest,
    analyticsAPI.getUserAnalyticsCourses,
  ).post(
    authAPI.verifyRequest,
    analyticsAPI.validate('createAnalyticsCourse'),
    middleware.checkValidationErrors,
    analyticsAPI.createAnalyticsCourse,
  );

router.route('/analytics/courses/:courseID')
  .get(
    authAPI.verifyRequest,
    analyticsAPI.validate('getAnalyticsCourse'),
    middleware.checkValidationErrors,
    analyticsAPI.getAnalyticsCourse,
  ).put(
    authAPI.verifyRequest,
    analyticsAPI.validate('updateAnalyticsCourse'),
    middleware.checkValidationErrors,
    analyticsAPI.updateAnalyticsCourse,
  ).delete(
    authAPI.verifyRequest,
    analyticsAPI.validate('deleteAnalyticsCourse'),
    middleware.checkValidationErrors,
    analyticsAPI.deleteAnalyticsCourse,
  );

router.route('/analytics/courses/:courseID/invites')
  .get(
    authAPI.verifyRequest,
    analyticsAPI.validate('getAnalyticsCourseInvites'),
    middleware.checkValidationErrors,
    analyticsAPI.getAnalyticsCourseInvites,
  ).post(
    authAPI.verifyRequest,
    analyticsAPI.validate('createAnalyticsInvite'),
    middleware.checkValidationErrors,
    analyticsAPI.createAnalyticsInvite,
  );

router.route('/analytics/courses/:courseID/members').get(
  authAPI.verifyRequest,
  analyticsAPI.validate('getAnalyticsCourseMembers'),
  middleware.checkValidationErrors,
  analyticsAPI.getAnalyticsCourseMembers,
);

router.route('/analytics/courses/:courseID/members/:uuid')
  .put(
    authAPI.verifyRequest,
    analyticsAPI.validate('updateAnalyticsCourseMemberAccess'),
    middleware.checkValidationErrors,
    analyticsAPI.updateAnalyticsCourseMemberAccess,
  ).delete(
    authAPI.verifyRequest,
    analyticsAPI.validate('removeAnalyticsCourseMember'),
    middleware.checkValidationErrors,
    analyticsAPI.removeAnalyticsCourseMember,
  );

router.route('/analytics/courses/:courseID/roster')
  .get(
    authAPI.verifyRequest,
    analyticsAPI.validate('getAnalyticsCourseRoster'),
    middleware.checkValidationErrors,
    analyticsAPI.getAnalyticsCourseRoster,
  ).put(
    authAPI.verifyRequest,
    analyticsAPI.validate('updateAnalyticsCourseRoster'),
    middleware.checkValidationErrors,
    analyticsAPI.updateAnalyticsCourseRoster,
  );

router.route('/analytics/invites').get(
  authAPI.verifyRequest,
  analyticsAPI.getUserAnalyticsInvites,
);

router.route('/analytics/invites/:inviteID')
  .put(
    authAPI.verifyRequest,
    analyticsAPI.validate('acceptAnalyticsInvite'),
    middleware.checkValidationErrors,
    analyticsAPI.acceptAnalyticsInvite,
  ).delete(
    authAPI.verifyRequest,
    analyticsAPI.validate('deleteAnalyticsInvite'),
    middleware.checkValidationErrors,
    analyticsAPI.deleteAnalyticsInvite,
  );

router.route('/analytics/learning/init').get(
  analyticsAPI.validate('startLearningAnalyticsFlow'),
  middleware.checkValidationErrors,
  analyticsAPI.startLearningAnalyticsFlow,
);


/* Peer Review */
router.route('/peerreview')
  .get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    peerReviewAPI.validate('getPeerReview'),
    middleware.checkValidationErrors,
    peerReviewAPI.getPeerReview,
  ).post(
    authAPI.optionalVerifyRequest,
    peerReviewAPI.validate('createPeerReview'),
    middleware.checkValidationErrors,
    peerReviewAPI.createPeerReview,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    peerReviewAPI.validate('deletePeerReview'),
    middleware.checkValidationErrors,
    peerReviewAPI.deletePeerReview,
  );

router.route('/peerreview/access').get(
  authAPI.optionalVerifyRequest,
  peerReviewAPI.validate('getProjectPeerReviewAccess'),
  middleware.checkValidationErrors,
  peerReviewAPI.getProjectPeerReviewAccess,
);

router.route('/peerreview/invite').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  peerReviewAPI.validate('sendPeerReviewInvite'),
  middleware.checkValidationErrors,
  peerReviewAPI.sendPeerReviewInvite,
);

router.route('/peerreview/projectrubric').get(
  peerReviewAPI.validate('getProjectPeerReviewRubric'),
  middleware.checkValidationErrors,
  peerReviewAPI.getProjectPeerReviewRubric,
);

router.route('/peerreview/rubric')
  .get(
    authAPI.optionalVerifyRequest,
    peerReviewAPI.validate('getPeerReviewRubric'),
    middleware.checkValidationErrors,
    peerReviewAPI.getPeerReviewRubric,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    authAPI.checkHasRoleMiddleware(process.env.ORG_ID, 'campusadmin'),
    peerReviewAPI.validate('updatePeerReviewRubric'),
    middleware.checkValidationErrors,
    peerReviewAPI.updatePeerReviewRubric,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    peerReviewAPI.validate('deletePeerReviewRubric'),
    middleware.checkValidationErrors,
    peerReviewAPI.deletePeerReviewRubric,
  );

router.route('/peerreview/rubric/orgdefault').get(
  authAPI.verifyRequest,
  peerReviewAPI.checkOrgDefaultRubric,
);

router.route('/peerreview/rubrics').get(peerReviewAPI.getAllPeerReviewRubrics);

router.route('/peerreviews').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  peerReviewAPI.validate('getProjectPeerReviews'),
  middleware.checkValidationErrors,
  peerReviewAPI.getProjectPeerReviews,
);


/* Projects */
router.route('/projects/all').get(
  authAPI.verifyRequest,
  projectsAPI.getUserProjects,
);

router.route('/projects/underdevelopment').get(projectsAPI.getProjectsUnderDevelopment);

router.route('/projects/flagged').get(
  authAPI.verifyRequest,
  projectsAPI.getUserFlaggedProjects,
);

router.route('/projects/pinned').get(
  authAPI.verifyRequest,
  projectsAPI.getUserPinnedProjects,
);

router.route('/projects/recent').get(
  authAPI.verifyRequest,
  projectsAPI.getRecentProjects,
);

router.route('/projects/available').get(
  authAPI.verifyRequest,
  projectsAPI.getAvailableProjects,
);

router.route('/projects/completed').get(
  authAPI.verifyRequest,
  projectsAPI.getCompletedProjects,
);

router.route('/projects/public').get(
  middleware.validateZod(ProjectValidators.getPublicProjectsSchema),
  projectsAPI.getPublicProjects,
)

router.route('/projects/tags/org').get(
  authAPI.verifyRequest,
  projectsAPI.getOrgTags,
);

router.route('/projects/files/public').get(
  middleware.validateZod(ProjectFileValidators.getPublicProjectFilesSchema),
  projectfilesAPI.getPublicProjectFiles,
)

router.route('/project/flag').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('flagProject'),
  middleware.checkValidationErrors,
  projectsAPI.flagProject,
);

router.route('/project/flag/clear').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('clearProjectFlag'),
  middleware.checkValidationErrors,
  projectsAPI.clearProjectFlag,
);

router.route('/project/pin')
  .get(
    authAPI.verifyRequest,
    projectsAPI.validate('getProjectPinStatus'),
    middleware.checkValidationErrors,
    projectsAPI.getProjectPinStatus,
  ).put(
    authAPI.verifyRequest,
    projectsAPI.validate('pinProject'),
    middleware.checkValidationErrors,
    projectsAPI.pinProject,
  ).delete(
    authAPI.verifyRequest,
    projectsAPI.validate('unpinProject'),
    middleware.checkValidationErrors,
    projectsAPI.unpinProject,
  );

router.route('/project/:projectID/team')
  .get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('getProjectTeam'),
    middleware.checkValidationErrors,
    projectsAPI.getProjectTeam,
  ).post(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('addMemberToProject'),
    middleware.checkValidationErrors,
    projectsAPI.addMemberToProject,
  );

router.route('/project/:projectID/team/addable').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('getAddableMembers'),
  middleware.checkValidationErrors,
  projectsAPI.getAddableMembers,
);

router.route('/project/:projectID/team/:uuid/role').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('changeMemberRole'),
  middleware.checkValidationErrors,
  projectsAPI.changeMemberRole,
);

router.route('/project/:projectID/team/:uuid').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('removeMemberFromProject'),
  middleware.checkValidationErrors,
  projectsAPI.removeMemberFromProject,
);

router.route('/project/threads').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('getProjectThreads'),
  middleware.checkValidationErrors,
  msgAPI.getProjectThreads,
);

router.route('/project/thread')
  .post(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    msgAPI.validate('createDiscussionThread'),
    middleware.checkValidationErrors,
    msgAPI.createDiscussionThread,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    msgAPI.validate('deleteDiscussionThread'),
    middleware.checkValidationErrors,
    msgAPI.deleteDiscussionThread,
  );

router.route('/project/thread/messages').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('getThreadMessages'),
  middleware.checkValidationErrors,
  msgAPI.getThreadMessages,
);

router.route('/project/thread/:threadID/message').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('createThreadMessage'),
  middleware.checkValidationErrors,
  msgAPI.createThreadMessage,
);

router.route('/project/thread/message').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('deleteMessage'),
  middleware.checkValidationErrors,
  msgAPI.deleteMessage,
);

router.route('/project/tasks').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  tasksAPI.validate('getProjectTasks'),
  middleware.checkValidationErrors,
  tasksAPI.getProjectTasks,
);

router.route('/project/task')
  .get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    tasksAPI.validate('getTask'),
    middleware.checkValidationErrors,
    tasksAPI.getTask,
  ).post(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    tasksAPI.validate('createTask'),
    middleware.checkValidationErrors,
    tasksAPI.createTask,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    tasksAPI.validate('updateTask'),
    middleware.checkValidationErrors,
    tasksAPI.updateTask,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    tasksAPI.validate('deleteTask'),
    middleware.checkValidationErrors,
    tasksAPI.deleteTask,
  );

router.route('/project/task/batchadd').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  tasksAPI.validate('batchCreateTask'),
  middleware.checkValidationErrors,
  tasksAPI.batchCreateTask,
);

router.route('/project/task/assignees/add').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  tasksAPI.validate('addTaskAssignee'),
  middleware.checkValidationErrors,
  tasksAPI.addTaskAssignee,
);

router.route('/project/task/assignees/add-all').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  tasksAPI.validate('assignAllToTask'),
  middleware.checkValidationErrors,
  tasksAPI.assignAllMembersToTask,
);

router.route('/project/task/assignees/remove').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  tasksAPI.validate('removeTaskAssignee'),
  middleware.checkValidationErrors,
  tasksAPI.removeTaskAssignee,
);

router.route('/project/task/messages').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('getTaskMessages'),
  middleware.checkValidationErrors,
  msgAPI.getTaskMessages,
);

router.route('/project/task/:taskID/message').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('createTaskMessage'),
  middleware.checkValidationErrors,
  msgAPI.createTaskMessage,
);

router.route('/project/task/message').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  msgAPI.validate('deleteMessage'),
  middleware.checkValidationErrors,
  msgAPI.deleteMessage,
);

router.route('/project/publishing').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('requestProjectPublishing'),
  middleware.checkValidationErrors,
  projectsAPI.requestProjectPublishing,
);

router.route('/project/accessibility/importsections').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('importA11YSectionsFromTOC'),
  middleware.checkValidationErrors,
  projectsAPI.importA11YSectionsFromTOC,
);

router.route('/project/accessibility/sections').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('getA11YReviewSections'),
  middleware.checkValidationErrors,
  projectsAPI.getA11YReviewSections,
);

router.route('/project/accessibility/section').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('createA11YReviewSection'),
  middleware.checkValidationErrors,
  projectsAPI.createA11YReviewSection,
);

router.route('/project/accessibility/section/item').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('updateA11YReviewSectionItem'),
  middleware.checkValidationErrors,
  projectsAPI.updateA11YReviewSectionItem,
);

router.route('/project/:projectID/thumbnail').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  projectsAPI.validate('uploadProjectThumbnail'),
  middleware.checkValidationErrors,
  projectsAPI.thumbnailUploadHandler,
  projectsAPI.uploadProjectThumbnail,
)

router.route('/project/:projectID?')
  .get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('getProject'),
    middleware.checkValidationErrors,
    projectsAPI.getProject,
  ).post(
    authAPI.verifyRequest,
    projectsAPI.validate('createProject'),
    middleware.checkValidationErrors,
    projectsAPI.createProject,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('updateProject'),
    middleware.checkValidationErrors,
    projectsAPI.updateProject,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('deleteProject'),
    middleware.checkValidationErrors,
    projectsAPI.deleteProject,
  );

router.route('/project/:projectID/files/bulk').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(ProjectFileValidators.bulkDownloadProjectFilesSchema),
  projectfilesAPI.bulkDownloadProjectFiles,
)

router.route('/project/:projectID/files/:fileID/access').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(ProjectFileValidators.updateProjectFileAccessSchema),
  projectfilesAPI.updateProjectFileAccess,
);

router.route('/project/:projectID/files/:fileID/download').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(ProjectFileValidators.getProjectFileDownloadURLSchema),
  projectfilesAPI.getProjectFileDownloadURL
);

router.route('/project/:projectID/files/:fileID/move').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(ProjectFileValidators.moveProjectFileSchema),
  projectfilesAPI.moveProjectFile,
);

router.route('/project/:projectID/files/content/:folderID?').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(ProjectFileValidators.getProjectFolderContentsSchema),
  projectfilesAPI.getProjectFolderContents,
)

router.route('/project/:projectID/files/:fileID?')
  .post(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    middleware.validateZod(ProjectFileValidators.addProjectFileSchema),
    projectfilesAPI.fileUploadHandler,
    projectfilesAPI.addProjectFile
  ).get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    middleware.validateZod(ProjectFileValidators.getProjectFileSchema),
    projectfilesAPI.getProjectFile,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    middleware.validateZod(ProjectFileValidators.updateProjectFileSchema),
    projectfilesAPI.fileUploadHandler,
    projectfilesAPI.updateProjectFile,
  ).delete(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    middleware.validateZod(ProjectFileValidators.removeProjectFileSchema),
    projectfilesAPI.removeProjectFile,
  );

router.route('/project/:projectID/book/readerresources')
  .get(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('getProjectBookReaderResources'), //this is plural
    middleware.checkValidationErrors,
    projectsAPI.getProjectBookReaderResources,
  ).put(
    authAPI.verifyRequest,
    authAPI.getUserAttributes,
    projectsAPI.validate('updateProjectBookReaderResources'),
    middleware.checkValidationErrors,
    projectsAPI.updateProjectBookReaderResources,
    //No DELETE ENDPOINT - Reader Resources are only PUT with the new data, even if empty
);
router.route('/orgevents')
.get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.getOrgEvents // this is plural
)

router.route('/orgevents/:eventID?')
.get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.getOrgEvent
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('createOrgEvent'),
  middleware.checkValidationErrors,
  orgEventsAPI.createOrgEvent
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('updateOrgEvent'),
  middleware.checkValidationErrors,
  orgEventsAPI.updateOrgEvent
).delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('cancelOrgEvent'),
  middleware.checkValidationErrors,
  orgEventsAPI.cancelOrgEvent
)

router.route('/orgevents/:eventID/participants')
.get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.getOrgEventParticipants
)
.delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate("unregisterParticipants"),
  middleware.checkValidationErrors,
  orgEventsAPI.unregisterParticipants
);

router.route('/orgevents/:eventID/participants/download')
.get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.downloadParticipantData
)

router.route('/orgevents/:eventID/register')
.post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('submitRegistration'),
  middleware.checkValidationErrors,
  orgEventsAPI.submitRegistration
)

router.route('/orgevents/:eventID/feewaivers')
.get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.checkValidationErrors,
  orgEventsAPI.getOrgEventFeeWaivers,
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('createFeeWaiver'),
  middleware.checkValidationErrors,
  orgEventsAPI.createFeeWaiver
);

router.route('/orgevents/:eventID/feewaivers/:feeWaiverCode').patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('updateFeeWaiver'),
  middleware.checkValidationErrors,
  orgEventsAPI.updateFeeWaiver,
);

router.route('/orgevents/:eventID/configure-sync/:projectID').put(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  orgEventsAPI.validate('configureAutoSync'),
  middleware.checkValidationErrors,
  orgEventsAPI.configureAutoSync,
)

router.route('/apiclients/:clientID').get(
  authAPI.verifyRequest,
  apiClientsAPI.validate('getAPIClient'),
  middleware.checkValidationErrors,
  apiClientsAPI.getAPIClient,
);

router.route('/c-ids').get(
  CIDDescriptorsAPI.validate('getCIDDescriptors'),
  middleware.checkValidationErrors,
  CIDDescriptorsAPI.getCIDDescriptors,
);

router.route('/c-ids/sync/automated').put(
  middleware.checkLibreAPIKey,
  CIDDescriptorsAPI.runAutomatedSyncCIDDescriptors,
);

router.route('/payments/webhook').post(
  express.raw({ type: 'application/json' }),
  paymentsAPI.processStripeWebhookEvent,
);

router.route('/central-identity/webhooks/new-user').post(
  express.raw({ type: 'application/json' }),
  middleware.authLibreOneRequest,
  middleware.validateZod(centralIdentityValidators.NewUserWebhookValidator),
  centralIdentityAPI.processNewUserWebhookEvent,
)

router.route('/central-identity/webhooks/user-library-access').post(
  express.raw({ type: 'application/json' }),
  middleware.authLibreOneRequest,
  middleware.validateZod(centralIdentityValidators.LibraryAccessWebhookValidator),
  centralIdentityAPI.processLibraryAccessWebhookEvent,
)

router.route('/kb/search').get(
  middleware.validateZod(kbValidators.SearchKBValidator),
  kbAPI.searchKB
)

router.route('/kb/tree').get(
  authAPI.optionalVerifyRequest,
  kbAPI.getKBTree
)

router.route('/kb/page').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.CreateKBPageValidator),
  kbAPI.createKBPage
)

router.route('/kb/page/slug/:slug').get(
  middleware.validateZod(kbValidators.GetKBPageValidator),
  kbAPI.getKBPage
)

router.route('/kb/page/:uuid').get(
  middleware.validateZod(kbValidators.GetKBPageValidator),
  kbAPI.getKBPage
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.UpdateKBPageValidator),
  kbAPI.updateKBPage  
).delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.DeleteKBPageValidator),
  kbAPI.deleteKBPage
)

router.route('/kb/page/:uuid/files').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(kbValidators.AddKbImageValidator),
  kbAPI.imageUploadHandler,
  kbAPI.addKBImage,
)

router.route('/kb/featured').get(
  kbAPI.getKBFeaturedContent
)

router.route('/kb/featured/page').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.CreateKBFeaturedPageValidator),
  kbAPI.createKBFeaturedPage
)

router.route('/kb/featured/page/:uuid').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.DeleteKBFeaturedPageValidator),
  kbAPI.deleteKBFeaturedPage
)

router.route('/kb/featured/video').post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.CreateKBFeaturedVideoValidator),
  kbAPI.createKBFeaturedVideo
)

router.route('/kb/featured/video/:uuid').delete(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'kbeditor'),
  middleware.validateZod(kbValidators.DeleteKBFeaturedVideoValidator),
  kbAPI.deleteKBFeaturedVideo
)

router.route('/support/metrics').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  supportAPI.getSupportMetrics
)

router.route('/support/ticket/open').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  middleware.validateZod(supportValidators.GetOpenTicketsValidator),
  supportAPI.getOpenInProgressTickets
)

router.route('/support/ticket/closed').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  middleware.validateZod(supportValidators.GetClosedTicketsValidator),
  supportAPI.getClosedTickets
)

router.route('/support/ticket/user').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(supportValidators.GetUserTicketsValidator), //TODO: RBAC
  supportAPI.getUserTickets
)

router.route('/support/ticket/:uuid/assign').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  supportAPI.getAssignableUsers
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  middleware.validateZod(supportValidators.AssignTicketValidator),
  supportAPI.assignTicket
)

router.route('/support/ticket/:uuid/msg').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(supportValidators.GetTicketValidator), //TODO: RBAC
  supportAPI.getTicketMessages
).post(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(supportValidators.SendTicketMessageValidator), //TODO: RBAC
  supportAPI.createMessage
)

router.route('/support/ticket/:uuid/attachments').post(
  middleware.validateZod(supportValidators.AddTicketAttachementsValidator), //TODO: RBAC
  supportAPI.ticketAttachmentUploadHandler,
  supportAPI.addTicketAttachments
);

router.route('/support/ticket/:uuid').get(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  middleware.validateZod(supportValidators.GetTicketValidator), //TODO: RBAC
  supportAPI.getTicket
).patch(
  authAPI.verifyRequest,
  authAPI.getUserAttributes,
  authAPI.checkHasRoleMiddleware('libretexts', 'support'),
  middleware.validateZod(supportValidators.UpdateTicketValidator),
  supportAPI.updateTicket
)

router.route('/support/ticket').post(
  authAPI.optionalVerifyRequest,
  middleware.validateZod(supportValidators.CreateTicketValidator),
  supportAPI.ticketAttachmentUploadHandler,
  supportAPI.createTicket
)

export default router;
