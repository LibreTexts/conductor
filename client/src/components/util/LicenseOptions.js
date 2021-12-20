//
// LibreTexts Conductor
// LicenseOptions.js
//

const licenses = [
    { key: 'arr',           text: 'All Rights Reserved',    value: 'arr' },
    { key: 'ccby',          text: 'CC-BY',                  value: 'ccby' },
    { key: 'ccbync',        text: 'CC-BY-NC',               value: 'ccbync' },
    { key: 'ccbyncnd',      text: 'CC-BY-NC-ND',            value: 'ccbyncnd' },
    { key: 'ccbyncsa',      text: 'CC-BY-NC-SA',            value: 'ccbyncsa' },
    { key: 'ccbynd',        text: 'CC-BY-ND',               value: 'ccbynd' },
    { key: 'ccbysa',        text: 'CC-BY-SA',               value: 'ccbysa' },
    { key: 'gnu',           text: 'GNU',                    value: 'gnu' },
    { key: 'gnudsl',        text: 'GNU DSL',                value: 'gnudsl' },
    { key: 'gnufdl',        text: 'GNU FDL',                value: 'gnufdl' },
    { key: 'gnugpl',        text: 'GNU GPL',                value: 'gnugpl' },
    { key: 'publicdomain',  text: 'Public Domain',          value: 'publicdomain' },
    { key: 'mixed',         text: 'Mixed Licenses',         value: 'mixed' }
];

const licenseOptions = [
    { key: 'empty',     text: 'Clear...',       value: "" },
    ...licenses
];


const getLicenseText = (license) => {
    if (license !== '') {
        let foundLicense = licenseOptions.find((item) => {
            return item.value === license;
        });
        if (foundLicense !== undefined) {
            return foundLicense.text;
        } else {
            return 'Unknown license';
        }

    } else {
        return 'Not specified';
    }
};

module.exports = {
    licenses,
    licenseOptions,
    getLicenseText
}
