//
// LibreTexts Conductor
// PaginationOptions.js
//

const itemsPerPageOptions = [
    { key: '10',    text: '10',     value: 10  },
    { key: '25',    text: '25',     value: 25  },
    { key: '50',    text: '50',     value: 50  },
    { key: '100',   text: '100',    value: 100 }
];

const catalogItemsPerPageOptions = [
    { key: '6',     text: '6',      value: 6  },
    { key: '12',    text: '12',     value: 12 },
    { key: '24',    text: '24',     value: 24 },
    { key: '48',    text: '48',     value: 48 },
    { key: '96',    text: '96',     value: 96 }
];


module.exports = {
    itemsPerPageOptions,
    catalogItemsPerPageOptions
}
