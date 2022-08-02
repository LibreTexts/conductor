//
// LibreTexts Conductor
// homeworks.js
//

'use strict';
import Promise from 'bluebird';
import b62 from 'base62-random';
import axios from 'axios';
import Homework from '../models/homework.js';
import conductorErrors from '../conductor-errors.js';
import { isEmptyString } from '../util/helpers.js';
import { debugError, debugADAPTSync, debugServer } from '../debug.js';
import alertsAPI from './alerts.js';

/**
 * Get all Homework resources.
 */
const getAllHomework = (_req, res) => {
    Homework.aggregate([
        {
            $match: {}
        }, {
            $sort: {
                title: 1
            }
        }, {
            $project: {
                __id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((homeworkRes) => {
        return res.send({
            err: false,
            homework: homeworkRes
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
 * Get Homework resources originating from the ADAPT servers.
 */
const getADAPTCatalog = (_req, res) => {
    Homework.aggregate([
        {
            $match: {
                kind: 'adapt'
            }
        }, {
            $sort: {
                title: 1
            }
        }, {
            $project: {
                __id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ]).then((adaptCourses) => {
        return res.send({
            err: false,
            courses: adaptCourses
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
 * Queries the ADAPT server for ADAPT Commons courses and their assignments,
 * then upserts them into the Homework collection (as kind: 'adapt').
 * 
 */
const syncADAPTCommons = () => {
    let assgnBaseURL = 'https://adapt.libretexts.org/api/assignments/open/commons/';
    let adaptCourses = [];
    let assgnRequests = [];
    let updatedCount = 0;
    return axios.get('https://adapt.libretexts.org/api/courses/commons').then((acRes) => {
        if (acRes.data && acRes.data.type === 'success') {
            if (acRes.data.commons_courses && Array.isArray(acRes.data.commons_courses) &&
                acRes.data.commons_courses.length > 0) {
                    acRes.data.commons_courses.forEach((course) => {
                        if (course.id && !isNaN(course.id)) {
                            let isOpen = false;
                            if (course.hasOwnProperty('anonymous_users') && course.anonymous_users === 1) {
                                isOpen = true;
                            }
                            adaptCourses.push({
                                title: course.name,
                                kind: 'adapt',
                                externalID: course.id.toString(),
                                description: course.description,
                                adaptAssignments: [],
                                adaptOpen: isOpen
                            });
                            assgnRequests.push(axios.get(assgnBaseURL + course.id));
                        }
                    });
            }
            if (assgnRequests.length > 0) {
                return Promise.all(assgnRequests);
            } else {
                return [];
            }
        } else {
            throw(new Error('adaptcommons'));
        }
    }).then((assgnRes) => {
        let adaptOps = [];
        assgnRes.forEach((axiosRes) => {
            if (axiosRes.data && axiosRes.data.type === 'success') {
                let courseID = String(axiosRes.config.url).replace(assgnBaseURL, '');
                if (axiosRes.data.assignments && Array.isArray(axiosRes.data.assignments)) {
                    adaptCourses.forEach((course, idx, origArray) => {
                        if (course.externalID === courseID) {
                            let adaptAssgns = [];
                            axiosRes.data.assignments.forEach((assgn) => {
                                let descrip = '';
                                if (assgn.description && !isEmptyString(assgn.description)) {
                                    descrip = assgn.description;
                                }
                                adaptAssgns.push({
                                    title: assgn.name,
                                    description: descrip
                                });
                            });
                            origArray[idx] = {
                                ...course,
                                adaptAssignments: adaptAssgns
                            };
                        }
                    });
                }
            }
        });
        adaptCourses.forEach((course) => {
            adaptOps.push({
                updateOne: {
                    filter: {
                        kind: 'adapt',
                        externalID: course.externalID
                    },
                    update: {
                        $setOnInsert: {
                            hwID: b62(11),
                            kind: 'adapt',
                            externalID: course.externalID
                        },
                        $set: {
                            title: course.title,
                            description: course.description,
                            adaptAssignments: course.adaptAssignments,
                            adaptOpen: course.adaptOpen
                        }
                    },
                    upsert: true
                }
            });
        });
        if (adaptOps.length > 0) {
            return Homework.bulkWrite(adaptOps, {
                ordered: false
            });
        } else {
            return {};
        }
    }).then((adaptRes) => {
        let upsertedIds = [];
        if (typeof (adaptRes.upsertedIds) === 'object') {
            Object.keys(adaptRes.upsertedIds).forEach((key) => {
                upsertedIds.push(adaptRes.upsertedIds[key]);
            });
        }
        if (adaptRes.modifiedCount) updatedCount = adaptRes.modifiedCount;
        if (upsertedIds.length > 0) return alertsAPI.processInstantHomeworkAlerts(upsertedIds);
        return true;
    }).then(() => {
        // ignore return value of processing Alerts
        let msg = 'Succesfully synced ADAPT courses & assignments.';
        if (updatedCount > 0) msg += ` ${updatedCount} courses updated.`;
        return {
            err: false,
            msg: msg
        };
    }).catch((err) => {
        if (err.result) { // bulkWrite errors
            if (err.result.nInserted > 0) { // Some succeeded
                debugADAPTSync(`Inserted only ${err.results.nInserted} courses when ${adaptCourses.length} were expected.`);
                return {
                    err: false,
                    msg: `Imported ${err.results.nInserted} courses and their assignments from ADAPT.`
                };
            } else {
                return {
                    err: true,
                    errMsg: conductorErrors.err15
                };
            }
        } else if (err.message && err.message === 'adaptcommons') { // get request error
            return {
                err: true,
                errMsg: conductorErrors.err14
            };
        } else { // other errors
            debugError(err);
            return {
                err: true,
                errMsg: conductorErrors.err6
            };
        }
    });
};


/**
 * Triggers syncs with all applicable, connected Homework systems.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const syncHomework = (_req, res) => {
    /* Use Promise chain to add other Homework systems later */
    return syncADAPTCommons().then((adaptResponse) => {
        if (typeof (adaptResponse) === 'object') {
            return res.send(adaptResponse);
        } else {
            throw (new Error('internalerror'));
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
 * Runs the Homework system(s) sync job(s) via on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const runAutomatedHomeworkSync = (req, res) => {
    debugServer(`Received automated request to sync Commons with Homework systems ${new Date().toLocaleString()}`);
    return syncHomework(req, res);
};

export default {
    getAllHomework,
    getADAPTCatalog,
    syncHomework,
    runAutomatedHomeworkSync
}
