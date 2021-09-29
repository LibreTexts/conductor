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

module.exports = {
    visibilityOptions,
    statusOptions,
    editStatusOptions
}
