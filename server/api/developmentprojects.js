'use strict';
const User = require('../models/user.js');
const DevelopmentProject = require('../models/developmentproject.js');
const DevProjectUpdate = require('../models/devprojectupdate.js');
const DevTask = require('../models/devtask.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const keys = require('../../config/keys.js');


const addExistingProject = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.title != undefined) {
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    var hasProperRole = false;
                    if (userResult.roles.includes('admin')) {
                        hasProperRole = true;
                    }
                    if (userResult.roles.includes('dev')) {
                        hasProperRole = true;
                    }
                    if (hasProperRole) {
                        const newAssignees = [decoded.uuid];
                        var newProject = new DevelopmentProject({
                            projectID: b62(10),
                            title: req.body.title,
                            status: 'ready',
                            currentProgress: req.body.estimatedProgress,
                            assignees: newAssignees,
                            description: req.body.description,
                            resourceURL: req.body.resourceURL
                        });
                        return newProject.save();
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    response.err = false;
                    response.msg = "New development project created.";
                    response.id = newDoc.projectID;
                    return res.send(response);
                } else {
                    throw("An error occurred saving the new project.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};


const newProjectFromTask = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.title != undefined && req.body.devTaskID != undefined) {
            var newProjectID;
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    if (userResult.roles.includes('dev') || userResult.roles.includes('admin')) {
                        const newAssignees = [decoded.uuid];
                        var newProject = new DevelopmentProject({
                            projectID: b62(10),
                            title: req.body.title,
                            status: 'ready',
                            currentProgress: 0,
                            assignees: newAssignees,
                            description: req.body.description,
                            resourceURL: req.body.resourceURL,
                            convertedFrom: req.body.devTaskID
                        });
                        return newProject.save();
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    newProjectID = newDoc.projectID;
                    return DevTask.updateOne({
                        devTaskID: req.body.devTaskID
                    }, {
                        $set: {
                            status: "converted"
                        }
                    });
                } else {
                    throw("An error occurred saving the new project.");
                }
            }).then((updatedDoc) => {
                if (updatedDoc) {
                    if (newProjectID !== undefined) {
                        response.err = false;
                        response.msg = "New development project created from the task.";
                        response.id = newProjectID;
                        return res.send(response);
                    } else {
                        throw("An error occurred creating the new project.");
                    }
                } else {
                    throw("An error occured updating the task.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const newProjectForAssignee = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != undefined) {
        if (req.body.title != undefined && req.body.devTaskID != undefined && req.body.assignee != undefined) {
            var newProjectID;
            User.findOne({
                uuid: decoded.uuid
            }).then((userResult) => {
                if (userResult) {
                    if (userResult.roles.includes('admin')) {
                        const newAssignees = [req.body.assignee];
                        var newProject = new DevelopmentProject({
                            projectID: b62(10),
                            title: req.body.title,
                            status: 'ready',
                            currentProgress: 0,
                            assignees: newAssignees,
                            description: req.body.description,
                            resourceURL: req.body.resourceURL,
                            convertedFrom: req.body.devTaskID
                        });
                        return newProject.save();
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a user with that identity.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    newProjectID = newDoc.projectID;
                    return DevTask.updateOne({
                        devTaskID: req.body.devTaskID
                    }, {
                        $set: {
                            status: "converted"
                        }
                    });
                } else {
                    throw("An error occurred saving the new project.");
                }
            }).then((updatedDoc) => {
                if (updatedDoc) {
                    if (newProjectID !== undefined) {
                        response.err = false;
                        response.msg = "New development project created from the target.";
                        response.id = newProjectID;
                        return res.send(response);
                    } else {
                        throw("An error occurred creating the new project.");
                    }
                } else {
                    throw("An error occured updating the textbook target.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getProjectDetail = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.query.id != undefined) {
            DevelopmentProject.aggregate([
                {
                    $match: {
                        projectID: req.query.id
                    }
                }, {
                    $limit: 1
                }, {
                    $project: {
                        _id: 0,
                        __v: 0,
                        updatedAt: 0
                    }
                }, {
                    $lookup: {
                        from: 'users',
                        let: {
                            assignees: '$assignees'
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ['$uuid', '$$assignees']
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    firstName: 1,
                                    lastName: 1
                                }
                            }
                        ],
                        as: 'assignees'
                    }
                }
            ]).then((projectResult) => {
                if (projectResult.length > 0) {
                    response.err = false;
                    response.project = projectResult[0];
                    return res.send(response);
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};


const getCurrentProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevelopmentProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: {
                        $in: ['ready', 'ip']
                    }
                }
            }, {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }, {
                $lookup: {
                    from: 'devprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                __v: 0,
                                updatedAt: 0
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((projectResults) => {
            if (projectResults.length > 0) {
                projectResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
                response.err = false;
                response.projects = projectResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No projects available.";
                response.projects = [];
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getFlaggedProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevelopmentProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: 'flagged'
                }
            }, {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }, {
                $lookup: {
                    from: 'devprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                __v: 0,
                                updatedAt: 0
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((projectResults) => {
            if (projectResults.length > 0) {
                projectResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
                response.err = false;
                response.projects = projectResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No projects available.";
                response.projects = [];
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getRecentlyCompletedProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevelopmentProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: 'completed'
                }
            }, {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }, {
                $sort: {
                    updatedAt: -1
                }
            }, {
                $limit: 2
            }, {
                $lookup: {
                    from: 'devprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                __v: 0,
                                updatedAt: 0
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((projectResults) => {
            if (projectResults.length > 0) {
                projectResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
                response.err = false;
                response.projects = projectResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No projects available.";
                response.projects = [];
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getAllCompletedProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        DevelopmentProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: 'completed'
                }
            }, {
                $project: {
                    _id: 0,
                    __v: 0
                }
            }, {
                $sort: {
                    updatedAt: -1
                }
            }, {
                $lookup: {
                    from: 'devprojectupdates',
                    let: {
                        pID: '$projectID'
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$projectID', '$$pID']
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                __v: 0,
                                updatedAt: 0
                            }
                        }, {
                            $sort: {
                                createdAt: -1
                            }
                        }, {
                            $limit: 1
                        }
                    ],
                    as: 'lastUpdate'
                }
            }, {
                $addFields: {
                    lastUpdate: {
                        $arrayElemAt: ['$lastUpdate', 0]
                    }
                }
            }
        ]).then((projectResults) => {
            if (projectResults.length > 0) {
                projectResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
                response.err = false;
                response.projects = projectResults;
                return res.send(response);
            } else {
                response.err = false;
                response.msg = "No projects available.";
                response.projects = [];
                return res.send(response);
            }
        }).catch((err) => {
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const updateProject = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    var id;
    if (decoded != null) {
        if (req.body.id !== undefined) {
            DevelopmentProject.findOne({
                projectID: req.body.id
            }).then((projectResult) => {
                if (projectResult != undefined) {
                    if (projectResult.assignees.includes(decoded.uuid)) {
                        id = projectResult.projectID;
                        var toSet = {};
                        if (req.body.title) {
                            toSet.title = req.body.title;
                        }
                        if (req.body.description) {
                            toSet.description = req.body.description;
                        }
                        if (req.body.resourceURL) {
                            toSet.resourceURL = req.body.resourceURL;
                        }
                        return DevelopmentProject.updateOne({
                            projectID: id
                        }, { $set: toSet });
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((updatedProject) => {
                if (updatedProject) {
                    response.err = false;
                    response.id = id;
                    return res.send(response);
                } else {
                    response.err = true;
                    response.errMsg = "Couldn't update the project with that ID.";
                    return res.send(response);
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const markProjectCompleted = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.id !== undefined) {
            DevelopmentProject.findOne({
                projectID: req.body.id
            }).then((projectResult) => {
                var result = {};
                if (projectResult != null) {
                    if (projectResult.assignees.includes(decoded.uuid)) {
                        if (projectResult.currentProgress === 100) {
                            return DevelopmentProject.updateOne({
                                projectID: req.body.id
                            }, {
                                $set: {
                                    status: 'completed'
                                }
                            });
                        } else {
                            throw("The project must be at 100% progress to mark as completed.");
                        }
                    } else {
                        throw("Sorry, you don't have the proper privileges to perform this action.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((updatedProject) => {
                if (updatedProject) {
                    response.err = false;
                    response.msg = "Marked the project as completed.";
                    return res.send(response);
                } else {
                    response.err = true;
                    response.errMsg = "Couldn't update the project with that ID.";
                    return res.send(response);
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const deleteProject = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.id != null) {
            DevelopmentProject.findOne({
                projectID: req.body.id
            }).then((projectResult) => {
                if (projectResult) {
                    if (projectResult.assignees.length > 0) {
                        const isAssignee = projectResult.assignees.includes(decoded.uuid);
                        if (isAssignee) {
                            return DevelopmentProject.deleteOne({
                                projectID: req.body.id
                            });
                        } else {
                            throw("Sorry, you don't have the proper privileges to perform this action.");
                        }
                    } else {
                        throw("Sorry, we encountered an issue deleting the project.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((deleteResult) => {
                if (deleteResult.deletedCount == 1) {
                    response.err = false;
                    response.deletedProject = true;
                    return res.send(response);
                } else {
                    throw("An error occurred deleting the project.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const flagProject = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != undefined) {
        if (req.body.id != undefined && req.body.newAssignee != undefined) {
            DevelopmentProject.findOne({
                projectID: req.body.id
            }).then((projectResult) => {
                if (projectResult) {
                    if (projectResult.assignees.length > 0) {
                        const isAssignee = projectResult.assignees.includes(decoded.uuid);
                        if (isAssignee) {
                            return DevelopmentProject.updateOne({
                                projectID: req.body.id
                            }, {
                                $set: {
                                    status: 'flagged',
                                    flaggedUser: req.body.newAssignee
                                },
                                $push: {
                                    assignees: req.body.newAssignee
                                }
                            });
                        } else {
                            throw("Sorry, you don't have the proper privileges to perform this action.");
                        }
                    } else {
                        throw("Sorry, we encountered an issue loading the project.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((updatedProject) => {
                if (updatedProject) {
                    response.err = false;
                    response.msg = "Successfully flagged the project for review.";
                    return res.send(response);
                } else {
                    response.err = true;
                    response.errMsg = "Couldn't update the project with that ID.";
                    return res.send(response);
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const unflagProject = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != undefined) {
        if (req.body.id != undefined) {
            DevelopmentProject.findOne({
                projectID: req.body.id
            }).then((projectResult) => {
                if (projectResult) {
                    if (projectResult.assignees.length > 0) {
                        const isAssignee = projectResult.assignees.includes(decoded.uuid);
                        if (isAssignee) {
                            if (projectResult.flaggedUser !== '') {
                                const flaggedUser = projectResult.flaggedUser;
                                return DevelopmentProject.updateOne({
                                    projectID: req.body.id
                                }, {
                                    $set: {
                                        status: 'ip',
                                        flaggedUser: ''
                                    },
                                    $pull: {
                                        assignees: flaggedUser
                                    }
                                });
                            } else {
                                throw("Sorry, we're having trouble unflagging the project.");
                            }
                        } else {
                            throw("Sorry, you don't have the proper privileges to perform this action.");
                        }
                    } else {
                        throw("Sorry, we encountered an issue loading the project.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((updatedProject) => {
                if (updatedProject) {
                    response.err = false;
                    response.msg = "Successfully unflagged the project.";
                    return res.send(response);
                } else {
                    response.err = true;
                    response.errMsg = "Couldn't update the project with that ID.";
                    return res.send(response);
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const addProgressUpdate = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    var currStatus = '';
    if (decoded != undefined) {
        if (req.body.projectID != undefined && req.body.accomplishments != undefined && req.body.issues != undefined && req.body.objectives != undefined && req.body.estimatedProgress != undefined && req.body.estimatedHours != undefined) {
            DevelopmentProject.findOne({
                projectID: req.body.projectID
            }).then((projectResult) => {
                if (projectResult) {
                    currStatus = projectResult.status;
                    if (projectResult.assignees.length > 0) {
                        const isAssignee = projectResult.assignees.includes(decoded.uuid);
                        if (isAssignee) {
                            const newUpdate = new DevProjectUpdate({
                                updateID: b62(10),
                                projectID: req.body.projectID,
                                author: decoded.uuid,
                                accomplishments: req.body.accomplishments,
                                issues: req.body.issues,
                                objectives: req.body.objectives,
                                notes: req.body.notes,
                                estimatedProgress: req.body.estimatedProgress,
                                estimatedHours: req.body.estimatedHours
                            });
                            return newUpdate.save();
                        } else {
                            throw("Sorry, you don't have the proper privileges to perform this action.");
                        }
                    } else {
                        throw("Sorry, we encountered an issue opening the project.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((newDoc) => {
                if (newDoc) {
                    var toSet = {
                        currentProgress: req.body.estimatedProgress
                    }
                    if (currStatus === 'ready') {
                        toSet.status = 'ip';
                    }
                    return DevelopmentProject.updateOne({
                        projectID: req.body.projectID
                    }, {
                        $set: toSet
                    });
                } else {
                    throw("An error occurred saving the progress update.");
                }
            }).then((updatedDoc) => {
                if (updatedDoc) {
                    response.err = false;
                    response.msg = "Progress update successfully saved.";
                    return res.send(response);
                } else {
                    throw("An error occured updating the project.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getAllProgressUpdates = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.query.id) {
            DevProjectUpdate.aggregate([
                {
                    $match: {
                        projectID: req.query.id
                    }
                }, {
                    $project: {
                        _id: 0,
                        __v: 0,
                        updatedAt: 0
                    }
                },
                {
                    $sort: {
                        createdAt: -1
                    }
                }, {
                    $lookup: {
                        from: 'users',
                        let: {
                            authorUUID: '$author'
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$uuid', '$$authorUUID']
                                    }
                                }
                            }, {
                                $project: {
                                    _id: 0,
                                    firstName: 1,
                                    lastName: 1,
                                    avatar: 1
                                }
                            }
                        ],
                        as: 'author'
                    }
                }, {
                    $addFields: {
                        author: {
                            $arrayElemAt: ['$author', 0]
                        }
                    }
                }
            ]).then((updateResults) => {
                response.err = false;
                response.updates = updateResults;
                return res.send(response);
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const deleteProgressUpdate = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        if (req.body.projectID != null && req.body.updateID != null) {
            DevelopmentProject.findOne({
                projectID: req.body.projectID
            }).then((projectResult) => {
                if (projectResult) {
                    if (projectResult.assignees.length > 0) {
                        const isAssignee = projectResult.assignees.includes(decoded.uuid);
                        if (isAssignee) {
                            return DevProjectUpdate.deleteOne({
                                updateID: req.body.updateID
                            });
                        } else {
                            throw("Sorry, you don't have the proper privileges to perform this action.");
                        }
                    } else {
                        throw("Sorry, we encountered an issue opening the project.");
                    }
                } else {
                    throw("Couldn't find a project with that ID.");
                }
            }).then((deleteResult) => {
                if (deleteResult.deletedCount == 1) {
                    response.err = false;
                    response.deletedProgressUpdate = true;
                    return res.send(response);
                } else {
                    throw("An error occurred deleting the progress update.");
                }
            }).catch((err) => {
                response.err = true;
                response.errMsg = err;
                return res.send(response);
            });
        } else {
            response.err = true;
            response.errMsg = "Missing required fields.";
            return res.send(response);
        }
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

const getAIOFeed = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        var startDate = '2021-01-01';
        const today = new Date();
        var endDate = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        User.findOne({
            uuid: decoded.uuid
        }).then((userResult) => {
            if (userResult) {
                if (userResult.roles.includes('admin') || userResult.roles.includes('dev')) {
                    try {
                        if (req.query.fromDate !== undefined) {
                            const fromDate = String(req.query.fromDate).split('-');
                            startDate = new Date(`${fromDate[2]}-${fromDate[0]}-${fromDate[1]}`);
                            startDate.setHours(0,0,0);
                        }
                        if (req.query.toDate !== undefined) {
                            const toDate = String(req.query.toDate).split('-');
                            endDate = new Date(`${toDate[2]}-${toDate[0]}-${toDate[1]}`);
                            endDate.setHours(23,59,59);
                        }
                        return DevProjectUpdate.aggregate([
                                        {
                                            $match: {
                                                createdAt: {
                                                    $gte: startDate,
                                                    $lte: endDate
                                                }
                                            }
                                        },
                                        {
                                            $limit: 200
                                        },
                                        {
                                            $project: {
                                                _id: 0,
                                                __v: 0,
                                                updatedAt: 0
                                            }
                                        },
                                        {
                                            $sort: {
                                                createdAt: -1
                                            }
                                        }, {
                                            $lookup: {
                                                from: 'users',
                                                let: {
                                                    authorUUID: '$author'
                                                },
                                                pipeline: [
                                                    {
                                                        $match: {
                                                            $expr: {
                                                                $eq: ['$uuid', '$$authorUUID']
                                                            }
                                                        }
                                                    }, {
                                                        $project: {
                                                            _id: 0,
                                                            firstName: 1,
                                                            lastName: 1,
                                                            uuid: 1,
                                                            avatar: 1
                                                        }
                                                    }
                                                ],
                                                as: 'author'
                                            }
                                        }, {
                                            $lookup: {
                                                from: 'developmentprojects',
                                                let: {
                                                    projectID: '$projectID'
                                                },
                                                pipeline: [
                                                    {
                                                        $match: {
                                                            $expr: {
                                                                $eq: ['$projectID', '$$projectID']
                                                            }
                                                        }
                                                    }, {
                                                        $project: {
                                                            _id: 0,
                                                            projectID: 1,
                                                            title: 1
                                                        }
                                                    }
                                                ],
                                                as: 'project'
                                            }
                                        }, {
                                            $addFields: {
                                                author: {
                                                    $arrayElemAt: ['$author', 0]
                                                },
                                                project: {
                                                    $arrayElemAt: ['$project', 0]
                                                }
                                            }
                                        }
                                    ]);
                    } catch (e) {
                        throw("There was an error parsing the date range.");
                    }
                } else {
                    throw("Sorry, you don't have the proper privileges to perform this action.");
                }
            } else {
                throw("Couldn't find a user with that identity.");
            }
        }).then((aioResults) => {
            response.err = false;
            response.aios = aioResults;
            response.startDate = startDate;
            response.endDate = endDate;
            return res.send(response);
        }).catch((err) => {
            console.log(err);
            response.err = true;
            response.errMsg = err;
            return res.send(response);
        });
    } else {
        response.err = true;
        response.errMsg = "Missing authorization token.";
        return res.status(401).send(response);
    }
};

module.exports = {
    addExistingProject,
    newProjectFromTask,
    newProjectForAssignee,
    getProjectDetail,
    getCurrentProjects,
    getFlaggedProjects,
    getRecentlyCompletedProjects,
    getAllCompletedProjects,
    updateProject,
    markProjectCompleted,
    deleteProject,
    flagProject,
    unflagProject,
    addProgressUpdate,
    getAllProgressUpdates,
    deleteProgressUpdate,
    getAIOFeed
};
