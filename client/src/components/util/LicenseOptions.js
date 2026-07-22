//
// LibreTexts Conductor
// LicenseOptions.js
//

const licenses = [
    { key: 'arr',           text: 'All Rights Reserved',    value: 'arr'            },
    { key: 'ccby',          text: 'CC BY',                  value: 'ccby'           },
    { key: 'ccbync',        text: 'CC BY-NC',               value: 'ccbync'         },
    { key: 'ccbyncnd',      text: 'CC BY-NC-ND',            value: 'ccbyncnd'       },
    { key: 'ccbyncsa',      text: 'CC BY-NC-SA',            value: 'ccbyncsa'       },
    { key: 'ccbynd',        text: 'CC BY-ND',               value: 'ccbynd'         },
    { key: 'ccbysa',        text: 'CC BY-SA',               value: 'ccbysa'         },
    { key: 'gnu',           text: 'GNU',                    value: 'gnu'            },
    { key: 'gnudsl',        text: 'GNU DSL',                value: 'gnudsl'         },
    { key: 'gnufdl',        text: 'GNU FDL',                value: 'gnufdl'         },
    { key: 'gnugpl',        text: 'GNU GPL',                value: 'gnugpl'         },
    { key: 'publicdomain',  text: 'Public Domain',          value: 'publicdomain'   },
    { key: 'ck12',          text: 'CK-12 License',          value: 'ck12'           },
    { key: 'multiple',      text: 'Multiple Licenses',      value: 'multiple'       }
];

const licenseOptions = [
    { key: 'empty',     text: 'Clear...',       value: '' },
    ...licenses
];

const licenseVersions = [
    {
      "license": "arr",
      "versions": []
    },
    {
      "license": "ccby",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "ccbync",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "ccbyncnd",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "ccbyncsa",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "ccbynd",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "ccbysa",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "25", "label": "2.5" },
        { "key": "30", "label": "3.0" },
        { "key": "40", "label": "4.0" }
      ]
    },
    {
      "license": "gnu",
      "versions": []
    },
    {
      "license": "gnudsl",
      "versions": [
        { "key": "10", "label": "1.0" }
      ]
    },
    {
      "license": "gnufdl",
      "versions": [
        { "key": "11", "label": "1.1" },
        { "key": "12", "label": "1.2" },
        { "key": "13", "label": "1.3" }
      ]
    },
    {
      "license": "gnugpl",
      "versions": [
        { "key": "10", "label": "1.0" },
        { "key": "20", "label": "2.0" },
        { "key": "30", "label": "3.0" }
      ]
    },
    {
      "license": "publicdomain",
      "versions": []
    },
    {
      "license": "ck12",
      "versions": []
    },
    {
      "license": "multiple",
      "versions": []
    }
  ]

  const getLicenseVersionOptions = (license) => {
    return licenseVersions.find((item) => item.license === license)?.versions || [];
  }

/**
 * Returns the UI-ready presentation of a license title.
 * @param {string} license - The license's raw identifier.
 * @param {string} [version] - The license version in format 'x.x'. 
 * @returns {string} The UI-ready license title presentation.
 */
const getLicenseText = (license, version) => {
    if (license !== '') {
        let foundLicense = licenseOptions.find((item) => item.value === license);
        if (foundLicense !== undefined) {
            if (typeof (version) === 'string') return `${foundLicense.text} ${version}`;
            return foundLicense.text;
        }
        return 'Unknown License';
    }
    return 'Not specified';
};

export {
    licenses,
    licenseOptions,
    getLicenseText,
    getLicenseVersionOptions
};
