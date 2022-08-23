//
// LibreTexts Conductor
// adoptionreports.js
//

'use strict';
import { body, query } from 'express-validator';
import AdoptionReport from '../models/adoptionreport.js';
import conductorErrors from '../conductor-errors.js';
import { isEmptyString } from '../util/helpers.js';
import { debugError } from '../debug.js';
import { threePartDateStringValidator } from '../validators.js';

/**
 * Creates and saves a new AdoptionReport with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'submitReport'
 */
const submitReport = (req, res) => {
    var newReport = new AdoptionReport(req.body);
    newReport.save().then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "Adoption report successfully submitted."
            });
        } else {
            throw(conductorErrors.err3);
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Returns AdoptionReports within a given date range.
 * VALIDATION: 'getReports'
 */
const getReports = (req, res) => {
    try {
        var sComp = String(req.query.startDate).split('-');
        var eComp = String(req.query.endDate).split('-');
        var sM, sD, sY;
        var eM, eD, eY;
        if ((sComp.length == 3) && (eComp.length == 3)) {
            sM = parseInt(sComp[0]) - 1;
            sD = parseInt(sComp[1]);
            sY = parseInt(sComp[2]);
            eM = parseInt(eComp[0]) - 1;
            eD = parseInt(eComp[1]);
            eY = parseInt(eComp[2]);
        }
        if (!isNaN(sM) && !isNaN(sD) && !isNaN(sY) && !isNaN(eM) && !isNaN(eD) && !isNaN(eY)) {
            var start = new Date(sY, sM, sD);
            start.setHours(0,0,0,0);
            var end = new Date(eY, eM, eD);
            end.setHours(23,59,59,999);
            AdoptionReport.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: start,
                            $lte: end
                        }
                    }
                }, {
                    $project: {
                      _v: 0,
                    }
                }, {
                    $sort: {
                        createdAt: 1
                    }
                }
            ]).then((reports) => {
                return res.status(200).send({
                    err: false,
                    reports: reports
                });
            }).catch((err) => {
                debugError(err);
                return res.status(500).send({
                    err: true,
                    errMsg: conductorErrors.err6
                });
            });
        } else {
            throw('timeparse-err')
        }
    } catch (err) {
        debugError(err);
        return res.status(400).send({
            err: true,
            errMsg: emmErrors.err3
        });
    }
};

/**
 * Deletes the AdoptionReport identified by
 * the reportID in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteReport'
 */
const deleteReport = (req, res) => {
    AdoptionReport.deleteOne({ _id: req.body.reportID }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: "Adoption Report successfully deleted.",
            });
        } else {
            throw(conductorErrors.err3);
        }
    }).catch((err) => {
        debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6
        });
    })
};

/**
 * Confirm the @role parameter is one of 'instructor' or 'student'
 */
const validateRole = (value) => {
    if ((value === 'instructor') || (value === 'student')) {
        return true;
    }
    return false;
};


/**
 * Confirm the @instructor parameter is an object and that each field,
 * if it exists, is the expected type.
 * NOTE: this function parses the @instructor.students, @instructor.replaceCost,
 *  and @instructor.printCost to the expected Number type.
 */
const validateInstructorObj = (value) => {
    if (typeof(value) === 'object') {
        if (value.hasOwnProperty('isLibreNet') && typeof(value.isLibreNet) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('institution') && typeof(value.institution) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('class') && typeof(value.class) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('term') && typeof(value.term) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('students')) {
            if (!isEmptyString(value.students)) {
                const parsed = parseInt(value.students);
                if (!isNaN(parsed)) {
                    value.students = parsed;
                } else {
                    return false;
                }
            } else {
                delete value.students;
            }
        }
        if (value.hasOwnProperty('replaceCost')) {
            if (!isEmptyString(value.students)) {
                const parsed = parseInt(value.replaceCost);
                if (!isNaN(parsed)) {
                    value.replaceCost = parsed;
                } else {
                    return false;
                }
            } else {
                delete value.replaceCost;
            }
        }
        if (value.hasOwnProperty('printCost')) {
            if (!isEmptyString(value.students)) {
                const parsed = parseInt(value.printCost);
                if (!isNaN(parsed)) {
                    value.printCost = parsed;
                } else {
                    return false;
                }
            } else {
                delete value.printCost;
            }
        }
        if (value.hasOwnProperty('access') && !Array.isArray(value.access)) {
            return false;
        }
        return true;
    }
    return false;
};

/**
 * Confirm the @student parameter is an object and that each field,
 * if it exists, is the expected type.
 * NOTE: this function parses the @student.quality, @student.navigation,
 *  and @student.printCost to the expected Number type.
 */
const validateStudentObj = (value) => {
    if (typeof(value) === 'object') {
        if (value.hasOwnProperty('use') && typeof(value.use) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('institution') && typeof(value.institution) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('class') && typeof(value.class) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('instructor') && typeof(value.instructor) !== 'string') {
            return false;
        }
        if (value.hasOwnProperty('quality')) {
            const parsed = parseInt(value.quality);
            if (!isNaN(parsed)) {
                value.quality = parsed;
            } else {
                return false;
            }
        }
        if (value.hasOwnProperty('navigation')) {
            const parsed = parseInt(value.navigation);
            if (!isNaN(parsed)) {
                value.navigation = parsed;
            } else {
                return false;
            }
        }
        if (value.hasOwnProperty('printCost')) {
            const parsed = parseInt(value.printCost);
            if (!isNaN(parsed)) {
                value.printCost = parsed;
            } else {
                return false;
            }
        }
        if (value.hasOwnProperty('access') && !Array.isArray(value.access)) {
            return false;
        }
        return true;
    }
    return false;
};

/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
    switch (method) {
        case 'submitReport':
            return [
                body('email', conductorErrors.err1).exists().isEmail(),
                body('name', conductorErrors.err1).exists().isLength({ min: 1 }),
                body('role', conductorErrors.err1).exists().custom(validateRole),
                body('resource', conductorErrors.err1).exists().isObject(),
                body('instructor', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateInstructorObj),
                body('student', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateStudentObj)
            ]
        case 'getReports':
            return [
                query('startDate', conductorErrors.err1).exists().custom(threePartDateStringValidator),
                query('endDate', conductorErrors.err1).exists().custom(threePartDateStringValidator)
            ]
        case 'deleteReport':
            return [
                body('reportID', conductorErrors.err1).exists().isMongoId()
            ]
    }
};

export default {
    submitReport,
    getReports,
    deleteReport,
    validate
}