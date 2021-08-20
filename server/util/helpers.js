//
// LibreTexts Conductor
// helpers.js
//

/**
 * Checks that the provided argument @str is a string
 * with a (whitespace-removed) length greater than 0.
 */
const isEmptyString = (str) => {
    if (typeof str === 'string') {
        return (!str || str.trim().length === 0 );
    } else {
        return false;
    }
};

/**
 * Constructs a basic array with OrgIDs given
 * an array of Role objects.
 */
const buildOrgArray = (roles) => {
    var orgs = [];
    roles.forEach((item) => {
        if (item.org) {
            orgs.push(item.org);
        }
    });
    return orgs;
}

module.exports = {
    isEmptyString,
    buildOrgArray
};
