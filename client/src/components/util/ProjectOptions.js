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

module.exports = {
    visibilityOptions,
    statusOptions,
    editStatusOptions,
    createTaskOptions,
    getTaskStatusText
}
