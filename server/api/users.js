//
// LibreTexts Conductor
// user.js

'use strict';
const User = require('../models/user.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const authAPI = require('./auth.js');


/**
 * Return basic profile information about
 * the current user.
 */
const basicUserInfo = (req, res) => {
    User.findOne({
        uuid: req.decoded.uuid
    }, {
        _id: 0,
        uuid: 1,
        firstName: 1,
        lastName: 1,
        roles: 1,
        avatar: 1
    }).lean().then((user) => {
        if (user) {
            return res.send({
                err: false,
                user: user
            });
        } else {
            return res.send({
                err: true,
                errMsg: conductorErrors.err7
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
 * Get non-sensitive account information
 * about the current user.
 */
const basicAccountInfo = (req, res) => {
    User.aggregate([
        {
            $match: {
                uuid: req.decoded.uuid
            }
        }, {
            $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                avatar: 1,
                roles: 1,
                authType: 1,
                createdAt: 1
            }
        }, {
            $lookup: {
                from: 'organizations',
                let: {
                    orgs: "$roles.org"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$orgID', '$$orgs']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            orgID: 1,
                            shortName: 1,
                            name: 1
                        }
                    }
                ],
                as: 'roleOrgs'
            }
        }
    ]).then((userRes) => {
        if (userRes.length > 0) {
            const user = userRes[0];
            var account = {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                roles: user.roles,
                avatar: user.avatar,
                roles: []
            }
            account.createdAt = user._id.getTimestamp();
            if (user.authType !== null) {
                if (user.authType === 'traditional') account.authMethod = 'Traditional';
                else if (user.authType === 'sso') account.authMethod = 'SSO';
            } else {
                account.authMethod = 'Traditional';
            }
            if (user.roleOrgs && Array.isArray(user.roleOrgs)) {
                user.roleOrgs.forEach((roleOrg) => {
                    var foundRole = user.roles.find((role) => {
                        return role.org === roleOrg.orgID;
                    });
                    if (foundRole !== undefined) {
                        var roleName = 'Unknown Role';
                        if (foundRole.role === 'superadmin') roleName = 'Super Administrator';
                        else if (foundRole.role === 'campusadmin') roleName = 'Campus Administrator';
                        else if (foundRole.role === 'member') roleName = 'Member';
                        account.roles.push({
                            org: roleOrg,
                            role: roleName
                        });
                    }
                });
            }
            return res.send({
                err: false,
                account: account
            });
        } else {
            return res.send({
                err: true,
                errMsg: conductorErrors.err7
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
 * Update the user's name given
 * the @firstName and @lastName in the
 * request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'editUserName'
 */
const editUserName = (req, res) => {
    User.findOneAndUpdate({ uuid: req.decoded.uuid }, {
        firstName: req.body.firstName,
        lastName: req.body.lastName
    }).then((updateRes) => {
        if (updateRes) {
            return res.send({
                err: false,
                msg: "Updated user's name successfully."
            });
        } else {
            throw(new Error('updatefailed'));
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
 * Update the user's name email given
 * the @email in the request body.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'updateUserEmail'
 */
const updateUserEmail = (req, res) => {
    User.findOneAndUpdate({ uuid: req.decoded.uuid }, {
        email: req.body.email,
    }).then((updateRes) => {
        if (updateRes) {
            return res.send({
                err: false,
                msg: "Updated user's email successfully."
            });
        } else {
            throw(new Error('updatefailed'));
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
 * Returns a list of simple information
 * about all Users in the database.
 * Method should be restricted to users
 * with elevated privileges.
 */
const getUsersList = (_req, res) => {
    User.aggregate([
        {
            $match: {}
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                authType: 1
            }
        }
    ]).then((users) => {
        users = users.map((user) => {
            if (user.authType !== null) {
                if (user.authType === 'traditional') user.authMethod = 'Traditional';
                else if (user.authType === 'sso') user.authMethod = 'SSO';
            } else {
                user.authMethod = 'Traditional';
            }
            delete user.authType;
            return user;
        });
        return res.send({
            err: false,
            users: users
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
 * Returns a list of simple information about all Users in the database.
 * @param {Object} req - the route request object
 * @param {Object} res - the route response object
 */
const getBasicUsersList = (_req, res) => {
    User.aggregate([
        {
            $match: {}
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
                avatar: 1
            }
        }, {
            $sort: {
                firstName: -1
            }
        }
    ]).then((users) => {
        return res.send({
            err: false,
            users: users
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
 * Deletes the User identified by
 * the @uuid in the request body.
 * Method should be restricted to
 * users with elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteUser'
 */
const deleteUser = (req, res) => {
    User.deleteOne({
        uuid: req.body.uuid
    }).then((deleteRes) => {
        if (deleteRes.deletedCount === 1) {
            return res.send({
                err: false,
                msg: "Successfully deleted user."
            });
        } else {
            throw(new Error('deletefailed'));
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
 * Returns the roles held by the User
 * identified by the @uuid in the request
 * body. If the requesting user is a Campus Admin,
 * only the role object relevant to the Campus is
 * returned. Method should be restricted to
 * users with elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'deleteUser'
 */
const getUserRoles = (req, res) => {
    var isSuperAdmin = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
    User.aggregate([
        {
            $match: {
                uuid: req.query.uuid
            }
        }, {
            $project: {
                uuid: 1,
                roles: 1
            }
        }, {
            $lookup: {
                from: 'organizations',
                let: {
                    orgs: "$roles.org"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$orgID', '$$orgs']
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            orgID: 1,
                            shortName: 1,
                            name: 1
                        }
                    }
                ],
                as: 'roleOrgs'
            }
        }
    ]).then((users) => {
        if (users.length > 0) {
            var user = users[0];
            var userData = {
                uuid: users[0].uuid,
                roles: []
            };
            if (user.roleOrgs && Array.isArray(user.roleOrgs)) {
                user.roleOrgs.forEach((roleOrg) => {
                    var foundRole = user.roles.find((role) => {
                        return role.org === roleOrg.orgID;
                    });
                    if (foundRole !== undefined) {
                        var roleName = 'Unknown Role';
                        if (foundRole.role === 'superadmin') roleName = 'Super Administrator';
                        else if (foundRole.role === 'campusadmin') roleName = 'Campus Administrator';
                        else if (foundRole.role === 'member') roleName = 'Member';
                        if (isSuperAdmin || (!isSuperAdmin && foundRole.org === process.env.ORG_ID)) {
                            userData.roles.push({
                                org: roleOrg,
                                role: foundRole.role,
                                roleText: roleName
                            });
                        }
                    }
                });
            }
            return res.send({
                err: false,
                user: userData
            });
        } else {
            throw(new Error('notfound'));
        }
    }).catch((err) => {
        if (err.message === 'notfound') {
            return res.send({
                err: true,
                errMsg: conductorErrors.err7
            });
        } else {
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};


/**
 * Updates the User identified by the @uuid
 * in the request body with the new role
 * specified by the @role for the Organization
 * specified by the @orgID. Method should be
 * restricted to users with elevated privileges.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'updateUserRole'
 */
const updateUserRole = (req, res) => {
    var isSuperAdmin = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
    if (!isSuperAdmin && (req.body.orgID !== process.env.ORG_ID)) {
        // Halt execution if Campus Admin is trying to assign a role for a different Organization
        return res.send({
            err: true,
            errMsg: conductorErrors.err8
        });
    }
    if (req.body.role === 'superadmin' && (req.body.orgID !== 'libretexts' || !isSuperAdmin)) {
        // Halt execution if user is trying to elevate non-LibreTexts role to Super Admin,
        // or if the requesting is not a Super Admin themselves
        return res.send({
            err: true,
            errMsg: conductorErrors.err2
        });
    }
    User.findOne({
        uuid: req.body.uuid
    }).then((user) => {
        if (user) {
            var newRoles = [];
            var reqRole = {
                org: req.body.orgID,
                role: req.body.role
            };
            if (user.roles && Array.isArray(user.roles)) {
                // Remove the current role for the orgID if present
                newRoles = user.roles.filter((item) => item.org !== req.body.orgID);
                newRoles.push(reqRole);
            } else {
                // Init roles with new requested role
                newRoles.push(reqRole);
            }
            return User.updateOne({ uuid: req.body.uuid }, {
                roles: newRoles
            });
        } else {
            throw(new Error('notfound'));
        }
    }).then((updateRes) => {
        if ((updateRes.matchedCount === 1) && (updateRes.modifiedCount === 1)) {
            return res.send({
                err: false,
                msg: "Successfully updated the user's roles."
            });
        } else {
            throw(new Error('updatefailed'));
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
 * Accepts a string, @role, and validates
 * it against standard Conductor roles.
 * Returns a boolean:
 *  TRUE:  Role is valid.
 *  FALSE: Role is invalid.
 */
const roleValidator = (role) => {
    if ((role === 'member') || (role === 'campusadmin') || (role === 'superadmin')) {
        return true;
    }
    return false;
}


/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method) => {
    switch (method) {
        case 'editUserName':
            return [
                body('firstName', conductorErrors.err1).exists().isLength({ min: 2, max: 100 }),
                body('lastName', conductorErrors.err1).exists().isLength({ min: 1, max: 100})
            ]
        case 'updateUserEmail':
            return [
                body('email', conductorErrors.err1).exists().isEmail()
            ]
        case 'deleteUser':
            return [
                body('uuid', conductorErrors.err1).exists().isString().isUUID()
            ]
        case 'getUserRoles':
            return [
                query('uuid', conductorErrors.err1).exists().isString().isUUID()
            ]
        case 'updateUserRole':
            return [
                body('uuid', conductorErrors.err1).exists().isString().isUUID(),
                body('orgID', conductorErrors.err1).exists().isString().isLength({ min: 2, max: 50 }),
                body('role', conductorErrors.err1).exists().isString().custom(roleValidator)
            ]
    }
}

module.exports = {
    basicUserInfo,
    basicAccountInfo,
    editUserName,
    updateUserEmail,
    getUsersList,
    getBasicUsersList,
    deleteUser,
    getUserRoles,
    updateUserRole,
    validate
};
