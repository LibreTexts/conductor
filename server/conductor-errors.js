//
// LibreTexts Conductor
// conductor-errors.js
//

/* The collection of system-wide errors */
const conductorErrors = {
    'err1': "Required field is missing or malformed.",
    'err2': "Invalid fields supplied.",
    'err3': "An error occured saving information to the database.",
    'err4': "This tool is not available to this organization.",
    'err5': "Invalid authorization token. Try signing out and in again.",
    'err6': "Oops, we seemed to have encountered an internal error.",
    'err7': "Couldn't find a user with that identifier.",
    'err8': "Sorry, you aren't authorized to perform that action.",
    'err9': "Unable to verify user attribute(s).",
    'err10': "Your account does not appear to be associated with any organization.",
    'err11': "A resource with that identifier was not found.",
    'err12': "Incorrect username or password.",
    'err13': "Commons-Libraries sync appears to have failed. Check server logs.",
    'err14': "Sorry, we're having trouble connecting to ADAPT Commons.",
    'err15': "Syncing with ADAPT appears to have failed. Check server logs.",
    'err16': "Oops, it looks like the LibreTexts API is temporarily unavailable. Refresh and try again in a moment."
};

module.exports = conductorErrors;
