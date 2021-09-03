//
// LibreTexts Conductor
// homeworks.js
//

'use strict';
const Homework = require('../models/homework.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError, debugObject, debugADAPTSync } = require('../debug.js');
const b62 = require('base62-random');
const axios = require('axios');

const syncADAPTCommons = (req, res) => {
    var assgnBaseURL = 'https://adapt.libretexts.org/api/assignments/commons/';
    var adaptCourses = [];
    var assgnRequests = [];
    axios.get('https://adapt.libretexts.org/api/courses/commons').then((acRes) => {
        if (acRes.data && acRes.data.type === 'success') {
            if (acRes.data.commons_courses && Array.isArray(acRes.data.commons_courses) &&
                acRes.data.commons_courses.length > 0) {
                    acRes.data.commons_courses.forEach((course) => {
                        if (course.id && !isNaN(course.id)) {
                            adaptCourses.push({
                                title: course.name,
                                kind: 'adapt',
                                externalID: course.id.toString(),
                                description: course.description,
                                adaptAssignments: []
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
        var adaptOps = [];
        assgnRes.forEach((axiosRes) => {
            if (axiosRes.data && axiosRes.data.type === 'success') {
                var courseID = String(axiosRes.request.responseURL).replace(assgnBaseURL, '');
                if (axiosRes.data.assignments && Array.isArray(axiosRes.data.assignments)) {
                    adaptCourses.forEach((course) => {
                        if (course.externalID === courseID) {
                            axiosRes.data.assignments.forEach((assgn) => {
                                var descrip = '';
                                if (assgn.description && !isEmptyString(assgn.description)) {
                                    descrip = assgn.description;
                                }
                                course.adaptAssignments.push({
                                    title: assgn.name,
                                    description: descrip
                                });
                            });
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
                            adaptAssignments: course.adaptAssignments
                        }
                    },
                    upsert: true
                }
            });
        });
        if (adaptCourses.length > 0) {
            return Homework.bulkWrite(adaptOps, {
                ordered: false
            });
        } else {
            return {};
        }
    }).then((adaptRes) => {
        var msg = '';
        if (Object.keys(adaptRes).length === 0) { // bulkWrite response
            msg = 'Succesfully synced ADAPT courses & assignments.';
            if (adaptRes.modifiedCount) {
                msg += ` ${adaptRes.modifiedCount} courses updated.`
            }
        } else { // skipped bulkWrite
            msg = 'No changes to sync.';
        }
        return res.send({
            err: false,
            msg: msg
        });
    }).catch((err) => {
        if (err.result) { // bulkWrite errors
            if (err.result.nInserted > 0) { // Some succeeded
                debugADAPTSync(`Inserted only ${err.results.nInserted} courses when ${adaptCourses.length} were expected.`);
                return res.send({
                    err: false,
                    msg: `Imported ${err.results.nInserted} courses and their assignments from ADAPT.`
                });
            } else {
                return res.send({
                    err: true,
                    errMsg: conductorErrors.err15
                });
            }
        } else if (err.message && err.message === 'adaptcommons') { // get request error
            return res.send({
                err: true,
                errMsg: conductorErrors.err14
            });
        } else { // other errors
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};

module.exports = {
    syncADAPTCommons
}
