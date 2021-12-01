//
// LibreTexts Conductor
// ProjectOptions.js
//

const { isEmptyString } = require('./HelperFunctions.js');

const visibilityOptions = [
    { key: 'private', text: 'Private (only collaborators)', value: 'private' },
    { key: 'public', text: 'Public (within Conductor)', value: 'public' }
];

const statusOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'available', text: 'Available', value: 'available' },
    { key: 'open', text: 'Open/In Progress', value: 'open' },
    { key: 'completed', text: 'Completed', value: 'completed'}
];

const createTaskOptions = [
    { key: 'available', text: 'Available', value: 'available' },
    { key: 'inprogress', text: 'In Progress', value: 'inprogress' },
    { key: 'completed', text: 'Completed', value: 'completed' },
];

const classificationOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'harvesting', text: 'Harvesting', value: 'harvesting' },
    { key: 'curation', text: 'Curation', value: 'curation' },
    { key: 'construction', text: 'Construction', value: 'construction' },
    { key: 'technology', text: 'Technology', value: 'technology' },
    { key: 'librefest', text: 'LibreFest', value: 'librefest' },
    { key: 'coursereport', text: 'Course Report', value: 'coursereport' },
    { key: 'adoptionrequest', text: 'Adoption Request', value: 'adoptionrequest' },
];


/**
 * Accepts an internal Task status value and attempts to return the UI-ready
 * string representation.
 * @param {String} status  - the status value to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getTaskStatusText = (status) => {
    switch (status) {
        case 'completed':
            return 'Completed';
        case 'inprogress':
            return 'In Progress';
        case 'available':
            return 'Available';
        default:
            return 'Unknown';
    }
};


/**
 * Accepts an internal Project classification value and attempts to return the
 * UI-ready string representation.
 * @param {String} classification  - the classification value to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getClassificationText = (classification) => {
    let foundClassification = classificationOptions.find(item => item.key === classification);
    if (foundClassification !== undefined) {
        return foundClassification.text;
    } else {
        return 'Unknown';
    }
};


/**
 * Accepts an internal Project flagging group name and attempts to
 * return the UI-ready string representation.
 * @param {String} group  - the flagging group name to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getFlagGroupName = (group) => {
    switch (group) {
        case 'libretexts':
            return 'LibreTexts Administrators';
        case 'campusadmin':
            return 'Campus Administrators';
        case 'liaison':
            return 'Project Liaison';
        case 'lead':
            return 'Project Lead'
        default:
            return 'Unknown';
    }
};


/**
 * Construct an array of users in a project's team, with optional exclusion(s).
 * @param {Object} project  - the project data object
 * @param {String|String[]} [exclude] - the UUID(s) to exclude from the array. OPTIONAL.
 * @returns {Object[]} basic information about each project member
 */
const constructProjectTeam = (project, exclude) => {
    let projectTeam = [];
    if (project.collaborators && Array.isArray(project.collaborators)) {
        project.collaborators.forEach((item) => {
            if (typeof(item) === 'object' && item.uuid && !isEmptyString(item.uuid)) {
                projectTeam.push(item);
            } else if (typeof(item) === 'string') {
                projectTeam.push({
                    uuid: item
                });
            }
        });
    }
    if (project.hasOwnProperty('owner')) {
        if (typeof(project.owner) === 'object' && project.owner.uuid && !isEmptyString(project.owner.uuid)) {
            projectTeam.push(project.owner);
        } else if (typeof(project.owner) === 'string') {
            projectTeam.push({
                uuid: project.owner
            });
        }
    }
    if (project.hasOwnProperty('liaison')) {
        if (typeof(project.liaison) === 'object' && project.liaison.uuid && !isEmptyString(project.liaison.uuid)) {
            projectTeam.push(project.liaison);
        } else if (typeof(project.liaison) === 'string') {
            projectTeam.push({
                uuid: project.liaison
            });
        }
    }
    // filter invalid values
    projectTeam = projectTeam.filter((item) => {
        if (typeof(item) === 'object' && item.uuid && !isEmptyString(item.uuid)) {
            return true;
        }
        return false;
    });
    if (exclude !== null) {
        if (typeof(exclude) === 'string') {
            projectTeam = projectTeam.filter(item => item.uuid !== exclude);
        } else if (typeof(exclude) === 'object' && Array.isArray(exclude) && exclude.length > 0) {
            projectTeam = projectTeam.filter(item => !exclude.includes(item.uuid));
        }
    }
    return projectTeam;
};


/**
 * Checks if a user has permission to view more detailed information
 * about a project.
 * @param {Object} project - the project's information object
 * @param {Object} user - the current user's state information object
 * @returns {Boolean} true if can view details, false otherwise
 */
const checkCanViewProjectDetails = (project, user) => {
    let setCanView = false;
    if (typeof(project) !== 'object' || typeof(user) !== 'object') return false;
    if (user.uuid && user.uuid !== '') {
        if (project.owner?.uuid === user.uuid || project.owner === user.uuid) {
            setCanView = true;
        }
        if (!setCanView && (project.liaison?.uuid === user.uuid || project.liaison === user.uuid)) {
            setCanView = true;
        }
        if (!setCanView && project.hasOwnProperty('collaborators') && Array.isArray(project.collaborators)) {
            let foundCollab = project.collaborators.find((item) => {
                if (typeof(item) === 'string') {
                    return item === user.uuid;
                } else if (typeof(item) === 'object') {
                    return item.uuid === user.uuid;
                }
                return false;
            });
            if (foundCollab !== undefined) setCanView = true;
        }
        if (!setCanView && user.isSuperAdmin === true) setCanView = true;
    }
    return setCanView;
};


module.exports = {
    visibilityOptions,
    statusOptions,
    createTaskOptions,
    classificationOptions,
    getTaskStatusText,
    getClassificationText,
    getFlagGroupName,
    constructProjectTeam,
    checkCanViewProjectDetails
}
