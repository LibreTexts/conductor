//
// LibreTexts Conductor
// user.js

'use strict';
const User = require('../models/user.js');
const { body } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');


/**
 * Return basic profile information about
 * the current user.
 */
const basicUserInfo = (req, res) => {
    User.findOne({
        uuid: req.decoded.uuid
    }, {
        _id: 0,
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


const addRoleToUser = (req, res) => {
    User.updateOne({
        uuid: req.body.uuid
    }, {
        $addToSet: {
            roles: {
                org: req.body.orgID,
                role: req.body.role
            }
        }
    }).then((updateRes) => {
        if ((updateRes.n === 1) && (updateRes.ok === 1)) {
            return res.send({
                err: false,
                msg: "Successfully gave user the requested role."
            });
        } else if (updateRes.n === 0) {
            throw(new Error('notfound'));
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

const removeRoleFromUser = (req, res) => {
    User.updateOne({
        uuid: req.body.uuid
    }, {
        $pull: {
            roles: {
                org: req.body.orgID,
                role: req.body.role
            }
        }
    }).then((updateRes) => {
        if ((updateRes.n === 1) && (updateRes.ok === 1)) {
            return res.send({
                err: false,
                msg: "Successfully removed the requested role from user."
            });
        } else if (updateRes.n === 0) {
            throw(new Error('notfound'));
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
    }
}

module.exports = {
    basicUserInfo,
    basicAccountInfo,
    editUserName,
    updateUserEmail,
    getUsersList,
    deleteUser,
    addRoleToUser,
    removeRoleFromUser,
    validate
};
