//
// LibreTexts Conductor
// ProjectHelpers.js
//

const visibilityOptions = [
    { key: 'private',   text: 'Private (only collaborators)',   value: 'private' },
    { key: 'public',    text: 'Public (within Conductor)',      value: 'public' }
];

const statusOptions = [
    { key: 'empty',     text: 'Clear...',           value: '' },
    { key: 'available', text: 'Available',          value: 'available' },
    { key: 'open',      text: 'Open/In Progress',   value: 'open' },
    { key: 'completed', text: 'Completed',          value: 'completed' }
];

const createTaskOptions = [
    { key: 'available',     text: 'Available',      value: 'available' },
    { key: 'inprogress',    text: 'In Progress',    value: 'inprogress' },
    { key: 'completed',     text: 'Completed',      value: 'completed' },
];

const classificationOptions = [
    { key: 'empty',             text: 'Clear...',           value: '' },
    { key: 'harvesting',        text: 'Harvesting',         value: 'harvesting' },
    { key: 'curation',          text: 'Curation',           value: 'curation' },
    { key: 'construction',      text: 'Construction',       value: 'construction' },
    { key: 'technology',        text: 'Technology',         value: 'technology' },
    { key: 'librefest',         text: 'LibreFest',          value: 'librefest' },
    { key: 'coursereport',      text: 'Course Report',      value: 'coursereport' },
    { key: 'adoptionrequest',   text: 'Adoption Request',   value: 'adoptionrequest' },
    { key: 'miscellaneous',     text: 'Miscellaneous',      value: 'miscellaneous' }
];

const projectRoleOptions = [
    { key: 'lead',      text: 'Team Lead',          value: 'lead' },
    { key: 'liaison',   text: 'Project Liaison',    value: 'liaison' },
    { key: 'member',    text: 'Team Member',        value: 'member' },
    { key: 'auditor',   text: 'Project Auditor',    value: 'auditor' }
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
 * Accepts an internal Project visibility value and attempts to return the
 * UI-ready string representation.
 * @param {String} visibility  - the visibility value to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getVisibilityText = (visibility) => {
    switch (visibility) {
        case 'private':
            return 'Private';
        case 'public':
            return 'Public';
        default:
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
            return 'Project Liaison(s)';
        case 'lead':
            return 'Project Lead(s)'
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
    let projTeam = [];
    if (project.hasOwnProperty('leads') && Array.isArray(project.leads)) {
        projTeam = [...projTeam, ...project.leads];
    }
    if (project.hasOwnProperty('liaisons') && Array.isArray(project.liaisons)) {
        projTeam = [...projTeam, ...project.liaisons];
    }
    if (project.hasOwnProperty('members') && Array.isArray(project.members)) {
        projTeam = [...projTeam, ...project.members];
    }
    if (project.hasOwnProperty('auditors') && Array.isArray(project.auditors)) {
        projTeam = [...projTeam, ...project.auditors];
    }
    if (typeof(exclude) !== 'undefined' && exclude !== null) {
        projTeam = projTeam.filter((item) => {
            if (typeof(exclude) === 'string') {
                if (typeof(item) === 'string') {
                    return item !== exclude;
                } else if (typeof(item) === 'object') {
                    return item.uuid !== exclude;
                }
            } else if (typeof(exclude) === 'object' && Array.isArray(exclude)) {
                if (typeof(item) === 'string') {
                    return !exclude.includes(item);
                } else if (typeof(item) === 'object' && typeof(item.uuid) !== 'undefined') {
                    return !exclude.includes(item.uuid);
                }
            }
            return false;
        });
    }
    return projTeam;
};


/**
 * Helper to check if a user is in an array of project role listings.
 * @param {Object[]} arr - the array to search in
 * @param {String} uuid - the user UUID to search for
 * @returns {Boolean} true if in array, false otherwise
 */
const checkUserInArray = (arr, uuid) => {
    if (typeof(arr) === 'object' && Array.isArray(arr) && typeof(uuid) === 'string') {
        let foundUser = arr.find((item) => {
            if (typeof(item) === 'string') {
                return item === uuid;
            } else if (typeof(item) === 'object') {
                return item.uuid === uuid;
            }
            return false;
        });
        if (foundUser !== undefined) return true;
    }
    return false;
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
    if (typeof(user.uuid) === 'string' && user.uuid !== '') {
        if (!setCanView && project.leads && Array.isArray(project.leads)) {
            if (checkUserInArray(project.leads, user.uuid)) setCanView = true; 
        }
        if (!setCanView && project.liaisons && Array.isArray(project.liaisons)) {
            if (checkUserInArray(project.liaisons, user.uuid)) setCanView = true; 
        }
        if (!setCanView && project.members && Array.isArray(project.members)) {
            if (checkUserInArray(project.members, user.uuid)) setCanView = true; 
        }
        if (!setCanView && project.auditors && Array.isArray(project.auditors)) {
            if (checkUserInArray(project.auditors, user.uuid)) setCanView = true; 
        }
    }
    return setCanView;
};


/**
 * Checks if a user has permission to perform high-level operations on a Project.
 * @param {Object} project - the project's information object
 * @param {Object} user - the current user's state information object
 * @returns {Boolean} true if has admin permissions, false otherwise
 */
const checkProjectAdminPermission = (project, user) => {
    /* Construct Project Admins and extract user UUID */
    let projAdmins = [];
    let userUUID = '';
    if (typeof(user) === 'string') userUUID = user;
    else if (typeof(user) === 'object' && typeof(user.uuid) !== 'undefined') {
        userUUID = user.uuid;
    }
    if (typeof(project.leads) !== 'undefined' && Array.isArray(project.leads)) {
        projAdmins = [...projAdmins, ...project.leads];
    }
    if (typeof(project.liaisons) !== 'undefined' && Array.isArray(project.liaisons)) {
        projAdmins = [...projAdmins, ...project.liaisons];
    }
    /* Check user has permission */
    if (userUUID !== '' && checkUserInArray(projAdmins, userUUID)) {
        return true; // user has organic project permissions
    } else if (typeof(user) === 'object' && user.isSuperAdmin === true) {
        return true; // user is a SuperAdmin
    }
    return false;
};


/**
 * Checks if a user has permission to perform team-only operations on a Project.
 * @param {Object} project - the project's information object
 * @param {Object} user - the current user's state information object
 * @returns {Boolean} true if has team member permissions, false otherwise
 */
const checkProjectMemberPermission = (project, user) => {
    /* Construct Project Team and extract user UUID */
    //let projTeam = constructProjectTeam(project);
    let projTeam = [];
    let userUUID = '';
    if (typeof(user) === 'string') userUUID = user;
    else if (typeof(user) === 'object' && typeof(user.uuid) !== 'undefined') {
        userUUID = user.uuid;
    }
    if (project.hasOwnProperty('leads') && Array.isArray(project.leads)) {
        projTeam = [...projTeam, ...project.leads];
    }
    if (project.hasOwnProperty('liaisons') && Array.isArray(project.liaisons)) {
        projTeam = [...projTeam, ...project.liaisons];
    }
    if (project.hasOwnProperty('members') && Array.isArray(project.members)) {
        projTeam = [...projTeam, ...project.members];
    }
    /* Check user has permission */
    if (userUUID !== '' && checkUserInArray(projTeam, userUUID)) {
        return true; // user has organic project permissions
    } else if (typeof(user) === 'object' && user.isSuperAdmin === true) {
        return true; // user is a SuperAdmin
    }
    return false;
};

export {
    visibilityOptions,
    statusOptions,
    createTaskOptions,
    classificationOptions,
    projectRoleOptions,
    getTaskStatusText,
    getClassificationText,
    getVisibilityText,
    getFlagGroupName,
    constructProjectTeam,
    checkCanViewProjectDetails,
    checkProjectAdminPermission,
    checkProjectMemberPermission
}