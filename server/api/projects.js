'use strict';
const User = require('../models/user.js');
const HarvestingProject = require('../models/harvestingproject.js');
const DevelopmentProject = require('../models/developmentproject.js');
const AdminProject = require('../models/adminproject.js');
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const b62 = require('base62-random');
const keys = require('../../config/keys.js');


const getAllUserProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        var harvestingProjects = [];
        var devProjects = [];
        var adminProjects = [];
        HarvestingProject.aggregate([
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
                    projectID: 1,
                    title: 1,
                    updatedAt: 1
                }
            }, {
                $lookup: {
                    from: 'harvestingprojectupdates',
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
                                createdAt: 1
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
        ]).then((harvestResults) => {
            if (harvestResults.length > 0) {
                harvestResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
            }
            harvestingProjects = harvestResults;
            return DevelopmentProject.aggregate([
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
                        projectID: 1,
                        title: 1,
                        updatedAt: 1
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
                                    createdAt: 1
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
            ]);
        }).then((devResults) => {
            if (devResults.length > 0) {
                devResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
            }
            devProjects = devResults;
            return AdminProject.aggregate([
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
                        projectID: 1,
                        title: 1,
                        updatedAt: 1
                    }
                }, {
                    $lookup: {
                        from: 'adminprojectupdates',
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
                                    createdAt: 1
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
            ]);
        }).then((adminResults) => {
            if (adminResults.length > 0) {
                adminResults.forEach((result) => {
                    if (result.lastUpdate === undefined) {
                        const lastUpdate = {
                            createdAt: result.updatedAt
                        };
                        result.lastUpdate = lastUpdate;
                    }
                });
            }
            adminProjects = adminResults;
            response.err = false;
            response.harvesting = harvestingProjects;
            response.development = devProjects;
            response.admin = adminProjects;
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

const getRecentUserProjects = (req, res, next) => {
    var response = {};
    var decoded = req.decoded;
    if (decoded != null) {
        var harvestingProject;
        var developmentProject;
        var adminProject;
        HarvestingProject.aggregate([
            {
                $match: {
                    assignees: decoded.uuid,
                    status: {
                        $in: ['ready', 'ip']
                    }
                }
            }, {
                $limit: 1
            },
            {
                $project: {
                    _id: 0,
                    projectID: 1,
                    title: 1,
                    updatedAt: 1
                }
            }, {
                $lookup: {
                    from: 'harvestingprojectupdates',
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
                                createdAt: 1
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
        ]).then((harvestResults) => {
            if (harvestResults.length > 0) {
                const recentHarvesting = harvestResults[0];
                if (recentHarvesting.lastUpdate === undefined) {
                    const lastUpdate = {
                        createdAt: recentHarvesting.updatedAt
                    };
                    recentHarvesting.lastUpdate = lastUpdate;
                }
                harvestingProject = recentHarvesting;
            }
            return DevelopmentProject.aggregate([
                {
                    $match: {
                        assignees: decoded.uuid,
                        status: {
                            $in: ['ready', 'ip']
                        }
                    }
                }, {
                    $limit: 1
                },
                {
                    $project: {
                        _id: 0,
                        projectID: 1,
                        title: 1,
                        updatedAt: 1
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
                                    createdAt: 1
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
            ]);
        }).then((devResults) => {
            if (devResults.length > 0) {
                const recentDev = devResults[0];
                if (recentDev.lastUpdate === undefined) {
                    const lastUpdate = {
                        createdAt: recentDev.updatedAt
                    };
                    recentDev.lastUpdate = lastUpdate;
                }
                developmentProject = recentDev;
            }
            return AdminProject.aggregate([
                {
                    $match: {
                        assignees: decoded.uuid,
                        status: {
                            $in: ['ready', 'ip']
                        }
                    }
                }, {
                    $limit: 1
                },
                {
                    $project: {
                        _id: 0,
                        projectID: 1,
                        title: 1,
                        updatedAt: 1
                    }
                }, {
                    $lookup: {
                        from: 'adminprojectupdates',
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
                                    createdAt: 1
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
            ]);
        }).then((adminResults) => {
            if (adminResults.length > 0) {
                const recentAdmin = adminResults[0];
                if (recentAdmin.lastUpdate === undefined) {
                    const lastUpdate = {
                        createdAt: recentAdmin.updatedAt
                    };
                    recentAdmin.lastUpdate = lastUpdate;
                }
                adminProject = recentAdmin;
            }
            response.err = false;
            if (harvestingProject !== undefined) {
                response.harvesting = harvestingProject;
            }
            if (developmentProject !== undefined) {
                response.development = developmentProject;
            }
            if (adminProject !== undefined) {
                response.admin = adminProject;
            }
            return res.send(response);
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

module.exports = {
    getAllUserProjects,
    getRecentUserProjects
};
