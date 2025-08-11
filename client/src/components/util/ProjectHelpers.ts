import { Project, User, License } from "../../types";
import { threePointLikertOptions, fivePointLikertOptions, sevenPointLikertOptions } from "./LikertHelpers";

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
    { key: 'construction',      text: 'Construction',       value: 'construction' },
    { key: 'curation',          text: 'Curation',           value: 'curation' },
    { key: 'harvesting',        text: 'Harvesting',         value: 'harvesting' },
    { key: 'academy',           text: 'Academy',            value: 'academy' },
    { key: 'adoptionrequest',   text: 'Adoption Request',   value: 'adoptionrequest' },
    { key: 'coursereport',      text: 'Course Report',      value: 'coursereport' },
    { key: 'librefest',         text: 'LibreFest',          value: 'librefest' },
    { key: 'technology',        text: 'Technology',         value: 'technology' },
    { key: "minirepo",          text: 'Mini-Repo',          value: 'minirepo' },
    { key: 'miscellaneous',     text: 'Miscellaneous',      value: 'miscellaneous' }
];

const classificationDescriptions = [
    {
        key: 'harvesting',
        description: 'Harvesting projects center around existing OER content that LibreTexts content developers are gathering from other sources and adapting to the LibreTexts platform.'
    },
    {
        key: 'construction',
        description: 'Construction projects typically enclose brand-new OER content being written on the LibreTexts platform by the community.'
    },
    {
        key: 'adoptionrequest',
        description: 'Adoption Request projects describe an effort to adapt existing OER content to the LibreTexts platform as requested by a member of the community.'
    }
];

const PROJECT_ROLE_SORT_ORDER = {
    lead: 1,
    liaison: 2,
    member: 3,
    auditor: 4,
};

const projectRoleOptions = [
    { key: 'lead',      text: 'Team Lead',          value: 'lead' },
    { key: 'liaison',   text: 'Project Liaison',    value: 'liaison' },
    { key: 'member',    text: 'Team Member',        value: 'member' },
    { key: 'auditor',   text: 'Project Auditor',    value: 'auditor' }
];

const peerReviewPromptTypes = [
    { key: '3-likert',  text: '3-Point Likert', value: '3-likert' },
    { key: '5-likert',  text: '5-Point Likert', value: '5-likert' },
    { key: '7-likert',  text: '7-Point Likert', value: '7-likert' },
    { key: 'text',      text: 'Text Response',  value: 'text' },
    { key: 'dropdown',  text: 'Dropdown',       value: 'dropdown' },
    { key: 'checkbox',  text: 'Checkbox',       value: 'checkbox' }
];

const peerReviewAuthorTypes = [
    { key:  'student',      text: 'Student',    value: 'student' },
    { key:  'instructor',   text: 'Instructor', value: 'instructor' }
];

const PROJECT_FILES_ACCESS_SETTINGS = [
  { key: 'public',  value: 'public',  text: 'Public (visible on Commons)'          },
  { key: 'users',   value: 'users',   text: 'All Conductor Users' },
  { key: 'instructors', value: 'instructors', text: 'Verified Instructors'},
  { key: 'team', value: 'team', text: 'Project Team Members'},
];


/**
 * Accepts an internal Task status value and attempts to return the UI-ready
 * string representation.
 * @param {String} status  - the status value to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getTaskStatusText = (status: string) => {
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
const getClassificationText = (classification: string) => {
    const foundClassification = classificationOptions.find(item => item.key === classification);
    if (foundClassification !== undefined) {
        return foundClassification.text;
    } else {
        return 'Unknown';
    }
};


/**
 * Accepts an internal Project classification value and attempts to return the
 * UI-ready string description.
 * @param {string} classification - The classification value to find UI description text for.
 * @returns {string} The UI-ready string description, or an empty string.
 */
 const getClassificationDescription = (classification: string) => {
    const foundClassification = classificationDescriptions.find(item => item.key === classification);
    if (foundClassification !== undefined) {
        return foundClassification.description;
    }
    return '';
};


/**
 * Accepts an internal Project visibility value and attempts to return the
 * UI-ready string representation.
 * @param {String} visibility  - the visibility value to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getVisibilityText = (visibility: string) => {
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
 * Retrieves the UI-ready representation of Peer Review Author type.
 * @param {String} authorType - The internal author type identifier.
 * @returns {String} The UI-ready representation, or an empty string if not found.
 */
const getPeerReviewAuthorText = (authorType: string) => {
    if (typeof(authorType) === 'string' && authorType !== '') {
        let foundType = peerReviewAuthorTypes.find((item) => item.value === authorType);
        if (foundType !== undefined) return foundType.text;
    }
    return '';
};

/**
 * Accepts an internal Project flagging group name and attempts to
 * return the UI-ready string representation.
 * @param {String} group  - the flagging group name to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getFlagGroupName = (group: string) => {
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
const constructProjectTeam = (project: Project, exclude: string | string[]) => {
    let projTeam: (string | User)[] = [];
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
const checkUserInArray = (arr: any[], uuid: string) => {
    if (typeof(arr) === 'object' && Array.isArray(arr) && typeof(uuid) === 'string') {
        const foundUser = arr.find((item) => {
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
const checkCanViewProjectDetails = (project: Project, user: User) => {
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
const checkProjectAdminPermission = (project: Project, user: User) => {
    /* Construct Project Admins and extract user UUID */
    let projAdmins: (string | User)[] = [];
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
    } else if (typeof(user) === 'object' && (user.isSuperAdmin === true || user.isSupport === true)) {
        return true; // user is a SuperAdmin or Support
    }
    return false;
};


/**
 * Checks if a user has permission to perform team-only operations on a Project.
 * @param {Object} project - the project's information object
 * @param {Object} user - the current user's state information object
 * @returns {Boolean} true if has team member permissions, false otherwise
 */
const checkProjectMemberPermission = (project: Project, user: User) => {
    /* Construct Project Team and extract user UUID */
    //let projTeam = constructProjectTeam(project);
    let projTeam: (string|User)[] = [];
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

/**
 * Returns the UI-ready representation of a Project File access/visibility setting.
 *
 * @param {string} access - The internal access setting.
 * @returns {string} The UI-ready representation.
 */
const getFilesAccessText = (access: string) => {
  const foundSetting = [
    ...PROJECT_FILES_ACCESS_SETTINGS,
    { key: 'mixed', text: 'Mixed', value: 'mixed' },
  ].find((setting) => setting.value === access);
  if (foundSetting) {
    return foundSetting.text;
  }
  return 'Unknown';
};

const getFilesLicenseText = (license: License | undefined) => {
    if (license) {
        if(license.name && license.version){
            return `${license.name} (${license.version})`;
        } else if(license.name){
            return license.name.toString();
        }
    }
    return 'Unknown';
}

export {
    PROJECT_FILES_ACCESS_SETTINGS,
    PROJECT_ROLE_SORT_ORDER,
    visibilityOptions,
    statusOptions,
    createTaskOptions,
    classificationOptions,
    classificationDescriptions,
    projectRoleOptions,
    peerReviewPromptTypes,
    peerReviewAuthorTypes,
    getTaskStatusText,
    getClassificationText,
    getClassificationDescription,
    getVisibilityText,
    getPeerReviewAuthorText,
    getFlagGroupName,
    constructProjectTeam,
    checkCanViewProjectDetails,
    checkProjectAdminPermission,
    checkProjectMemberPermission,
    getFilesAccessText,
    getFilesLicenseText,
}