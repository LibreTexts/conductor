/**
 * Returns the hex color code for UI presentation of a given content license.
 * @param {String} license - the license identifier to lookup
 * @returns {String} the license's hex color code
 */
const getLicenseColor = (license) => {
    // Colors are (at least) WCAG AA compliant on a pure white background
    let licenseColors = {
        arr:            '#e52107',
        ccbyncnd:       '#92348c',
        ccbynd:         '#d82d79',
        ccbyncsa:       '#0a7fa0',
        ccbync:         '#b21e38',
        ccbysa:         '#0051d8',
        ccby:           '#9255de',
        gnu:            '#6a7d00',
        gnufdl:         '#008480',
        gnudsl:         '#4865ff',
        ck12:           '#a4684d',
        publicdomain:   '#018715',
        fairuse:        '#CF4900',
        notset:         '#001F3F'
    };
    if (typeof(license) === 'string' && licenseColors.hasOwnProperty(license)) {
        return licenseColors[license];
    }
    return '';
};

/**
 * Returns the UI-ready name of a library shelving area.
 *
 * @param {string} shelves - The internal shelving area identifier. 
 * @returns {string} The UI-ready shelves name.
 */
const getShelvesNameText = (shelves) => {
  if (typeof (shelves) === 'string') {
    if (shelves === 'central') {
      return 'Central Bookshelves';
    }
    return 'Campus Bookshelves';
  }
  return 'Unknown';
};

export {
    getLicenseColor,
    getShelvesNameText
}