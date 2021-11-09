//
// LibreTexts Conductor
// translationfeedback.js
//

'use strict';
const TranslationFeedback = require('../models/translationfeedback.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const {
    isEmptyString,
    threePartDateStringToDate
} = require('../util/helpers.js');
const { threePartDateStringValidator } = require('../validators.js');
const { debugError } = require('../debug.js');

/**
 * Creates and saves a new TranslationFeedback with
 * the data in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'submitFeedback'
 */
const submitFeedback = (req, res) => {
    let newFeedbackData = {
        language: req.body.language,
        accurate: req.body.accurate,
        page: req.body.page,
        feedback: []
    };
    if (req.body.hasOwnProperty('feedback') && req.body.accurate === false) {
        // data should already be sanitized
        newFeedbackData.feedback = req.body.feedback
    };
    let newFeedback = new TranslationFeedback(newFeedbackData);
    newFeedback.save().then((newDoc) => {
        if (newDoc) {
            return res.send({
                err: false,
                msg: "Translation feedback successfully submitted."
            });
        } else {
            throw('createfail');
        }
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'createfail') errMsg = conductorErrors.err3;
        else debugError(err);
        return res.status(500).send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Retrieves and formats TranslationFeedback records within the date range
 * specified in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain. This method is only available on
 *  the LibreCommons server.
 * VALIDATION: 'exportFeedback'
 */
const exportFeedback = (req, res) => {
    if (req.query.startDate === null) {
        req.query.startDate = new Date(2021, 0, 1);
    }
    if (req.query.endDate === null) {
        req.query.endDate = new Date(2050, 11, 31);
    }
    req.query.startDate.setHours(0,0,0,0);
    req.query.endDate.setHours(23,59,59,999);
    TranslationFeedback.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: req.query.startDate,
                    $lte: req.query.endDate,
                }
            }
        }, {
            $sort: {
                createdAt: 1
            }
        }, {
            $project: {
                _id: 0,
                __v: 0,
                updatedAt: 0,
                'feedback._id': 0
            }
        }
    ]).then((records) => {
        let startDateString = `${req.query.startDate.getMonth() + 1}-${req.query.startDate.getDate()}-${req.query.startDate.getFullYear()}`;
        let endDateString = `${req.query.endDate.getMonth() + 1}-${req.query.endDate.getDate()}-${req.query.endDate.getFullYear()}`;
        let fileName = `translationfeedback_${startDateString}_${endDateString}`;
        let fileBuff;
        if (req.query.format === 'json') {
            fileName += '.json';
            let jsonOutput = {
                submissions: records
            };
            fileBuff = Buffer.from(JSON.stringify(jsonOutput));
        } else {
            fileName += '.csv';
            let csvString = 'language,accurate,page,date,feedback_1,feedback_1_corrected,feedback_2,feedback_2_corrected,feedback_3,feedback_3_corrected,feedback_4,feedback_4_corrected\n';
            records.forEach((item) => {
                let itemDate = new Date(item.createdAt);
                let newCSVString = `${item.language},${item.accurate},${item.page},${itemDate.toUTCString().replace(',', '')},`;
                for (let idx = 0; idx < 4; idx++) {
                    if (typeof(item.feedback[idx]) !== 'undefined') {
                        if (item.feedback[idx].incorrect) {
                            newCSVString += `${item.feedback[idx].incorrect},`;
                        } else {
                            newCSVString += `null,`;
                        }
                        if (item.feedback[idx].corrected) {
                            newCSVString += `${item.feedback[idx].corrected},`;
                        } else {
                            newCSVString += 'null,';
                        }
                    }
                }
                // remove trailing commas
                if (newCSVString.endsWith(',')) {
                    newCSVString = newCSVString.substring(0, newCSVString.length-1);
                }
                newCSVString += '\n';
                csvString += newCSVString;
            });
            fileBuff = Buffer.from(csvString, 'utf8');
        }
        res.attachment(fileName);
        return res.send(fileBuff);
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        return res.status(500).send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Sanitizes an array of incorrect translated terms and their (optional)
 * corrections to remove extraneous information.
 * @param {Object[]} feedback  - the array of feedback objects to sanitize
 * @returns {Object[]} the sanitized array of feedback objects
 */
const sanitizeFeedbackArray = (feedback) => {
    if (Array.isArray(feedback)) {
        return feedback.map((item) => {
            let sanitized = {
                incorrect: '',
                corrected: ''
            };
            if (item.hasOwnProperty('incorrect') && typeof(item.incorrect) === 'string') {
                sanitized.incorrect = item.incorrect;
            }
            if (item.hasOwnProperty('corrected') && typeof(item.corrected) === 'string') {
                sanitized.corrected = item.corrected;
            }
            return sanitized;
        });
    }
    return [];
};


/**
 * Validates a requested format string for Translation Feedback Export.
 * @param {String} format  - the string to validate
 * @returns {Boolean} true if valid, false otherwise
 */
const validateExportFormat = (format) => {
    return ['json', 'csv'].includes(format);
};


/**
 * Sets up the validation chain(s) for methods in this file.
 */
const validate = (method) => {
    switch (method) {
        case 'submitFeedback':
            return [
                body('language', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 100 }),
                body('accurate', conductorErrors.err1).exists().isBoolean(),
                body('page', conductorErrors.err1).exists().isString().isURL(),
                body('feedback', conductorErrors.err1).optional({ checkFalsy: true }).isArray().customSanitizer(sanitizeFeedbackArray)
            ]
        case 'exportFeedback':
            return [
                query('startDate', conductorErrors.err1).exists().isString().custom(threePartDateStringValidator).customSanitizer(threePartDateStringToDate),
                query('endDate', conductorErrors.err1).exists().isString().custom(threePartDateStringValidator).customSanitizer(threePartDateStringToDate),
                query('format', conductorErrors.err1).exists().custom(validateExportFormat)
            ]
    }
};

module.exports = {
    submitFeedback,
    exportFeedback,
    validate
};
