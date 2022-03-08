//
// LibreTexts Conductor
// alerts.js
//

'use strict';
let Promise = require('bluebird');
const mongoose = require('mongoose');
const Alert = require('../models/alert.js');
const Project = require('../models/project.js');
const Book = require('../models/book.js');
const Homework = require('../models/homework.js');
const { body, query } = require('express-validator');
const b62 = require('base62-random');
const { validate: uuidValidate } = require('uuid');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const {
  isValidDateObject,
  computeDateDifference,
  createAndValidateDateObject
} = require('../util/helpers.js');

const mailAPI = require('./mail.js');

const ONE_DAY = 1000 * 60 * 60 * 24;

const alertResourceOptions = ['project', 'book', 'homework'];
const alertTimingOptions = ['instant', 'daily'];
const alertSortOptions = ['title', 'date'];
const alertProjectLocationFilters = ['global', 'local'];

const projectFields = ['title', 'author', 'libreLibrary', 'libreCoverID',
  'libreShelf', 'libreCampus'];
const bookFields = ['title', 'author', 'affiliation', 'library',
  'subject', 'course', 'program', 'summary'];
const homeworkFields = ['title', 'kind', 'description'];

/**
 * Creates a Project aggregation projection object.
 * @returns {object} An aggregation projection object.
 */
const getProjectProjection = () => {
  let projection = {
    _id: 0,
    orgID: 1,
    projectID: 1,
  };
  projectFields.forEach((field) => {
    projection[field] = 1;
  });
  return projection;
};

/**
 * Creates a Book aggregation projection object.
 * @returns {object} An aggregation projection object.
 */
const getBookProjection = () => {
  let projection = {
    _id: 0,
    bookID: 1
  };
  bookFields.forEach((field) => {
    projection[field] = 1;
  });
  return projection;
};

/**
 * Creates a Homework aggregation projection object.
 * @returns {object} An aggregation projection object.
 */
const getHomeworkProjection = () => {
  let projection = {
    _id: 0
  };
  homeworkFields.forEach((field) => {
    projection[field] = 1;
  });
  return projection;
};

/**
 * Create a new user Alert.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const createAlert = (req, res) => {
  let newAlertData = {
    orgID: process.env.ORG_ID,
    alertID: b62(17),
    user: req.decoded.uuid,
    query: req.body.query,
    timing: req.body.timing,
    resources: req.body.resources,
    lastTriggered: new Date()
  };
  if (req.body.resources.includes('project')) {
    if (typeof (req.body.projectLocation) === 'string') {
      newAlertData.projectLocation = req.body.projectLocation;
    } else {
      newAlertData.projectLocation = 'global';
    }
  }
  return new Alert(newAlertData).save().then((newAlert) => {
    if (newAlert) {
      return res.send({
        err: false,
        msg: 'New Alert successfully created',
        alertID: newAlert.alertID
      });
    } else {
      throw (new Error('createfail'));
    }
  }).catch((err) => {
    let errMsg = conductorErrors.err6;
    if (err.message === 'createfail') errMsg = conductorErrors.err3;
    debugError(err);
    return res.send({
      err: true,
      errMsg: errMsg
    });
  });
};


/**
 * Retrieve a list of a user's Alerts.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const getUserAlerts = (req, res) => {
  return Alert.aggregate([
    {
      $match: {
        user: req.decoded.uuid
      }
    }, {
      $lookup: {
        from: 'organizations',
        let: {
          org: '$orgID'
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$orgID', '$$org']
              }
            }
          }, {
            $project: {
              _id: 0,
              orgID: 1,
              name: 1,
              shortName: 1,
              abbreviation: 1
            }
          }
        ],
        as: 'org'
      }
    }, {
      $addFields: {
        org: {
          $arrayElemAt: ['$org', 0]
        }
      }
    }, {
      $project: {
        _id: 0,
        __v: 0
      }
    }
  ]).then((alerts) => {
    const sortMethod = req.query?.sort || 'title';
    const sorted = alerts.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (sortMethod === 'title') {
        aData = String(a.query).toLowerCase().replace(/[^A-Za-z]+/g, "");
        bData = String(b.query).toLowerCase().replace(/[^A-Za-z]+/g, "");
      } else if (sortMethod === 'date') {
        const aCreated = new Date(a.createdAt);
        const bCreated = new Date(b.createdAt);
        if (isValidDateObject(aCreated) && isValidDateObject(bCreated)) {
          aData = aCreated;
          bData = bCreated;
        }
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });
    return res.send({
      err: false,
      alerts: sorted,
      sort: sortMethod
    });
  }).catch((err) => {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6
    })
  });
};


/**
 * Retrieve a specified Alert.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const getAlert = (req, res) => {
  return Alert.findOne({
    alertID: req.query.alertID,
    user: req.decoded.uuid,
  }, {
    _id: 0,
    __v: 0
  }).then((alert) => {
    if (alert) {
      return res.send({
        err: false,
        alert: alert
      });
    } else {
      return res.send({
        err: true,
        errMsg: conductorErrors.err11
      });
    }
  }).catch((err) => {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6
    });
  });
};


/**
 * Delete an existing Alert.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const deleteAlert = (req, res) => {
  return Alert.deleteOne({
    alertID: req.body.alertID,
    user: req.decoded.uuid
  }).then((deleteRes) => {
    if (deleteRes.deletedCount === 1) {
      return res.send({
        err: false,
        msg: 'Alert successfully deleted.'
      });
    } else {
      throw (new Error('deletefail'));
    }
  }).catch((err) => {
    let errMsg = conductorErrors.err6;
    if (err.message === 'deletefail') errMsg = conductorErrors.err3;
    debugError(err);
    return res.send({
      err: true,
      errMsg: errMsg
    });
  });
};

/**
 * Processes 'instant' Alerts matching newly created Projects.
 * @param {object[]} newProjectIds - An array containg MongoDB id's of new Projects.
 */
 const processInstantProjectAlerts = (newProjectIds) => {
  let aggregations = [];
  let mailToSend = [];
  let alertUpdates = [];
  let projectDBIds = [];
  let alertsToProcess = [];
  let newProjects = [];
  return Promise.try(() => {
    if (Array.isArray(newProjectIds) && newProjectIds.length > 0) {
      newProjectIds.forEach((projectId) => projectDBIds.push(mongoose.Types.ObjectId(projectId.toString())));
      aggregations.push(Alert.aggregate([
        {
          $match: {
            timing: 'instant',
            resources: 'project'
          }
        }, {
          $lookup: {
            from: 'users',
            let: { user: '$user' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$uuid', '$$user']
                  }
                }
              }, {
                $project: {
                  _id: 0,
                  uuid: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1
                }
              }
            ],
            as: 'userInfo'
          }
        }, {
          $addFields: {
            user: {
              $arrayElemAt: ['$userInfo', 0]
            }
          }
        }, {
          $project: {
            _id: 0,
            __v: 0
          }
        }
      ]));
      aggregations.push(Project.aggregate([
        {
          $match: {
            $and: [
              { _id: {
                  $in: projectDBIds
              }},
              { visibility: 'public' }
            ]
          }
        }, {
          $project: getProjectProjection()
        }
      ]));
      return Promise.all(aggregations);
    }
  }).then((aggregateResults) => {
    [alertsToProcess, newProjects] = aggregateResults;
    for (let i = 0, n = alertsToProcess.length; i < n; i += 1) {
      const currentAlert = alertsToProcess[i];
      const alertQueryRegex = new RegExp(currentAlert.query, 'i');
      let matchingProjects = [];
      newProjects.forEach((project) => {
        let isMatch = false;
        if (
          currentAlert.projectLocation === 'global'
          || (
            currentAlert.projectLocation === 'local'
            && currentAlert.orgID === project.orgID
          )
        ) {
          projectFields.forEach((field) => {
            if (
              !isMatch
              && typeof (project[field]) === 'string'
              && alertQueryRegex.test(project[field])
            ) {
              isMatch = true;
            }
          });
        }
        if (isMatch) matchingProjects.push(project);
      });
      if (matchingProjects.length > 0) {
        mailToSend.push(mailAPI.sendAlertActivatedNotification(
          currentAlert.user.email,
          currentAlert.user.firstName,
          currentAlert.query,
          matchingProjects,
          [],
          []
        ));
        alertUpdates.push(Alert.updateOne({
          alertID: currentAlert.alertID
        }, {
          lastTriggered: new Date()
        }));
      }
    }
    if (alertUpdates.length > 0) {
      return Promise.all(alertUpdates);
    }
    return [];
  }).then(() => {
    // ignore return value of Alert updates
    if (mailToSend.length > 0) return Promise.all(mailToSend);
    return [];
  }).then(() => {
    // ignore return value of Mailgun call(s)
    return true;
  }).catch((err) => {
    debugError(err);
    return false;
  });
};

/**
 * Processes 'instant' Alerts matching newly created Books.
 * @param {object[]} newBookIds - An array containg MongoDB id's of new Books.
 */
 const processInstantBookAlerts = (newBookIds) => {
  let aggregations = [];
  let mailToSend = [];
  let alertUpdates = [];
  let bookDBIds = [];
  let alertsToProcess = [];
  let newBooks = [];
  return Promise.try(() => {
    if (Array.isArray(newBookIds) && newBookIds.length > 0) {
      newBookIds.forEach((bookId) => bookDBIds.push(mongoose.Types.ObjectId(bookId.toString())));
      aggregations.push(Alert.aggregate([
        {
          $match: {
            timing: 'instant',
            resources: 'book'
          }
        }, {
          $lookup: {
            from: 'users',
            let: { user: '$user' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$uuid', '$$user']
                  }
                }
              }, {
                $project: {
                  _id: 0,
                  uuid: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1
                }
              }
            ],
            as: 'userInfo'
          }
        }, {
          $addFields: {
            user: {
              $arrayElemAt: ['$userInfo', 0]
            }
          }
        }, {
          $project: {
            _id: 0,
            __v: 0
          }
        }
      ]));
      aggregations.push(Book.aggregate([
        {
          $match: {
            _id: {
              $in: bookDBIds
            }
          }
        }, {
          $project: getBookProjection()
        }
      ]));
      return Promise.all(aggregations);
    }
  }).then((aggregateResults) => {
    [alertsToProcess, newBooks] = aggregateResults;
    for (let i = 0, n = alertsToProcess.length; i < n; i += 1) {
      const currentAlert = alertsToProcess[i];
      const alertQueryRegex = new RegExp(currentAlert.query, 'i');
      let matchingBooks = [];
      newBooks.forEach((book) => {
        let isMatch = false;
        bookFields.forEach((field) => {
          if (
            !isMatch
            && typeof (book[field]) === 'string'
            && alertQueryRegex.test(book[field])
          ) {
            isMatch = true;
          }
        });
        if (isMatch) matchingBooks.push(book);
      });
      if (matchingBooks.length > 0) {
        mailToSend.push(mailAPI.sendAlertActivatedNotification(
          currentAlert.user.email,
          currentAlert.user.firstName,
          currentAlert.query,
          [],
          matchingBooks,
          []
        ));
        alertUpdates.push(Alert.updateOne({
          alertID: currentAlert.alertID
        }, {
          lastTriggered: new Date()
        }));
      }
    }
    if (alertUpdates.length > 0) {
      return Promise.all(alertUpdates);
    }
    return [];
  }).then(() => {
    // ignore return value of Alert updates
    if (mailToSend.length > 0) return Promise.all(mailToSend);
    return [];
  }).then(() => {
    // ignore return value of Mailgun call(s)
    return true;
  }).catch((err) => {
    debugError(err);
    return false;
  });
};

/**
 * Processes 'instant' Alerts matching newly created Homework resources.
 * @param {object[]} newHomeworkIds - An array containg MongoDB id's of new Homeworks.
 */
const processInstantHomeworkAlerts = (newHomeworkIds) => {
  let aggregations = [];
  let mailToSend = [];
  let alertUpdates = [];
  let homeworkDBIds = [];
  let alertsToProcess = [];
  let newHomeworks = [];
  return Promise.try(() => {
    if (Array.isArray(newHomeworkIds) && newHomeworkIds.length > 0) {
      newHomeworkIds.forEach((homeworkId) => homeworkDBIds.push(mongoose.Types.ObjectId(homeworkId.toString())));
      aggregations.push(Alert.aggregate([
        {
          $match: {
            timing: 'instant',
            resources: 'homework'
          }
        }, {
          $lookup: {
            from: 'users',
            let: { user: '$user' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$uuid', '$$user']
                  }
                }
              }, {
                $project: {
                  _id: 0,
                  uuid: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1
                }
              }
            ],
            as: 'userInfo'
          }
        }, {
          $addFields: {
            user: {
              $arrayElemAt: ['$userInfo', 0]
            }
          }
        }, {
          $project: {
            _id: 0,
            __v: 0
          }
        }
      ]));
      aggregations.push(Homework.aggregate([
        {
          $match: {
            _id: {
              $in: homeworkDBIds
            }
          }
        }, {
          $project: getHomeworkProjection()
        }
      ]));
      return Promise.all(aggregations);
    }
  }).then((aggregateResults) => {
    [alertsToProcess, newHomeworks] = aggregateResults;
    for (let i = 0, n = alertsToProcess.length; i < n; i += 1) {
      const currentAlert = alertsToProcess[i];
      const alertQueryRegex = new RegExp(currentAlert.query, 'i');
      let matchingHomework = [];
      newHomeworks.forEach((homework) => {
        let isMatch = false;
        homeworkFields.forEach((field) => {
          if (
            !isMatch
            && typeof (homework[field]) === 'string'
            && alertQueryRegex.test(homework[field])
          ) {
            isMatch = true;
          }
        });
        if (isMatch) matchingHomework.push(homework);
      });
      if (matchingHomework.length > 0) {
        mailToSend.push(mailAPI.sendAlertActivatedNotification(
          currentAlert.user.email,
          currentAlert.user.firstName,
          currentAlert.query,
          [],
          [],
          matchingHomework
        ));
        alertUpdates.push(Alert.updateOne({
          alertID: currentAlert.alertID
        }, {
          lastTriggered: new Date()
        }));
      }
    }
    if (alertUpdates.length > 0) {
      return Promise.all(alertUpdates);
    }
    return [];
  }).then(() => {
    // ignore return value of Alert updates
    if (mailToSend.length > 0) return Promise.all(mailToSend);
    return [];
  }).then(() => {
    // ignore return value of Mailgun call(s)
    return true;
  }).catch((err) => {
    debugError(err);
    return false;
  });
};


/**
 * Searches for new results for 'daily' Alerts on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const processDailyAlerts = (req, res) => {
  let aggregations = [];
  let mailToSend = [];
  let alertUpdates = [];
  let alertsToProcess = [];
  let allProjects = [];
  let allBooks = [];
  let allHomework = [];

  aggregations.push(Alert.aggregate([
    {
      $match: {
        timing: 'daily'
      }
    }, {
      $lookup: {
        from: 'users',
        let: { user: '$user' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$uuid', '$$user']
              }
            }
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              email: 1
            }
          }
        ],
        as: 'userInfo'
      }
    }, {
      $addFields: {
        user: {
          $arrayElemAt: ['$userInfo', 0]
        }
      }
    }, {
      $project: {
        _id: 0,
        __v: 0
      }
    }
  ]));
  aggregations.push(Project.aggregate([
    {
      $match: {
        visibility: 'public'
      }
    },
    {
      $project: getProjectProjection()
    }
  ]));
  aggregations.push(Book.aggregate([
    {
      $project: getBookProjection()
    }
  ]));
  aggregations.push(Homework.aggregate([
    {
      $project: getHomeworkProjection()
    }
  ]));
  return Promise.all(aggregations).then((aggregateResults) => {
    [alertsToProcess, allProjects, allBooks, allHomework] = aggregateResults;
    for (let i = 0, n = alertsToProcess.length; i < n; i += 1) {
      const currentAlert = alertsToProcess[i];
      const alertQueryRegex = new RegExp(currentAlert.query, 'i');
      const alertLastTriggered = createAndValidateDateObject(currentAlert.lastTriggered);
      if (alertLastTriggered !== null) {
        let matchingProjects = [];
        let matchingBooks = [];
        let matchingHomework = [];
        if (currentAlert.resources.includes('project')) {
          allProjects.forEach((project) => {
            let isMatch = false;
            const projCreated = createAndValidateDateObject(project.createdAt);
            if (
              projCreated !== null
              && computeDateDifference(projCreated, alertLastTriggered) <= ONE_DAY
              && (
                currentAlert.projectLocation === 'global'
                || (
                  currentAlert.projectLocation === 'local'
                  && currentAlert.orgID === project.orgID
                )
              )
            ) {
              projectFields.forEach((field) => {
                if (
                  !isMatch
                  && typeof (project[field]) === 'string'
                  && alertQueryRegex.test(project[field])
                ) {
                  isMatch = true;
                }
              });
            }
            if (isMatch) matchingProjects.push(project);
          });
        }
        if (currentAlert.resources.includes('book')) {
          allBooks.forEach((book) => {
            let isMatch = false;
            const bookCreated = createAndValidateDateObject(book.createdAt);
            if (
              bookCreated !== null
              && computeDateDifference(bookCreated, alertLastTriggered) <= ONE_DAY
            ) {
              bookFields.forEach((field) => {
                if (
                  !isMatch
                  && typeof (book[field]) === 'string'
                  && alertQueryRegex.test(book[field])
                ) {
                  isMatch = true;
                }
              });
            }
            if (isMatch) matchingBooks.push(book);
          });
        }
        if (currentAlert.resources.includes('homework')) {
          allHomework.forEach((homework) => {
            let isMatch = false;
            const homeworkCreated = createAndValidateDateObject(homework.createdAt);
            if (
              homeworkCreated !== null
              && computeDateDifference(homeworkCreated, alertLastTriggered) <= ONE_DAY
            ) {
              homeworkFields.forEach((field) => {
                if (
                  !isMatch
                  && typeof (homework[field]) === 'string'
                  && alertQueryRegex.test(homework[field])
                ) {
                  isMatch = true;
                }
              });
            }
            if (isMatch) matchingHomework.push(homework);
          });
        }
        if (matchingProjects.length > 0 || matchingBooks.length > 0 || matchingHomework.length > 0) {
          mailToSend.push(mailAPI.sendAlertActivatedNotification(
            currentAlert.user.email,
            currentAlert.user.firstName,
            currentAlert.query,
            matchingProjects,
            matchingBooks,
            matchingHomework
          ));
          alertUpdates.push(Alert.updateOne({
            alertID: currentAlert.alertID
          }, {
            lastTriggered: new Date()
          }));
        }
      }
    }
    if (alertUpdates.length > 0) {
      return Promise.all(alertUpdates);
    }
  }).then(() => {
    // ignore return value of Alert updates
    if (mailToSend.length > 0) {
      return Promise.all(mailToSend);
    }
    return [];
  }).then(() => {
    // ignore return value of Mailgun call(s)
    return res.send({
      err: false,
      msg: 'Successfully processed daily alerts.'
    });
  }).catch((err) => {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6
    });
  });
};


/**
 * Validates provided Alert resource options.
 * @param {string[]} resources - The resource options selected.
 * @returns {boolean} True if valid options, false otherwise.
 */
const validateAlertResources = (resources) => {
  if (Array.isArray(resources) && resources.length <= alertResourceOptions.length) {
    let invalidOption = false;
    resources.forEach((option) => {
      if (typeof (option) === 'string') {
        if (!alertResourceOptions.includes(option)) {
          invalidOption = true;
        }
      } else {
        invalidOption = true;
      }
    });
    if (!invalidOption) return true;
  }
  return false;
};


/**
 * Validates a provided Alert timing option.
 * @param {string} timing - The timing option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
const validateAlertTiming = (timing) => {
  if (typeof (timing) === 'string') {
    return alertTimingOptions.includes(timing);
  }
  return false;
};


/**
 * Validates a provided Alert sort option.
 * @param {string} sort - The sort option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
const validateAlertsSortOption = (sort) => {
  if (typeof (sort) === 'string') {
    return alertSortOptions.includes(sort);
  }
  return false;
};

/**
 * Validates a provided Alert Project Location filter option.
 * @param {string} filter - The filter option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
const validateAlertProjectLocationFilter = (filter) => {
  if (typeof (filter) === 'string') {
    return alertProjectLocationFilters.includes(filter);
  }
  return false;
};


/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
  switch (method) {
    case 'createAlert':
      return [
        body('query', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 150 }),
        body('timing', conductorErrors.err1).exists().custom(validateAlertTiming),
        body('resources', conductorErrors.err1).exists().custom(validateAlertResources),
        body('projectLocation', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateAlertProjectLocationFilter)
      ]
    case 'getUserAlerts':
      return [
        query('sort', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateAlertsSortOption)
      ]
    case 'getAlert':
      return [
        query('alertID', conductorErrors.err1).exists().isString().isLength({ min: 17, max: 17 })
      ]
    case 'deleteAlert':
      return [
        body('alertID', conductorErrors.err1).exists().isString().isLength({ min: 17, max: 17 })
      ]
  }
};

module.exports = {
  createAlert,
  getUserAlerts,
  getAlert,
  deleteAlert,
  processInstantProjectAlerts,
  processInstantBookAlerts,
  processInstantHomeworkAlerts,
  processDailyAlerts,
  validate
};
