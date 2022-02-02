/**
 * LibreTexts Conductor
 * peerreviewutils.js
 * @file Exposes helper functions and objects for Conductor Peer Review features. 
 */

const peerReviewPromptTypes = ['3-likert', '5-likert', '7-likert', 'text', 'dropdown', 'checkbox'];

const peerReviewAuthorTypes = ['student', 'instructor'];


/**
 * Builds a MongoDB Aggregation pipeline for a Project's Peer Reviews.
 * @param {String} identifier - A ProjectID or PeerReviewID to query on. PeerReviewID requires 'review' set to true.
 * @param {String} [review=false] - Specifies that the identifier provided is for a single peer Review.
 * @returns {Object[]|Error} The compiled aggregation pipeline, or an error if an identifier is unspecified.
 */
const buildPeerReviewAggregation = (identifier, review = false) => {
    let matchObj = {};
    if (typeof(identifier) === 'string' && identifier.length > 0) {
        if (review) { // peerReviewID
            matchObj = {
                $match: {
                    peerReviewID: identifier
                }
            };
        } else { // projectID
            matchObj = {
                $match: {
                    projectID: identifier
                }
            };
        }
    }
    if (Object.keys(matchObj).length > 0) {
        return [matchObj, {
                $lookup: {
                    from: 'users',
                    let: {
                        author: '$author',
                        anonAuthor: '$anonAuthor'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [{
                                        $eq: ['$$anonAuthor', false]
                                    }, {
                                        $eq: ['$uuid', '$$author']
                                    }]
                                }
                            }
                        }, {
                            $project: {
                                firstName: 1,
                                lastName: 1
                            }
                        }
                    ],
                    as: 'authorInfo'
                }
            }, {
                $addFields: {
                    authorInfo: {
                        $arrayElemAt: ['$authorInfo', 0]
                    }
                }
            }, {
                $addFields: {
                    author: {
                        $cond: {
                            if: {
                                $eq: ['$anonAuthor', false]
                            },
                            then: {
                                $concat: ['$authorInfo.firstName', ' ', '$authorInfo.lastName']
                            },
                            else: '$author'
                        }
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    __v: 0,
                    authorEmail: 0,
                    authorInfo: 0
                }
            }
        ];
    }
    throw ('reviewidentifier');
};


/**
 * Calculates an average rating (out of 5) given all applicable Peer Reviews.
 * @param {Object[]} peerReviews - An array of applicable Peer Review objects.
 * @returns {Number|null} The average rating or null if an error was encountered.
 */
const calculateAveragePeerReviewRating = (peerReviews) => {
    if (Array.isArray(peerReviews) && peerReviews.length > 0) {
        let ratingsCount = 0;
        let totalRating = 0;
        let averageRating = 0;
        peerReviews.forEach((review) => {
            if (typeof(review.rating) === 'number') {
                totalRating += review.rating;
                ratingsCount++;
            }
        });
        if (ratingsCount > 0) {
            // round to nearest half
            averageRating = Math.round((totalRating / ratingsCount) * 2) / 2;
            if (!isNaN(averageRating)) return averageRating;
        }
    }
    return null;
};


/**
 * Validates that a given Peer Review Prompt type is one of the
 * pre-defined, acceptable prompt types.
 * @param {String} promptType - The Prompt type identifier to validate.
 * @returns {Boolean} True if valid type, false otherwise.
 */
const validatePeerReviewPromptType = (promptType) => {
    return peerReviewPromptTypes.includes(promptType);
};


/**
 * Validates that a given Peer Review Author type is one of the
 * pre-defined, acceptable author types.
 * @param {String} authorType - The author type identifier to validate.
 * @returns {Boolean} True if valid type, false otherwise.
 */
const validatePeerReviewAuthorType = (authorType) => {
    return peerReviewAuthorTypes.includes(authorType);
};


module.exports = {
    peerReviewPromptTypes,
    peerReviewAuthorTypes,
    buildPeerReviewAggregation,
    calculateAveragePeerReviewRating,
    validatePeerReviewPromptType,
    validatePeerReviewAuthorType,
}
