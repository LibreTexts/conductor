//
// LibreTexts Conductor
// ProjectOptions.js
//

const visibilityOptions = [
    { key: 'private', text: 'Private (only collaborators)', value: 'private' },
    { key: 'public', text: 'Public (within Conductor)', value: 'public' }
];

const statusOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'available', text: 'Available', value: 'available' },
    { key: 'open', text: 'Open/In Progress', value: 'open' }
];

const editStatusOptions = [
    { key: 'available', text: 'Available', value: 'available' },
    { key: 'open', text: 'Open/In Progress', value: 'open' }
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

module.exports = {
    visibilityOptions,
    statusOptions,
    editStatusOptions,
    createTaskOptions,
    classificationOptions,
    getTaskStatusText,
    getClassificationText
}
