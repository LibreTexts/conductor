//
// LibreTexts Conductor
// users.js

'use strict';
import express from 'express';
import { body, query, param } from 'express-validator';
import { debugError } from '../debug.js';
import User from '../models/user.js';
import conductorErrors from '../conductor-errors.js';
import authAPI from './auth.js';
import { getPaginationOffset } from '../util/helpers.js';

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
        avatar: 1,
        email: 1,
        verifiedInstructor: 1,
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
                instructorProfile: 1,
                verifiedInstructor: 1,
                createdAt: 1,
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
                avatar: user.avatar,
                instructorProfile: user.instructorProfile,
                verifiedInstructor: user.verifiedInstructor,
            };
            account.createdAt = user._id.getTimestamp();
            if (user.authType === 'sso') {
                account.authType = 'sso';
            } else {
                account.authType = 'Traditional';
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
 * Checks if the User has been verified as an instructor at an academic institution.
 *
 * @param {string} uuid - User's unique identifier.
 * @returns {Promise<boolean>} True if verified instructor, false otherwise.
 */
async function checkVerifiedInstructorStatus(uuid) {
    if (uuid) {
        const user = await User.findOne({ uuid }).lean();
        const verified = !!user.verifiedInstructor;
        let isSuperAdmin = false;
        if (Array.isArray(user.roles)) {
            isSuperAdmin = !!(user.roles.find((item) => (
                item.org === 'libretexts' && item.role === 'superadmin'
            )));
        }
        return verified || isSuperAdmin;
    }
    return false;
}

/**
 * Updates the current user's stored Instructor Profile.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function updateUserInstructorProfile(req, res) {
    try {
        const foundUser = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
        let profileUpdate = foundUser.instructorProfile || { };
        if (Object.hasOwn(req.body, 'institution')) {
            profileUpdate.institution = req.body.institution;
        }
        if (Object.hasOwn(req.body, 'facultyURL')) {
            profileUpdate.facultyURL = req.body.facultyURL;
        }
        
        // Ensure both are present (or not present) at the same time
        if (
            !Object.hasOwn(profileUpdate, 'institution')
            || !Object.hasOwn(profileUpdate, 'facultyURL')
            || (profileUpdate.facultyURL.length > 0 && profileUpdate.institution.length === 0)
            || (profileUpdate.institution.length > 0 && profileUpdate.facultyURL.length === 0)
        ) {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err2,
            });
        }

        // Allow unsetting
        if (profileUpdate.institution.length === 0 && profileUpdate.facultyURL.length === 0) {
            profileUpdate = null;
        }

        await User.updateOne(
            { uuid: req.user.decoded.uuid },
            { instructorProfile: profileUpdate },
        );
        return res.send({
            err: false,
            msg: 'Successfully updated user instructor profile!',
        });
    } catch (e) {
        debugError(e);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

/**
 * Returns a list of simple information about all Users in the database.
 * Method should be restricted to users with elevated privileges.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getUsersList = async (_req, res) => {
    try {
        const query = _req.query.query;
        const page = parseInt(_req.query.page.toString()) || 1;
        const limit = parseInt(_req.query.limit.toString()) || 10;
        const sort = _req.query.sort || 'first';

        const queryObj = {
            $search: {
                text: {
                    query,
                    path: ['firstName', 'lastName', 'email'],
                }
            }
        }

        const data = await User.aggregate([
            ...(query && query.length > 0 ? [queryObj] : []),
            {
                $match: {
                    $expr: { $not: '$isSystem' },
                },
            },
            {
                $project: {
                    _id: 0,
                    uuid: 1,
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    authType: 1
                }
            },
            {
                $sort: {
                    [sort === 'first' ? 'firstName' : sort === 'last' ? 'lastName' : 'email']: 1
                }
            }
        ]);

        const offset = getPaginationOffset(page, limit);

        return res.send({
            results: data.slice(offset, offset + limit),
            total_items: data.length,
        })

    } catch (e){
        debugError(e);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    }
};


/**
 * Returns a list of simple information about all Users in the database.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const getBasicUsersList = (_req, res) => {
    User.aggregate([
        {
            $match: {
              $expr: { $not: '$isSystem' },
            },
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
                account.authType = 'SSO';
            } else {
                account.authType = 'Traditional';
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

// NOW HANDLED BY LIBREONE (CENTRAL IDENTITY)
// /**
//  * Deletes the User identified in the request body.
//  * Method should be restricted to users with elevated privileges.
//  * NOTE: This function should only be called AFTER the validation chain.
//  * VALIDATION: 'deleteUser'
//  * @param {Object} req - The Express.js request object.
//  * @param {Object} res - The Express.js response object.
//  */
// const deleteUser = (req, res) => {
//     User.deleteOne({
//         uuid: req.body.uuid
//     }).then((deleteRes) => {
//         if (deleteRes.deletedCount === 1) {
//             return res.send({
//                 err: false,
//                 msg: "Successfully deleted user."
//             });
//         }
//         throw(new Error('deletefailed'));
//     }).catch((err) => {
//         let errMsg = conductorErrors.err6;
//         if (err.message === 'deletefailed') errMsg = conductorErrors.err3;
//         debugError(err);
//         return res.send({
//             err: true,
//             errMsg: errMsg
//         });
//     });
// };

/**
 * Retrieves the list of API Client apps a User has authorized to access their account
 * given their UUID.
 *
 * @param {string} uuid - The User's unique identifier.
 * @returns {Promise<object[]>} The list of authorized apps, or an empty array if not found.
 */
async function getUserAuthorizedApplications(uuid) {
  if (typeof (uuid) === 'string' || uuid.length > 0) {
    const foundUser = await User.findOne({ uuid }).lean();
    if (foundUser && Array.isArray(foundUser.authorizedApps)) {
      return foundUser.authorizedApps;
    }
  }
  return [];
}

/**
 * Retrieves the list of API Client applications the current user has authorized to access
 * their account.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getAuthorizedApplications(req, res) {
    try {
        const searchRes = await User.aggregate([{
            $match: {
                uuid: req.user.decoded.uuid,
            },
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                authorizedApps: 1,
            },
        }, {
            $unwind: {
                path: '$authorizedApps',
                preserveNullAndEmptyArrays: true,
            },
        }, {
            $lookup: {
                from: 'apiclients',
                let: { client: '$authorizedApps.clientID' },
                pipeline: [{
                    $match: {
                        $expr: {
                            $eq: ['$clientID', '$$client'],
                        },
                    },
                }, {
                    $project: {
                        _id: 0,
                        clientID: 1,
                        name: 1,
                        infoURL: 1,
                        icon: 1,
                        scopes: 1,
                    },
                }],
                as: 'apiclient',
            }
        }, {
            $addFields: {
                application: {
                    $arrayElemAt: ['$apiclient', 0],
                },
                apiclient: '$$REMOVE',
            },
        }, {
            $addFields: {
                'application.authorizedAt': '$authorizedApps.authorizedAt',
                authorizedApps: '$$REMOVE',
            },
        }, {
            $group: {
                _id: '$_id',
                uuid: { $first: '$uuid' },
                authorizedApps: { $push: '$application' },
            },
        }, {
            $project: {
                _id: 0,
                uuid: 1,
                authorizedApps: {
                    $filter: {
                        input: '$authorizedApps',
                        as: 'app',
                        cond: { $ifNull: ['$$app.clientID', false] },
                    },
                },
            },
        }]);
        
        if (searchRes.length < 1) {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err9,
            });
        }

        const userApps = searchRes[0].authorizedApps || [];
        return res.send({
            err: false,
            msg: 'Successfully retrieved authorized applications!',
            apps: userApps,
        });
    } catch (e) {
        debugError(e);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

/**
 * Adds (or refreshes) an API Client to a User's list of authorized applications.
 *
 * @param {string} uuid - The User's unique identifier.
 * @param {string} clientID - The API Client identifier.
 * @returns {Promise<boolean>} True if successfully added/updated, false otherwise.
 */
async function addUserAuthorizedApplication(uuid, clientID) {
  if (uuid && clientID) {
    const foundUser = await User.findOne({ uuid }).lean();
    if (foundUser) {
      let authorized = [];
      if (Array.isArray(foundUser.authorizedApps)) {
        authorized = foundUser.authorizedApps;
      }
      const existingIdx = authorized.findIndex((app) => app.clientID === clientID);
      const now = new Date();
      if (existingIdx > -1) { // re-auth
        authorized[existingIdx] = {
          ...authorized[existingIdx],
          authorizedAt: now,
        };
      } else {
        authorized.push({
          clientID,
          authorizedAt: now,
        });
      }
      const updated = await User.updateOne({ uuid }, {
        authorizedApps: authorized,
      });
      if (updated.modifiedCount === 1) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Removes an API Client from the current user's list of authorized applications.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function removeUserAuthorizedApplication(req, res) {
    try {
        const { clientID } = req.params;
        await User.updateOne(
            { uuid: req.user.decoded.uuid },
            { $pull: { authorizedApps: { clientID } } },
        );
        return res.send({
            err: false,
            msg: 'Successfully revoke application access.',
        });
    } catch (e) {
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

/**
 * Retrieves the User's instructor profile, if applicable.
 *
 * @param {express.Request} req - Incoming request object. 
 * @param {express.Response} res - Outgoing response object. 
 */
async function getInstructorProfile(req, res) {
    try {
        const foundUser = await User.findOne({ uuid: req.user.decoded.uuid }).lean();
        if (!foundUser) {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err9,
            });
        }

        let profile = null;
        let verifiedInstructor = false;
        if (foundUser.instructorProfile) {
            profile = foundUser.instructorProfile;
        }
        if (foundUser.verifiedInstructor) {
            verifiedInstructor = foundUser.verifiedInstructor;
        }

        return res.send({
            verifiedInstructor,
            profile,
            err: false,
            uuid: foundUser.uuid,
        });
    } catch (e) {
        debugError(e);
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

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

const deleteUserRole = async (req, res) => {
    try {
      let isSuperAdmin = authAPI.checkHasRole(req.user, 'libretexts', 'superadmin');
      if (!isSuperAdmin && (req.body.orgID !== process.env.ORG_ID)) {
        return res.send({
          err: true,
          errMsg: conductorErrors.err8
        });
      }
      
      const user = await User.findOne({ uuid: req.body.uuid }).lean();
      if (!user) {
        return res.send({
          err: true,
          errMsg: conductorErrors.err7
        });
      }
      
      let newRoles = [];
      if (user.roles && Array.isArray(user.roles)) {
        newRoles = user.roles.filter((item) => item.org !== req.body.orgID);
      }
    
      const updateRes = await User.updateOne(
        { uuid: req.body.uuid }, 
        { roles: newRoles }
      );
      
      if (updateRes.matchedCount === 1 && updateRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Successfully deleted the user's role."
        });
      } else {
        return res.send({
          err: true,
          errMsg: conductorErrors.err3
        });
      }
    } catch (err) {
      debugError(err);
      return res.send({
        err: true,
        errMsg: conductorErrors.err6
      });
    }
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
        case 'updateInstructorProfile':
            return [
                body('institution', conductorErrors.err1).optional({ checkFalsy: true }).isLength({ min: 1, max: 100 }),
                body('facultyURL', conductorErrors.err1).optional({ checkFalsy: true }).isURL(),
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
        case 'deleteUserRole': 
            return [
                body('uuid', 'Must provide a valid user identifier').isUUID(),
                body('orgID', 'Must provide a valid organization identifier').isString().notEmpty()
            ]
        case 'removeAuthorizedApplication':
            return [
                param('clientID', conductorErrors.err1).exists().isLength({ min: 2, max: 50 }),
            ]
    }
}


export default {
    getBasicUserInfo,
    getBasicAccountInfo,
    checkVerifiedInstructorStatus,
    updateUserInstructorProfile,
    getUsersList,
    getBasicUsersList,
    getUserInfoAdmin,
    addUserAuthorizedApplication,
    removeUserAuthorizedApplication,
    getUserAuthorizedApplications,
    getAuthorizedApplications,
    getInstructorProfile,
    getUserRoles,
    updateUserRole,
    deleteUserRole,
    getUserEmails,
    validate
}
