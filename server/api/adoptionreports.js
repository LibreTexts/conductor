//
// LibreTexts Conductor
// adoptionreports.js
//

'use strict';
const AdoptionReport = require('../models/adoptionreport.js');
const { body } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
const { debugError } = require('../debug.js');

/**
 * Creates and saves a new AdoptionReport model with
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
                msg: "Adoption report succesfully submitted."
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
 * Confirm the @role parameter is one of 'instructor' or 'student'
 */
const validateRole = (value) => {
    if ((value === 'instructor') || (value === 'student')) {
        return true;
    }
    return false;
};

/**
 * Confirm the @resource parameter is an object and contains the
 * id, title, and library fields
 */
const validateResourceObj = (value) => {
    if (typeof(value) === 'object') {
        if (value.hasOwnProperty('id') && value.hasOwnProperty('title') && value.hasOwnProperty('library')) {
            if (!isEmptyString(value.id) && !isEmptyString(value.title) && !isEmptyString(value.library)) {
                return true;
            }
        }
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
                body('resource', conductorErrors.err1).exists().isObject().custom(validateResourceObj),
                body('instructor', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateInstructorObj),
                body('student', conductorErrors.err1).optional({ checkFalsy: true }).isObject().custom(validateStudentObj)
            ]
    }
};

module.exports = {
    submitReport,
    validate
};
