//
// LibreTexts Conductor
// search.js
//

'use strict';
import Promise from 'bluebird';
import { query } from 'express-validator';
import User from '../models/user.js';
import Project from '../models/project.js';
import Book from '../models/book.js';
import Homework from '../models/homework.js';
import conductorErrors from '../conductor-errors.js';
import { debugError } from '../debug.js';
import { isValidDateObject } from '../util/helpers.js';
import projectAPI from './projects.js';

const projectSortOptions = ['title', 'progress', 'classification', 'visibility', 'lead', 'updated'];
const bookSortOptions = ['title', 'author', 'library', 'subject', 'affiliation'];
const homeworkSortOptions = ['name', 'description'];
const userSortOptions = ['first', 'last'];


/**
 * Performs a global search across multiple Conductor resource types (e.g. Projects, Books, etc.)
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const performSearch = (req, res) => {
    const query = req.query.searchQuery;
    const queryRegex = {
        $regex: query,
        $options: 'i'
    };
    const projSortOption = req.query?.projSort || 'title';
    const bookSortOption = req.query?.bookSort || 'title';
    const homeworkSortOption = req.query?.hwSort || 'name';
    const userSortOption =  req.query?.userSort || 'first';
    let aggregations = [];
    let projectFilters = [];
    let projectFiltersOptions = {};

    /* Project Location Filter, only needed if 'local' */
    if (typeof (req.query.projLocation) === 'string' && req.query.projLocation === 'local') {
        projectFilters.push({ orgID: process.env.ORG_ID });
    }
    /* Project Status Filter, only needed if not 'any' */
    if (typeof (req.query.projStatus) === 'string' && projectAPI.projectStatusOptions.includes(req.query.projStatus)) {
        projectFilters.push({ status: req.query.projStatus });
    }
    /* Project Visibility Filter, only needed if not 'any' */
    const teamMemberQuery = projectAPI.constructProjectTeamMemberQuery(req.decoded.uuid);
    const privateProjectQuery = {
        $and: [
            { visibility: 'private' },
            { $or: teamMemberQuery }
        ]
    };
    const publicProjectQuery = { visibility: 'public' };
    // PUBLIC OR (PRIVATE AND [TEAM] INCLUDES USER)
    const anyVisibilityQuery = {
        $or: [
            publicProjectQuery,
            privateProjectQuery
        ]
    };
    if (typeof (req.query.projVisibility) === 'string') {
        if (req.query.projVisibility === 'public') {
            projectFilters.push(publicProjectQuery);
        } else if (req.query.projVisibility === 'private') {
            projectFilters.push(privateProjectQuery);
        } else {
            projectFilters.push(anyVisibilityQuery);
        }
    } else {
        projectFilters.push(anyVisibilityQuery);
    }
    if (projectFilters.length > 1) {
        projectFiltersOptions = { $and: projectFilters };
    } else {
        projectFiltersOptions = { ...projectFilters[0] };
    }
    const projectMatchOptions = {
        $and: [
            {
                $or: [
                    { title: queryRegex },
                    { author: queryRegex },
                    { libreLibrary: queryRegex }, 
                    { libreCoverID: queryRegex },
                    { libreShelf: queryRegex },
                    { libreCampus: queryRegex },
                ]
            }, {
                ...projectFiltersOptions
            }
        ]
    };
    aggregations.push(Project.aggregate([
        {
            $match: projectMatchOptions
        }, {
            $lookup: {
                from: 'users',
                let: {
                    leads: '$leads'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$uuid', '$$leads']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            uuid: 1,
                            firstName: 1,
                            lastName: 1,
                            avatar: 1
                        }
                    }
                ],
                as: 'leads'
            }
        }, {
            $project: {
                _id: 0,
                orgID: 1,
                projectID: 1,
                title: 1,
                status: 1,
                visibility: 1,
                currentProgress: 1,
                peerProgress: 1,
                a11yProgress: 1,
                classification: 1,
                leads: 1,
                updatedAt: 1
            }
        }
    ]));
    aggregations.push(Book.aggregate([
        {
            $match: {
                $or: [
                    { title: queryRegex },
                    { author: queryRegex },
                    { affiliation: queryRegex },
                    { library: queryRegex },
                    { subject: queryRegex },
                    { course: queryRegex },
                    { program: queryRegex },
                    { summary: queryRegex },
                ]
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
                $or: [
                    { title: queryRegex },
                    { kind: queryRegex },
                    { description: queryRegex }
                ]
            }
        }, {
            $project: {
                _id: 0,
                __v: 0
            }
        }
    ]));
    aggregations.push(User.aggregate([
        {
            $match: {
                $or: [
                    { firstName: queryRegex },
                    { lastName: queryRegex }
                ]
            }
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
                avatar: 1
            }
        }
    ]));
    return Promise.all(aggregations).then((aggregateResults) => {
        let results = {
            projects: aggregateResults[0],
            books: aggregateResults[1],
            homework: aggregateResults[2],
            users: aggregateResults[3]
        };
        const resultsCount = results.projects.length + results.books.length + results.homework.length + results.users.length;
        results.projects.sort((a, b) => {
            let aData = null;
            let bData = null;
            if (projSortOption === 'title') {
                aData = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (projSortOption === 'classification') {
                aData = String(a.classification).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.classification).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (projSortOption === 'visibility') {
                aData = String(a.visibility).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.visibility).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (projSortOption === 'lead') {
                if (Array.isArray(a.leads) && a.leads.length > 0) {
                    aData = String(a.leads[0]?.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                } else {
                    aData = '';
                }
                if (Array.isArray(b.leads) && b.leads.length > 0) {
                    bData = String(b.leads[0]?.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                } else {
                    bData = '';
                }
            } else if (projSortOption === 'progress') {
                aData = a.currentProgress;
                bData = b.currentProgress;
            } else if (projSortOption === 'updated') {
                if (a.updatedAt) {
                    let aUpdated = new Date(a.updatedAt);
                    if (isValidDateObject(aUpdated)) aData = aUpdated;
                } else {
                    aData = 0;
                }
                if (b.updatedAt) {
                    let bUpdated = new Date(b.updatedAt);
                    if (isValidDateObject(bUpdated)) bData = bUpdated;
                } else {
                    aData = 0;
                }
            }
            if (aData !== null && bData !== null) {
                if (aData < bData) return -1;
                if (aData > bData) return 1;
            }
            return 0;
        });
        results.books.sort((a, b) => {
            let aData = null;
            let bData = null;
            if (bookSortOption === 'title') {
                aData = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (bookSortOption === 'author') {
                aData = String(a.author).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.author).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (bookSortOption === 'library') {
                aData = String(a.library).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.library).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (bookSortOption === 'subject') {
                aData = String(a.subject).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.subject).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (bookSortOption === 'affiliation') {
                aData = String(a.affiliation).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.affiliation).toLowerCase().replace(/[^A-Za-z]+/g, "");
            }
            if (aData !== null && bData !== null) {
                if (aData < bData) return -1;
                if (aData > bData) return 1;
            }
            return 0;
        });
        results.homework.sort((a, b) => {
            let aData = null;
            let bData = null;
            if (homeworkSortOption === 'name') {
                aData = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (homeworkSortOption === 'description') {
                aData = String(a.description).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.description).toLowerCase().replace(/[^A-Za-z]+/g, "");
            }
            if (aData !== null && bData !== null) {
                if (aData < bData) return -1;
                if (aData > bData) return 1;
            }
            return 0;
        });
        results.users.sort((a, b) => {
            let aData = null;
            let bData = null;
            if (userSortOption === 'first') {
                aData = String(a.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
            } else if (userSortOption === 'last') {
                aData = String(a.lastName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                bData = String(b.lastName).toLowerCase().replace(/[^A-Za-z]+/g, "");
            }
            if (aData !== null && bData !== null) {
                if (aData < bData) return -1;
                if (aData > bData) return 1;
            }
            return 0;
        });
        return res.send({
            err: false,
            numResults: resultsCount,
            results,
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
 * Validates a provided Project Location filter option.
 * @param {string} location - The search scope option selected.
 * @returns {boolean} True if valid selection, false otherwise.
 */
const validateProjectLocationFilter = (location) => {
    if (typeof (location) === 'string') {
        return ['global', 'local'].includes(location);
    }
    return false;
};

/**
 * Validates a provided Project Status filter option.
 * @param {string} status - The status filter option selected.
 * @returns {boolean} True if valid selection, false otherwise. 
 */
const validateProjectStatusFilter = (status) => {
    if (typeof (status) === 'string') {
        return ['any', ...projectAPI.projectStatusOptions].includes(status);
    }
    return false;
};

/**
 * Validates a provided Project Visibility filter option.
 * @param {string} visibility - The visibility filter option selected.
 * @returns {boolean} True if valid selection, false otherwise.
 */
const validateProjectVisibilityFilter = (visibility) => {
    if (typeof (visibility) === 'string') {
        return ['any', ...projectAPI.projectVisibilityOptions].includes(visibility);
    }
    return false;
};

/**
 * Validates a provided Project sort option.
 * @param {string} sort - The sort option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
const validateProjectSort = (sort) => {
    if (typeof (sort) === 'string') {
        return projectSortOptions.includes(sort);
    }
    return false;
};

/**
 * Validates a provided Book sort option.
 * @param {string} sort - The sort option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
 const validateBookSort = (sort) => {
    if (typeof (sort) === 'string') {
        return bookSortOptions.includes(sort);
    }
    return false;
};

/**
 * Validates a provided Homework sort option.
 * @param {string} sort - The sort option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
 const validateHomeworkSort = (sort) => {
    if (typeof (sort) === 'string') {
        return homeworkSortOptions.includes(sort);
    }
    return false;
};

/**
 * Validates a provided User sort option.
 * @param {string} sort - The sort option selected.
 * @returns {boolean} True if valid option, false otherwise.
 */
 const validateUserSort = (sort) => {
    if (typeof (sort) === 'string') {
        return userSortOptions.includes(sort);
    }
    return false;
};



/**
 * Middleware(s) to verify requests contain
 * necessary and/or valid fields.
 */
const validate = (method) => {
    switch (method) {
        case 'performSearch':
            return [
                query('searchQuery', conductorErrors.err1).exists().isString().isLength({ min: 1, max: 200 }),
                query('projLocation', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectLocationFilter),
                query('projStatus', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectStatusFilter),
                query('projVisibility', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectVisibilityFilter),
                query('projSort', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateProjectSort),
                query('bookSort', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateBookSort),
                query('hwSort', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateHomeworkSort),
                query('userSort', conductorErrors.err1).optional({ checkFalsy: true }).custom(validateUserSort),
            ]
    }
};

export default {
    performSearch,
    validate
}
