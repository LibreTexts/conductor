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
    'err6': "Sorry, we seem to have encountered an internal error.",
    'err7': "Couldn't find a user with that identifier.",
    'err8': "Sorry, you aren't authorized to perform that action.",
    'err9': "Unable to verify user attribute(s).",
    'err10': "Your account does not appear to be associated with any organization.",
    'err11': "A resource with that identifier was not found.",
    'err12': "Incorrect username or password.",
    'err13': "Commons-Libraries sync appears to have failed. Check server logs.",
    'err14': "Sorry, we're having trouble connecting to ADAPT Commons.",
    'err15': "Syncing with ADAPT appears to have failed. Check server logs.",
    'err16': "Oops, it looks like the LibreTexts API is temporarily unavailable. Refresh and try again in a moment.",
    'err17': "Please wait at least two minutes between password reset attempts.",
    'err18': "No password reset session was found for this user.",
    'err19': "Oops, this reset token may be expired. Please try resetting your password again.",
    'err20': "Your account appears to be provisioned via SSO. Please reset your password using your Central Authentication Provider's methods.",
    'err21': "Invalid reset token. Please try resetting your password again.",
    'err22': "Sorry, we're having trouble retrieving that data.",
    'err23': "Incorrect current password.",
    'err24': "Specified parent task not found.",
    'err25': "A task can't be marked completed until its dependencies are completed.",
    'err26': "A user must be a project team member to be assigned to a task.",
    'err27': "A subtask cannot be dependent on its parent task.",
    'err28': "Oops, this project must have a libretexts.org Project URL saved to complete this request.",
    'err29': "Oops, this resource appears to have its access restriced or privated.",
    'err30': "A task can't be marked completed until its subtasks are completed.",
    'err31': "A task cannot be dependent on itself.",
    'err32': "Oops, this project does not have a Project Liaison specified.",
    'err33': "A task's end date cannot be before its start date.",
    'err44': "Oops, at least one team member must be a Project Lead.",
    'err45': "Sorry, we're having trouble retrieving or generating this data export.",
    'err46': "Oops, an account with this email has already been registered using traditional authentication.",
    'err47': "Oops, a user with that email already exists.",
    'err48': "Sorry, we're having trouble finding a Peer Review Rubric to use.",
    'err49': "Oops, this review is missing required responses.",
    'err50': "Oops, Peer Reviews must have at least one response to be saved.",
    'err51': "Oops, a Dropdown Prompt requires at least one response option.",
    'err52': "Oops, this Project's settings do not allow reviews from non-team members."
};

module.exports = conductorErrors;
