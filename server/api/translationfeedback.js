//
// LibreTexts Conductor
// translationfeedback.js
//

'use strict';
const TranslationFeedback = require('../models/translationfeedback.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { isEmptyString } = require('../util/helpers.js');
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
    }
};

module.exports = {
    submitFeedback,
    validate
};
