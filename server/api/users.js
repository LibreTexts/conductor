//
// LibreTexts Conductor
// users.js

'use strict';
const User = require('../models/user.js');
const { body, query } = require('express-validator');
const conductorErrors = require('../conductor-errors.js');
const { debugError, debugObject } = require('../debug.js');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const avatarStorage = multer.memoryStorage();

const authAPI = require('./auth.js');


/**
 * Returns a Multer handler to process and validate user avatar image uploads.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 * @param {function} next - The next middleware function to call.
 * @returns {function} The avatar upload handler.
 */
const avatarUploadHandler = (req, res, next) => {
    const avatarUploadConfig = multer({
        storage: avatarStorage,
        fileFilter: (_req, file, cb) => {
            const validFileTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (validFileTypes.includes(file.mimetype)) return cb(null, true);
            return cb(null, false);
        },
        limits: {
            files: 1,
            fileSize: 5242880
        }
    }).single('avatarFile');
    return avatarUploadConfig(req, res, (err) => {
        if (err) {
            let errMsg = conductorErrors.err53;
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                errMsg = conductorErrors.err54;
            }
            return res.send({
                err: true,
                errMsg: errMsg
            });
        }
        next();
    });
};


/**
 * Return basic profile information about the current user.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getBasicUserInfo = (req, res) => {
    User.findOne({
        uuid: req.decoded.uuid
    }, {
        _id: 0,
        uuid: 1,
        authType: 1,
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
        }
        throw(new Error('notfound'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err7;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Get non-sensitive account information about the current user.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getBasicAccountInfo = (req, res) => {
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
            let user = userRes[0];
            let account = {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar
            };
            account.createdAt = user._id.getTimestamp();
            if (user.authType === 'sso') {
                account.authMethod = 'sso';
            } else {
                account.authMethod = 'Traditional';
            }
            account.roles = processUserRoles(user.roleOrgs, user.roles);
            return res.send({
                err: false,
                account: account
            });
        }
        throw(new Error('notfound'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err7;
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};


/**
 * Update the user's name given the new details in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'editUserName'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const updateUserName = (req, res) => {
    User.findOneAndUpdate({ uuid: req.decoded.uuid }, {
        firstName: req.body.firstName,
        lastName: req.body.lastName
    }).then((updateRes) => {
        if (updateRes) {
            return res.send({
                err: false,
                msg: "Updated user's name successfully."
            });
        }
        throw(new Error('updatefailed'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'updatefailed') errMsg = conductorErrors.err3;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Update the user's email given the new details in the request body.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'updateUserEmail'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
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
        }
        throw(new Error('updatefailed'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'updatefailed') errMsg = conductorErrors.err3;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Uploads the user's new avatar to S3 and updates the User record, if necessary.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const updateUserAvatar = (req, res) => {
    let userUUID = null;
    let fileExtension = null;
    let fileKey = null;
    return User.findOne({ uuid: req.decoded.uuid }).lean().then((user) => {
        if (user && typeof (req.file) === 'object') {
            userUUID = user.uuid;
            fileExtension = req.file.mimetype?.split('/')[1];
            if (typeof (fileExtension) === 'string') {
                fileKey = `avatars/${userUUID}.${fileExtension}`;
                return sharp(req.file.buffer).resize({
                    width: 500,
                    height: 500
                }).toBuffer();
            } else {
                throw (new Error('filevalidate'));
            }
        } else {
            throw (new Error('nouser'));
        }
    }).then((processedImage) => {
        if (processedImage !== null) {
            const storageClient = new S3Client({
                credentials: {
                    accessKeyId: process.env.AWS_USERDATA_ACCESS_KEY,
                    secretAccessKey: process.env.AWS_USERDATA_SECRET_KEY
                },
                region: process.env.AWS_USERDATA_REGION,
            });
            const uploadCommand = new PutObjectCommand({
                Bucket: process.env.AWS_USERDATA_BUCKET,
                Key: fileKey,
                Body: processedImage
            });
            return storageClient.send(uploadCommand);
        } else {
            throw (new Error('imageprocess'));
        }
    }).then((uploadResponse) => {
        if (uploadResponse['$metadata']?.httpStatusCode === 200) {
            const avatarURL = `https://${process.env.AWS_USERDATA_DOMAIN}/${fileKey}`;
            return User.updateOne({ uuid: userUUID }, { avatar: avatarURL });
        } else {
            throw (new Error('imageupload'));
        }
    }).then((updateRes) => {
        if (updateRes.modifiedCount === 1) {
            return res.send({
                err: false,
                msg: 'Successfully updated avatar.'
            });
        } else {
            throw (new Error('updatefail'));
        }
    }).catch((err) => {
        debugError(err);
        let errMsg = conductorErrors.err6;
        if (err.message === 'nouser') errMsg = conductorErrors.err7;
        else if (err.message === 'filevalidate') errMsg = conductorErrors.err55;
        else if (err.message === 'imageprocess') errMsg = conductorErrors.err56;
        else if (err.message === 'imageupload') errMsg = conductorErrors.err57;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Returns a list of simple information about all Users in the database.
 * Method should be restricted to users with elevated privileges.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
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
        let processedUsers = users.map((user) => {
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
            users: processedUsers
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
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
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
 * Returns detailed information about the User account specified in the request query.
 * Method should be restricted to users with elevated privileges.
 * VALIDATION: 'getUserInfoAdmin'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getUserInfoAdmin = (req, res) => {
    User.aggregate([{
        $match: {
            uuid: req.query.uuid
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
    }]).then((users) => {
        if (users.length > 0) {
            let user = users[0];
            let account = {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar
            };
            account.createdAt = user._id.getTimestamp();
            if (user.authType === 'sso') {
                account.authMethod = 'SSO';
            } else {
                account.authMethod = 'Traditional';
            }
            account.roles = processUserRoles(user.roleOrgs, user.roles);
            return res.send({
                err: false,
                user: account
            });
        }
        throw(new Error('notfound'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err7;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Deletes the User identified in the request body.
 * Method should be restricted to users with elevated privileges.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteUser'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
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
        }
        throw(new Error('deletefailed'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'deletefailed') errMsg = conductorErrors.err3;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Returns the roles held by the User identified in the request body. If the requesting user is a Campus Admin,
 * only the role object relevant to the Campus is returned.
 * Method should be restricted to users with elevated privileges.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'deleteUser'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getUserRoles = (req, res) => {
    let isSuperAdmin = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
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
            let user = users[0];
            let userData = {
                uuid: users[0].uuid,
                roles: processUserRoles(user.roleOrgs, user.roles, true, isSuperAdmin)
            };
            return res.send({
                err: false,
                user: userData
            });
        }
        throw(new Error('notfound'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'notfound') errMsg = conductorErrors.err7;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Updates the User identified in the request body with the newly specified role for a given Organization.
 * Method should be restricted to users with elevated privileges.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'updateUserRole'
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const updateUserRole = (req, res) => {
    return new Promise((resolve, reject) => {
        let isSuperAdmin = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
        if (!isSuperAdmin && (req.body.orgID !== process.env.ORG_ID)) {
            // Halt execution if Campus Admin is trying to assign a role for a different Organization
            reject(new Error('unauth'));
        }
        if (req.body.role === 'superadmin' && (req.body.orgID !== 'libretexts' || !isSuperAdmin)) {
            // Halt execution if user is trying to elevate non-LibreTexts role to Super Admin,
            // or if the requesting is not a Super Admin themselves
            reject(new Error('invalid'));
        }
        resolve(User.findOne({ uuid: req.body.uuid }).lean())
    }).then((user) => {
        if (user) {
            let newRoles = [];
            let reqRole = {
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
        }
        throw(new Error('notfound'));
    }).then((updateRes) => {
        if ((updateRes.matchedCount === 1) && (updateRes.modifiedCount === 1)) {
            return res.send({
                err: false,
                msg: "Successfully updated the user's roles."
            });
        }
        throw(new Error('updatefail'));
    }).catch((err) => {
        let errMsg = conductorErrors.err6;
        if (err.message === 'unauth') errMsg = conductorErrors.err8;
        else if (err.message === 'invalid') errMsg = conductorErrors.err2;
        else if (err.message === 'notfound') errMsg = conductorErrors.err7;
        else if (err.message === 'updatefail') errMsg = conductorErrors.err3;
        debugError(err);
        return res.send({
            err: true,
            errMsg: errMsg
        });
    });
};


/**
 * Returns an array of strings containing the email addresses of the requested users.
 * INTERNAL USE ONLY.
 * @param {string[]} users - An array of UUIDs to lookup users by.
 * @returns {Promise<string[]|Error>} The array of email addresses.
 */
const getUserEmails = (users) => {
    return new Promise((resolve, reject) => {
        if (users !== null && Array.isArray(users)) {
            if (users.length > 0) {
                resolve(User.aggregate([
                    {
                        $match: {
                            uuid: {
                                $in: users
                            }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            email: 1
                        }
                    }
                ]));
            }
            resolve([]);
        }
        reject('Argument has invalid type.')
    }).then((usersData) => {
        let userEmails = [];
        if (Array.isArray(usersData) && usersData.length > 0) {
            userEmails = usersData.map((item) => {
                if (item.hasOwnProperty('email')) return item.email;
                else return null;
            }).filter(item => item !== null);
        }
        return userEmails;
    });
};


/**
 * Transforms arrays of Organization information and a User's roles into a single array of the
 * Organization info and their UI-ready role name in each.
 * @param {Object[]} orgs - An array of the Organizations a User has an active role in.
 * @param {Object[]} roles - An array of the User's roles and memberships.
 * @param {Boolean} [safetyCheck=false] - Whether to restrict information to the User's membership in the current instance only.
 * @param {Boolean} [isSuperAdmin=false] - If the user is a Super Administrator.
 * @returns {Object[]} An array of objects containing the Organization's info and the User's role in it.
 */
 const processUserRoles = (orgs, roles, safetyCheck = false, isSuperAdmin = false) => {
    if (Array.isArray(orgs) && Array.isArray(roles)) {
        let userRoles = [];
        orgs.forEach((org) => {
            let foundRole = roles.find((role) => role.org === org.orgID);
            if (foundRole !== undefined) {
                let roleName = 'Unknown Role';
                if (foundRole.role === 'superadmin') {
                    roleName = 'Super Administrator';
                } else if (foundRole.role === 'campusadmin') {
                    roleName = 'Campus Administrator';
                } else if (foundRole.role === 'member') {
                    roleName = 'Member';
                }
                if (safetyCheck === true) {
                    if (isSuperAdmin || (!isSuperAdmin && foundRole.org === process.env.ORG_ID)) {
                        userRoles.push({
                            org: org,
                            role: roleName,
                            roleInternal: foundRole.role
                        });
                    }
                } else {
                    userRoles.push({
                        org: org,
                        role: roleName,
                        roleInternal: foundRole.role
                    });
                }
            }
        });
        return userRoles;
    }
    return [];
};


/**
 * Accepts an internal role identifier and validates it against standard Conductor roles.
 * @param {String} role - The role identifier to validate.
 * @returns {Boolean} True if role is valid, false otherwise.
 */
const roleValidator = (role) => {
    if ((role === 'member') || (role === 'campusadmin') || (role === 'superadmin')) {
        return true;
    }
    return false;
}


/**
 * Middleware(s) to verify requests contain necessary fields.
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
        case 'getUserInfoAdmin':
            return [
                query('uuid', conductorErrors.err1).exists().isString().isUUID()
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
    avatarUploadHandler,
    getBasicUserInfo,
    getBasicAccountInfo,
    updateUserName,
    updateUserEmail,
    updateUserAvatar,
    getUsersList,
    getBasicUsersList,
    getUserInfoAdmin,
    deleteUser,
    getUserRoles,
    updateUserRole,
    getUserEmails,
    validate
};
