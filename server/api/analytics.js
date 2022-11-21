/**
 * @file Defines functions for interacting with LibreTexts Learning Analytics.
 * @author LibreTexts <info@libretexts.org>
 */

import express from 'express';
import axios from 'axios';
import b62 from 'base62-random';
import { body, param, query } from 'express-validator';
import AnalyticsCourse from '../models/analyticscourse.js';
import AnalyticsInvite from '../models/analyticsinvite.js';
import AnalyticsRequest from '../models/analyticsrequest.js';
import User from '../models/user.js';
import usersAPI from './users.js';
import mailAPI from './mail.js';
import { parseLibreTextsURL } from '../util/bookutils.js';
import { getProductionURL } from '../util/helpers.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';

/**
 * Redirects the user agent to the Learning Analytics auth flow initiation endpoint.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
function startLearningAnalyticsFlow(req, res) {
  let redirectURL = process.env.LEARNING_ANALYTICS_INIT_URL || 'https://libretexts.org';
  if (req.query.courseID) {
    redirectURL = `${redirectURL}?courseID=${req.query.courseID}`;
  }
  return res.redirect(redirectURL);
}

/**
 * Queries the corresponding LibreTexts library of a provided URL for information about a page to
 * determine if it is a valid Analytics Course Textbook URL.
 *
 * @param {string} libreURL - URL of a LibreTexts library page.
 * @returns {Promise<any[]>} A tuple containing a validity boolean and the found
 *  bookID (or null if invalid).
 */
async function validateTextbookURL(libreURL) {
  try {
    const [subdomain, path] = parseLibreTextsURL(libreURL);
    const apiBase = `https://api.libretexts.org/endpoint`;
    const reqData = {
      subdomain,
      path,
      dreamformat: 'json',
    };
    const reqConfig = { headers: { origin: getProductionURL() } };

    const pageData = (await axios.put(`${apiBase}/info`, reqData, reqConfig)).data;
    const pageID = pageData['@id'];
    const bookID = `${subdomain}-${pageID}`;

    const pageTags = (await axios.put(`${apiBase}/tags`, reqData, reqConfig)).data;    
    const tagsData = pageTags.tag;
    const coverpageTags = ['coverpage:yes', 'coverpage:toc'];
    if (Array.isArray(tagsData)) {
      for (let i = 0, n = tagsData.length; i < n; i += 1) {
        const element = tagsData[i];
        if (typeof (element['@value']) === 'string' && coverpageTags.includes(element['@value'])) {
          return [true, bookID];
        }
      }
    } else if (typeof (tagsData) === 'object') {
      if (typeof (tagsData['@value']) === 'string' && coverpageTags.includes(tagsData['@value'])) {
        return [true, bookID];
      }
    }
  } catch (e) {
    debugError(e);
  }
  return [false, null];
}

/**
 * Attempts to connect an Analytics Course to an ADAPT Course via POST request.
 *
 * @param {string} sharingKey - User-provided ADAPT Analytics Sharing Key.
 * @param {string} newCourseID - The identifier of the Analytics Course to be created/updated.
 * @returns {Promise<string|null>} The ADAPT course identifier, or null if
 *  invalid key/request error.
 */
async function connectADAPTCourse(sharingKey, newCourseID) {
  try {
    const connectRes = await axios.post(
      `https://adapt.libretexts.org/analytics-dashboard/sync/${newCourseID}`,
      null,
      { headers: { Authorization: `Bearer ${sharingKey}` } },
    );
    if (connectRes.data.course_id) {
      return connectRes.data.course_id;
    }
  } catch (e) {
    debugError(e);
  }
  return null;
}

/**
 * Parses a provided Course Term date into a new Date object with appropriate values set.
 *
 * @param {string} dateStr - Term date string in 'MM-DD-YYYY' format.
 * @param {boolean} [end=false] - Indicates the date is the end of the term. 
 * @returns {Date} The initialized Course Term start/end Date.
 */
function parseCourseTermDateStr(dateStr, end = false) {
  const [monthRaw, date, year] = dateStr.split('-');
  const month = Number.parseInt(monthRaw) - 1;
  if (!end) {
    return new Date(year, month, date);
  }
  return new Date(year, month, date, 23, 59, 59, 999);
}

/**
 * Creates a new Analytics Access Request for an Analytics Course and notifies
 * the LibreTexts team.
 *
 * @param {string} requester - UUID of the requester/course creator.
 * @param {string} courseID - Identifier of the newly created course.
 * @returns {Promise<boolean>} True if request created, false otherwise.
 */
async function createAnalyticsAccessRequest(requester, courseID) {
  try {
    await new AnalyticsRequest({
      requester,
      courseID,
      status: 'open',
    }).save();
    await mailAPI.sendAnalyticsAccessRequestCreated();
    return true;
  } catch (e) {
    debugError(e);
  }
  return false;
}

/**
 * Creates and saves a new Analytics Course with the current user as the instructor.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function createAnalyticsCourse(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { title, term, start: startRaw, end: endRaw } = req.body;
    const courseID = b62(6);

    const hasTextbookURL = (
      req.body.textbookURL
      && req.body.textbookURL.match(/.libretexts.org/i)
    );
    const hasADAPTSharingKey = (
      req.body.adaptSharingKey
      && req.body.adaptSharingKey.trim().length > 0
    );
    if (!hasTextbookURL && !hasADAPTSharingKey) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err75,
      });
    }

    // parse term dates
    const start = parseCourseTermDateStr(startRaw);
    const end = parseCourseTermDateStr(endRaw);
    if (end.getTime() < start.getTime()) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err78,
      });
    }

    const newCourse = {
      title,
      term,
      start,
      end,
      courseID,
      status: 'active',
      types: ['learning'],
      creator: req.user.decoded.uuid,
      instructors: [req.user.decoded.uuid],
      viewers: [],
      students: [],
    };

    let needsApproval = false;

    // verify LibreText URL
    if (hasTextbookURL) {
      const [valid, bookID] = await validateTextbookURL(req.body.textbookURL.trim());
      if (!valid) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err76,
        });
      }
      newCourse.status = 'pending';
      newCourse.pendingTextbookURL = req.body.textbookURL;
      newCourse.pendingTextbookID = bookID;
      needsApproval = true;
    }

    // connect to ADAPT course
    if (hasADAPTSharingKey) {
      const adaptCourse = await connectADAPTCourse(req.body.adaptSharingKey.trim(), courseID);
      if (!adaptCourse) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err77,
        });
      }
      newCourse.adaptCourseID = adaptCourse;
    }

    await new AnalyticsCourse(newCourse).save();

    if (needsApproval) {
      await createAnalyticsAccessRequest(req.user.decoded.uuid, courseID);
    }

    return res.send({
      courseID,
      err: false,
      msg: 'Successfully created Analytics Course!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Creates and sends an invitation to join an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function createAnalyticsInvite(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const { invitee, newRole } = req.body;

    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!course.instructors.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const sender = await User.findOne(
      { uuid: req.user.decoded.uuid },
      { firstName: 1, lastName: 1 },
    ).lean();

    const foundInvitee = await User.findOne({ uuid: invitee }).lean();
    if (!foundInvitee) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err1,
      });
    };

    const now = new Date();
    const expiresAt = new Date().setDate(now.getDate() + 14); // 2 weeks
    const newInvite = await new AnalyticsInvite({
      courseID,
      expiresAt,
      newRole,
      accepted: false,
      sender: req.user.decoded.uuid,
      invitee: foundInvitee.uuid,
    }).save();

    mailAPI.sendAnalyticsInvite(
      { firstName: sender.firstName, lastName: sender.lastName },
      {
        email: foundInvitee.email,
        firstName: foundInvitee.firstName,
        lastName: foundInvitee.lastName,
      },
      { title: course.title },
      newInvite._id,
    ).catch((e) => {
      console.warn('Error sending invitation email:');
      console.warn(e);
    });

    return res.send({
      err: false,
      msg: 'Invitation successfully sent!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of Analytics Courses the current user has access to.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getUserAnalyticsCourses(req, res) {
  try {
    const courses = await AnalyticsCourse.aggregate([
      {
        $match: {
          $or: [
            { instructors: req.user.decoded.uuid },
            { viewers: req.user.decoded.uuid },
          ],
        },
      }, {
        $addFields: {
          hasTextbook: {
            $toBool: {
              $and: [
                { $ne: [{ $type: '$textbookID' }, 'missing'] },
                { $gt: [{ $strLenBytes: '$textbookID' }, 0] },
              ],
            },
          },
          hasADAPT: {
            $toBool: {
              $and: [
                { $ne: [{ $type: '$adaptCourseID' }, 'missing'] },
                { $ne: [{ $strLenBytes: '$adaptCourseID' }, 0] },
              ],
            },
          },
        },
      }, {
        $project: {
          _id: 0,
          __v: 0,
          instructors: 0,
          viewers: 0,
          students: 0,
          pendingTextbookURL: 0,
          pendingTextbookID: 0,
        },
      }, {
        $sort: {
          title: 1,
        },
      },
    ]);

    return res.send({
      courses,
      err: false,
      msg: 'Successfully retrieved user courses.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves basic information about an Analytics course.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getAnalyticsCourse(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }, {
      _id: 0,
      __v: 0,
      students: 0,
      pendingTextbookURL: 0,
      pendingTextbookID: 0,
    }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const canEdit = course.instructors.includes(req.user.decoded.uuid);
    if (!canEdit && !course.viewers.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    return res.send({
      course,
      canEdit,
      err: false,
      msg: 'Successfully retrieved course.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a student roster for an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
async function getAnalyticsCourseRoster(req, res) {
  try {
    const DEFAULT_SORT = 'lastName';

    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }, {
      instructors: 1,
      viewers: 1,
      students: { firstName: 1, lastName: 1, email: 1 },
      adaptCourseID: 1,
    }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const hasADAPT = course.adaptCourseID ? true : false;
    const canEdit = course.instructors.includes(req.user.decoded.uuid);
    if (!canEdit && !course.viewers.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const sortKey = req.query.sort || DEFAULT_SORT;
    const collator = new Intl.Collator();

    const results = course.students || [];
    const students = results.sort((a, b) => collator.compare(a[sortKey], b[sortKey]));

    return res.send({
      courseID,
      students,
      hasADAPT,
      canEdit,
      err: false,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of members of an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
 async function getAnalyticsCourseMembers(req, res) {
  try {
    const MEMBER_PROJECTION = {
      _id: 0,
      uuid: 1,
      firstName: 1,
      lastName: 1,
      avatar: 1,
      role: 1,
      creator: 1,
    };

    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const courses = await AnalyticsCourse.aggregate([
      {
        $match: { courseID }
      }, {
        $lookup: {
          from: 'users',
          let: { instructors: '$instructors', creator: '$creator' },
          pipeline: [{
            $match: {
              $expr: { $in: ['$uuid', '$$instructors'] },
            },
          }, {
            $project: {
              ...MEMBER_PROJECTION,
              role: 'instructor',
              creator: { $eq: ['$uuid', '$$creator'] },
            },
          }],
          as: 'instructors',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { viewers: '$viewers' },
          pipeline: [{
            $match: {
              $expr: { $in: ['$uuid', '$$viewers'] },
            },
          }, {
            $project: {
              ...MEMBER_PROJECTION,
              role: 'viewer',
            },
          }],
          as: 'viewers',
        },
      }, {
        $addFields: {
          members: {
            $concatArrays: ['$instructors', '$viewers'],
          },
        },
      }, {
        $project: {
          _id: 0,
          members: 1,
        },
      },
    ]);

    if (courses.length < 1) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const results = courses[0].members;
    const foundUser = results.find((item) => item.uuid === req.user.decoded.uuid);
    if (!foundUser) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const collator = new Intl.Collator();
    const members = results.sort((a, b) => (
      collator.compare(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)
    ));

    return res.send({
      members,
      canEdit: foundUser.role === 'instructor',
      err: false,
      msg: 'Successfully retrieved course members.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of open Analytics Access Requests.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getAnalyticsAccessRequests(_req, res) {
  try {
    const requests = await AnalyticsRequest.aggregate([
      {
        $match: {
          status: 'open',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { requester: '$requester' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$uuid', '$$requester'],
              },
            },
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
              email: 1,
              instructorProfile: 1,
              verifiedInstructor: 1,
            },
          }],
          as: 'requester',
        }
      }, {
        $lookup: {
          from: 'analyticscourses',
          let: { courseID: '$courseID' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$courseID', '$$courseID'],
              },
            },
          }, {
            $project: {
              _id: 0,
              courseID: 1,
              title: 1,
              pendingTextbookID: 1,
            },
          }],
          as: 'course',
        },
      }, {
        $addFields: {
          requester: {
            $cond: [
              { $gt: [{ $size: '$requester' }, 0] },
              { $arrayElemAt: ['$requester', 0] },
              '$$REMOVE',
            ],
          },
          course: {
            $cond: [
              { $gt: [{ $size: '$course' }, 0] },
              { $arrayElemAt: ['$course', 0] },
              '$$REMOVE',
            ],
          },
        },
      }, {
        $sort: {
          createdAt: -1,
        }
      },
    ]);
    return res.send({
      requests,
      msg: 'Successfully retrieved Analytics Access Requests.',
      err: false,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of the current user's open Analytics invitations.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Incoming response object.
 */
async function getUserAnalyticsInvites(req, res) {
  try {
    const invites = await AnalyticsInvite.aggregate([
      {
        $match: {
          $and: [
            { invitee: req.user.decoded.uuid },
            { accepted: false },
            { $expr: { $gt: ['$expiresAt', '$$NOW'] } },
          ],
        },
      }, {
        $lookup: {
          from: 'analyticscourses',
          let: { courseID: '$courseID' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$courseID', '$$courseID'],
              },
            },
          }, {
            $project: {
              _id: 0,
              courseID: 1,
              title: 1,
            },
          }],
          as: 'course',
        }
      }, {
        $lookup: {
          from: 'users',
          let: { sender: '$sender' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$uuid', '$$sender'],
              },
            },
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          }],
          as: 'sender',
        },
      }, {
        $addFields: {
          course: { $arrayElemAt: ['$course', 0] },
          sender: { $arrayElemAt: ['$sender', 0] },
        },
      }, {
        $sort: {
          'course.title': 1,
        },
      }
    ]);
    return res.send({
      invites,
      err: false,
      msg: 'Successfully retrieved Analytics Invites.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a list of all invitations for an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object.
 */
async function getAnalyticsCourseInvites(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const members = [...course.instructors, ...course.viewers];
    if (!members.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const invites = await AnalyticsInvite.aggregate([
      {
        $match: {
          courseID: courseID,
        },
      }, {
        $lookup: {
          from: 'users',
          let: { invitee: '$invitee' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$uuid', '$$invitee'],
              },
            },
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          }],
          as: 'invitee',
        },
      }, {
        $lookup: {
          from: 'users',
          let: { sender: '$sender' },
          pipeline: [{
            $match: {
              $expr: {
                $eq: ['$uuid', '$$sender'],
              },
            },
          }, {
            $project: {
              _id: 0,
              uuid: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          }],
          as: 'sender',
        },
      }, {
        $addFields: {
          invitee: { $arrayElemAt: ['$invitee', 0] },
          sender: { $arrayElemAt: ['$sender', 0] },
          status: {
            $switch: {
              branches: [
                { case: { $eq: ['$accepted', true] }, then: 'accepted' },
                { case: { $gt: ['$$NOW', '$expiresAt'] }, then: 'expired' },
              ],
              default: 'pending',
            },
          },
        },
      }, {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    return res.send({
      invites,
      err: false,
      msg: 'Successfully retrieved course invitations.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates general properties of an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateAnalyticsCourse(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!course.instructors.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const updateObj = {};
    if (Object.hasOwn(req.body, 'title') && req.body.title !== course.title) {
      updateObj.title = req.body.title;
    }
    if (Object.hasOwn(req.body, 'term') && req.body.term !== course.term) {
      updateObj.term = req.body.term;
    }
    if (Object.hasOwn(req.body, 'start') && req.body.start !== course.start) {
      updateObj.start = parseCourseTermDateStr(req.body.start);
    }
    if (Object.hasOwn(req.body, 'end') && req.body.end !== course.end) {
      updateObj.end = parseCourseTermDateStr(req.body.end);
    }

    if (Object.keys(updateObj).length > 0) {
      const updateRes = await AnalyticsCourse.updateOne({ courseID }, updateObj);
      if (!updateRes.acknowledged) {
        throw (new Error('Course update failed.'));
      }
    } else {
      return res.send({
        err: false,
        msg: 'Nothing to update.',
      });
    }

    return res.send({
      err: false,
      msg: 'Successfully updated analytics course!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates the student roster of an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateAnalyticsCourseRoster(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!course.instructors.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { students } = req.body;
    const updateObj = { students };
    const updateRes = await AnalyticsCourse.updateOne({ courseID }, updateObj);
    if (!updateRes.acknowledged) {
      throw (new Error('Course update failed.'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated analytics course roster!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates the access setting for a course member.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
 async function updateAnalyticsCourseMemberAccess(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID, uuid } = req.params;
    const { role } = req.body;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    let instructors = course.instructors;
    let viewers = course.viewers;
    const members = [...instructors, ...viewers];
    if (!course.instructors.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    if (!members.includes(uuid)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }
    if (uuid === course.creator) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    if (role === 'instructor') {
      viewers = viewers.filter((item) => item !== uuid);
      instructors.push(uuid);
    }
    if (role === 'viewer') {
      instructors = instructors.filter((item) => item !== uuid);
      viewers.push(uuid);
    }

    const update = await AnalyticsCourse.updateOne({ courseID }, { instructors, viewers });
    if (!update.acknowledged) {
      throw (new Error('Error updating course members.'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated course members.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Closes an Analytics Access Request by marking it as Approved or Denied.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function completeAnalyticsAccessRequest(req, res) {
  try {
    const { requestID } = req.params;
    const { verb, message } = req.body;
    const isApproved = verb === 'approve';
    const foundRequest = await AnalyticsRequest.findOne({ _id: requestID }).lean();
    if (!foundRequest) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const analyticsCourse = await AnalyticsCourse.findOne({ courseID: foundRequest.courseID }).lean();
    if (!analyticsCourse) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err22,
      });
    }

    const requester = await User.findOne({ uuid: foundRequest.requester }, {
      email: 1,
      firstName: 1,
    }).lean();
    if (!requester) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err22,
      });
    }

    const requesterMsgData = { email: requester.email, firstName: requester.firstName };
    const courseMsgData = { courseID: analyticsCourse.courseID, title: analyticsCourse.title };
    const courseUpdateObj = {
      $set: {
        status: 'active',
        ...(isApproved ? {
          textbookURL: analyticsCourse.pendingTextbookURL,
          textbookID: analyticsCourse.pendingTextbookID,
        } : {
          textbookDenied: true,
        }),
      },
      $unset: {
        pendingTextbookURL: '',
        pendingTextbookID: '',
      },
    };
    const requestUpdateObj = { status: isApproved ? 'approved' : 'denied' };

    const courseUpdate = await AnalyticsCourse.updateOne({ courseID: foundRequest.courseID }, courseUpdateObj);
    if (!courseUpdate.acknowledged) {
      throw (new Error('Course update failed.'));
    }

    const requestUpdate = await AnalyticsRequest.updateOne({ _id: requestID }, requestUpdateObj);
    if (!requestUpdate.acknowledged) {
      throw (new Error('Request approval update failed.'));
    }

    if (isApproved) {
      mailAPI.sendAnalyticsAccessRequestApproved(requesterMsgData, courseMsgData).catch((e) => {
        console.warn('Error sending approval notification:');
        console.warn(e);
      });
    } else {
      mailAPI.sendAnalyticsAccessRequestDenied(
        requesterMsgData,
        courseMsgData,
        message,
      ).catch((e) => {
        console.warn('Error sending denial notification:');
        console.warn(e);
      });
    }

    return res.send({
      err: false,
      msg: `Analytics Access Request successfully ${isApproved ? 'approved!' : 'marked Denied.'}`,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Accepts an Analytics Invite.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function acceptAnalyticsInvite(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { inviteID } = req.params;
    const invite = await AnalyticsInvite.findOne({ _id: inviteID }).lean();
    if (!invite) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (req.user.decoded.uuid !== invite.invitee) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    const now = new Date();
    if (invite.expiresAt < now) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const course = await AnalyticsCourse.findOne({ courseID: invite.courseID }).lean();
    if (!course) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err22,
      });
    }

    let instructors = course.instructors || [];
    let viewers = course.viewers || []; 
    if (invite.newRole === 'instructor') {
      const instructorSet = new Set(instructors);
      instructorSet.add(req.user.decoded.uuid);
      instructors = Array.from(instructorSet);
    }
    if (invite.newRole === 'viewer') {
      const viewerSet = new Set(viewers);
      viewerSet.add(req.user.decoded.uuid);
      viewers = Array.from(viewerSet);
    }

    const courseUpdate = await AnalyticsCourse.updateOne(
      { courseID: invite.courseID },
      { instructors, viewers },
    );
    if (!courseUpdate.acknowledged) {
      throw (new Error('Error updating course to accept invite.'));
    }

    const inviteUpdate = await AnalyticsInvite.updateOne({ _id: inviteID }, {
      accepted: true,
      acceptedAt: new Date(),
    });
    if (!inviteUpdate.acknowledged) {
      throw (new Error('Error updating invite to accept.'));
    }

    const [sender, invitee] = await Promise.all([
      User.findOne({ uuid: invite.sender }).lean(),
      User.findOne({ uuid: invite.invitee }).lean(),
    ]);
    mailAPI.sendAnalyticsInviteAccepted(
      { firstName: sender.firstName, email: sender.email },
      { firstName: invitee.firstName, lastName: invitee.lastName },
      { title: course.title },
    ).catch((e) => {
      console.warn('Error sending invite accepted notification:');
      console.warn(e);
    });

    return res.send({
      err: false,
      msg: 'Successfully accepted Analytics invite!',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Deletes an Analytics Course, if the current user created the course.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function deleteAnalyticsCourse(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    if (req.user.decoded.uuid !== course.creator) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    await AnalyticsCourse.deleteOne({ courseID });

    return res.send({
      err: false,
      msg: 'Successfully deleted analytics course.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Removes a member from an Analytics Course.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
 async function removeAnalyticsCourseMember(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { courseID, uuid } = req.params;
    const course = await AnalyticsCourse.findOne({ courseID }).lean();
    if (!course) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (!course.instructors.includes(req.user.decoded.uuid)) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }
    if (uuid === course.creator) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const update = await AnalyticsCourse.updateOne({ courseID }, {
      instructors: course.instructors.filter((item) => item !== uuid),
      viewers: course.viewers.filter((item) => item !== uuid),
    });
    if (!update.acknowledged) {
      throw (new Error('Error updating course members.'));
    }

    return res.send({
      err: false,
      msg: 'Successfully updated course members.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Deletes an Analytics Access Request. The related Analytics Course may also be deleted,
 * if specified.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function deleteAnalyticsAccessRequest(req, res) {
  try {
    const { requestID } = req.params;
    const { deleteCourse } = req.query;
    const foundRequest = await AnalyticsRequest.findOne({ _id: requestID }).lean();
    if (!foundRequest) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    if (deleteCourse) {
      const courseDeletion = await AnalyticsCourse.deleteOne({ courseID: foundRequest.courseID });
      if (courseDeletion.deletedCount !== 1) {
        console.warn(`Error occurred deleting course ${foundRequest.courseID}`);
      }
    }

    const deletion = await AnalyticsRequest.deleteOne({ _id: requestID });
    if (!deletion.acknowledged) {
      throw (new Error('Error deleting request.'));
    }

    return res.send({
      err: false,
      msg: 'Analytics Access Request was successfully deleted.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Allows an invitee or an Analytics Course manager to delete a pending invitation.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function deleteAnalyticsInvite(req, res) {
  try {
    const canDoAnalytics = await usersAPI.checkVerifiedInstructorStatus(req.user.decoded.uuid);
    if (!canDoAnalytics) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const { inviteID } = req.params;
    const invite = await AnalyticsInvite.findOne({ _id: inviteID }).lean();
    if (!invite) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      })
    }

    // Check user has permission to delete invite, if not invitee
    if (req.user.decoded.uuid !== invite.invitee) {
      const course = await AnalyticsCourse.findOne({ courseID: invite.courseID }).lean();
      if (!course) {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err22,
        });
      }
      if (!course.instructors.includes(req.user.decoded.uuid)) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const deleteInvite = await AnalyticsInvite.deleteOne({ _id: inviteID });
    if (!deleteInvite.acknowledged) {
      throw (new Error('Error deleting invite.'));
    }

    return res.send({
      err: false,
      msg: 'Invite deleted.',
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Validates that a provided array of Analytics Course students contains necessary and valid fields.
 *
 * @param {object[]} arr - Array of student entries to validate.
 * @returns {boolean} True if valid array, false otherwise.
 */
function validateStudentArray(arr) {
  if (!Array.isArray(arr) || arr.length < 1 || arr.length > 1000) {
    return false;
  }
  let valid = true;
  for (let i = 0, n = arr.length; i < n; i += 1) {
    const elem = arr[i];
    if (
      typeof (elem.firstName) !== 'string'
      || elem.firstName.trim().length < 1
      || elem.firstName.length > 50
    ) {
      valid = false;
      break;
    }
    if (
      typeof (elem.lastName) !== 'string'
      || elem.lastName.trim().length < 1
      || elem.lastName.length > 50
    ) {
      valid = false;
      break;
    }
    if (
      typeof (elem.email) !== 'string'
      || elem.email.trim().length < 1
      || elem.email.length > 320
    ) {
      valid = false;
      break;
    }
  }
  return valid;
} 

/**
 * Sanitizes a provided, valid array of Analytics Course students to only contain
 * valid and normalized fields.
 *
 * @param {object[]} arr - Array of student entries to validate.
 * @returns {object[]} Sanitized array of student entries.
 */
function sanitizeStudentArray(arr) {
  const sanitized = [];
  const discoveredEmails = new Set();
  arr.forEach((item) => {
    const normalizedEmail = item.email.toLowerCase().trim();
    if (!discoveredEmails.has(normalizedEmail)) {
      sanitized.push({
        firstName: item.firstName.trim(),
        lastName: item.lastName.trim(),
        email: item.email.toLowerCase().trim(),
      });
      discoveredEmails.add(normalizedEmail);
    }
  });
  return sanitized;
}

/**
 * Validates a selected Course Roster sort method.
 *
 * @param {string} sort - The selected sort method. 
 * @returns {boolean} True if valid sort method, false otherwise. 
 */
function validateRosterSort(sort) {
  if (typeof (sort) === 'string') {
    return ['firstName', 'lastName', 'email'].includes(sort);
  }
  return false;
}

/**
 * Validates a provided Analytics Access Request completion verb.
 *
 * @param {string} verb - The provided completion verb.
 * @returns {boolean} True if valid verb, false otherwise.
 */
function validateAccessRequestCompletionVerb(verb) {
  if (typeof (verb) === 'string') {
    return ['approve', 'deny'].includes(verb);
  }
  return false;
}

/**
 * Validates a provided Analytics Course member role setting.
 *
 * @param {string} role - The role setting to validate.
 * @returns {boolean} True if valid role, false otherwise.
 */
function validateAnalyticsMemberRole(role) {
  if (typeof (role) === 'string') {
    return ['instructor', 'viewer'].includes(role);
  }
  return false;
}

/**
 * Middleware(s) to validate requests contain necessary and/or valid fields.
 *
 * @param {string} method - Method name to validate request for.
 */
function validate(method) {
  switch (method) {
    case 'startLearningAnalyticsFlow':
      return [
        query('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
      ];
    case 'createAnalyticsCourse':
      return [
        body('title', conductorErrors.err1).exists().isLength({ min: 1, max: 100 }),
        body('term', conductorErrors.err1).exists().isLength({ min: 1, max: 100 }),
        body('start', conductorErrors.err1).exists().isDate({ format: 'MM-DD-YYYY' }),
        body('end', conductorErrors.err1).exists().isDate({ format: 'MM-DD-YYYY' }),
        body('textbookURL', conductorErrors.err1).optional({ checkFalsy: true }).isURL(),
        body('adaptSharingKey', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 1, max: 100 }),
      ];
    case 'createAnalyticsInvite':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        body('invitee', conductorErrors.err1).exists().isUUID(),
        body('newRole', conductorErrors.err1).exists().custom(validateAnalyticsMemberRole),
      ];
    case 'updateAnalyticsCourse':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        body('title', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 1, max: 100 }),
        body('term', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 1, max: 100 }),
        body('start', conductorErrors.err1).optional({ checkFalsy: true }).isDate({ format: 'MM-DD-YYYY' }),
        body('end', conductorErrors.err1).optional({ checkFalsy: true }).isDate({ format: 'MM-DD-YYYY' }),
      ];
    case 'updateAnalyticsCourseRoster':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        body('students', conductorErrors.err1).exists().custom(validateStudentArray).customSanitizer(sanitizeStudentArray),
      ];
    case 'getAnalyticsCourseRoster':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        query('sort', conductorErrors.err1).optional().custom(validateRosterSort),
      ]
    case 'getAnalyticsCourse':
    case 'getAnalyticsCourseMembers':
    case 'getAnalyticsCourseInvites':
    case 'deleteAnalyticsCourse':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
      ];
    case 'updateAnalyticsCourseMemberAccess':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        param('uuid', conductorErrors.err1).exists().isUUID(),
        body('role', conductorErrors.err1).exists().custom(validateAnalyticsMemberRole),
      ];
    case 'completeAnalyticsAccessRequest':
      return [
        param('requestID', conductorErrors.err1).exists().isMongoId(),
        body('verb', conductorErrors.err1).exists().custom(validateAccessRequestCompletionVerb),
        body('message', conductorErrors.err11).optional({ checkFalsy: true }).isLength({ max: 500 }),
      ];
    case 'acceptAnalyticsInvite':
    case 'deleteAnalyticsInvite':
      return [
        param('inviteID', conductorErrors.err1).exists().isMongoId(),
      ];
    case 'deleteAnalyticsAccessRequest':
      return [
        param('requestID', conductorErrors.err1).exists().isMongoId(),
        query('deleteCourse', conductorErrors.err1).optional({ checkFalsy: true }).isBoolean().toBoolean(),
      ];
    case 'removeAnalyticsCourseMember':
      return [
        param('courseID', conductorErrors.err1).exists().isLength({ min: 6, max: 6 }),
        param('uuid', conductorErrors.err1).exists().isUUID(),
      ];
  }
}

export default {
  startLearningAnalyticsFlow,
  createAnalyticsCourse,
  createAnalyticsInvite,
  getUserAnalyticsCourses,
  getAnalyticsCourse,
  getAnalyticsCourseRoster,
  getAnalyticsCourseMembers,
  getAnalyticsAccessRequests,
  getUserAnalyticsInvites,
  getAnalyticsCourseInvites,
  updateAnalyticsCourse,
  updateAnalyticsCourseRoster,
  updateAnalyticsCourseMemberAccess,
  completeAnalyticsAccessRequest,
  acceptAnalyticsInvite,
  deleteAnalyticsCourse,
  removeAnalyticsCourseMember,
  deleteAnalyticsAccessRequest,
  deleteAnalyticsInvite,
  validate,
}
