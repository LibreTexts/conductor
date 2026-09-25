//
// LibreTexts Conductor
// LicenseOptions.js
//

import licenseVersionsData from "../../../../shared/license-versions.json";

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
    { key: 'mixed',      text: 'Multiple Licenses',      value: 'mixed'       }
];

const licenseOptions = [
    { key: 'empty',     text: 'Clear...',       value: '' },
    ...licenses
];

// Licenses and the versions each is issued in. Shared with the server's
// license validation (server/api/validators/Restacker.ts) so they can't drift.
const licenseVersions = licenseVersionsData;

/**
 * Older identifiers that were renamed, mapped to their current value. Stored data
 * (synced books, glossary entries, library page tags) can still use the old names.
 */
const LEGACY_LICENSE_ALIASES = {
    multiple: 'mixed',
};

/**
 * Maps a legacy license identifier to its current value; other values pass through.
 * @param {string} license - The license's raw identifier.
 * @returns {string} The current identifier.
 */
const normalizeLicenseKey = (license) => LEGACY_LICENSE_ALIASES[license] ?? license;

  const getLicenseVersionOptions = (license) => {
    const key = normalizeLicenseKey(license);
    return licenseVersions.find((item) => item.license === key)?.versions || [];
  }

/**
 * Returns `version` only when it is one of the license's versions (e.g. GNU DSL
 * has no 4.0); otherwise an empty string, so a stale version never carries over.
 * @param {string} license - The license's raw identifier.
 * @param {string} [version] - The version key, e.g. '40'.
 * @returns {string} The version key, or '' when it doesn't belong to the license.
 */
const getValidLicenseVersion = (license, version) => {
    if (!version) return '';
    return getLicenseVersionOptions(license).some((item) => item.key === version)
        ? version
        : '';
};

/**
 * Returns the UI-ready presentation of a license title.
 * @param {string} license - The license's raw identifier.
 * @param {string} [version] - The license version in format 'x.x'. Ignored for
 *  licenses that have no versions (e.g. Public Domain), even if one was tagged.
 * @returns {string} The UI-ready license title presentation.
 */
const getLicenseText = (license, version) => {
    if (license !== '') {
        const key = normalizeLicenseKey(license);
        let foundLicense = licenseOptions.find((item) => item.value === key);
        if (foundLicense !== undefined) {
            const hasVersions = getLicenseVersionOptions(license).length > 0;
            if (hasVersions && typeof (version) === 'string' && version !== '') {
                return `${foundLicense.text} ${version}`;
            }
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
    getLicenseVersionOptions,
    getValidLicenseVersion,
    normalizeLicenseKey
};
