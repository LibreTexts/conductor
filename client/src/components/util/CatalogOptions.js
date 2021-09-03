const catalogDisplayOptions = [
    { key: 'visual', text: 'Visual Mode', value: 'visual' },
    { key: 'itemized', text: 'Itemized Mode', value: 'itemized' }
];

const catalogLocationOptions = [
    { key: 'central', text: 'Central Bookshelves', value: 'central' },
    { key: 'campus', text: 'Campus Bookshelves', value: 'campus' },
    { key: 'learning', text: 'Learning Objects', value: 'learning', disabled: true }
];

module.exports = {
    catalogDisplayOptions,
    catalogLocationOptions
}
