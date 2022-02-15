//
// LibreTexts Conductor
// LicenseOptions.js
//

const licenses = [
    { key: 'arr',           text: 'All Rights Reserved',    value: 'arr'            },
    { key: 'ccby',          text: 'CC-BY',                  value: 'ccby'           },
    { key: 'ccbync',        text: 'CC-BY-NC',               value: 'ccbync'         },
    { key: 'ccbyncnd',      text: 'CC-BY-NC-ND',            value: 'ccbyncnd'       },
    { key: 'ccbyncsa',      text: 'CC-BY-NC-SA',            value: 'ccbyncsa'       },
    { key: 'ccbynd',        text: 'CC-BY-ND',               value: 'ccbynd'         },
    { key: 'ccbysa',        text: 'CC-BY-SA',               value: 'ccbysa'         },
    { key: 'gnu',           text: 'GNU',                    value: 'gnu'            },
    { key: 'gnudsl',        text: 'GNU DSL',                value: 'gnudsl'         },
    { key: 'gnufdl',        text: 'GNU FDL',                value: 'gnufdl'         },
    { key: 'gnugpl',        text: 'GNU GPL',                value: 'gnugpl'         },
    { key: 'publicdomain',  text: 'Public Domain',          value: 'publicdomain'   },
    { key: 'ck12',          text: 'CK-12 License',          value: 'ck12'           },
    { key: 'mixed',         text: 'Mixed Licenses',         value: 'mixed'          }
];

const licenseOptions = [
    { key: 'empty',     text: 'Clear...',       value: '' },
    ...licenses
];

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
    getLicenseText
}
