//
// LibreTexts Conductor
// conductor-errors.js
//

/* The collection of system-wide errors */
const conductorErrors = {
  err1: "Required field is missing or malformed.",
  err2: "Invalid fields supplied.",
  err3: "An error occured saving information to the database.",
  err4: "This tool is not available to this organization.",
  err5: "Invalid authorization token. Try signing out and in again.",
  err6: "Sorry, we seem to have encountered an internal error.",
  err7: "Couldn't find a user with that identifier.",
  err8: "Sorry, you aren't authorized to perform that action.",
  err9: "Unable to verify user attribute(s).",
  err10: "Your account does not appear to be associated with any organization.",
  err11: "A resource with that identifier was not found.",
  err12: "Incorrect username or password.",
  err13: "Commons-Libraries sync appears to have failed. Check server logs.",
  err14: "Sorry, we're having trouble connecting to ADAPT Commons.",
  err15: "Syncing with ADAPT appears to have failed. Check server logs.",
  err16:
    "Oops, it looks like the LibreTexts API is temporarily unavailable. Refresh and try again in a moment.",
  err17: "Please wait at least two minutes between password reset attempts.",
  err18: "No password reset session was found for this user.",
  err19:
    "Oops, this reset token may be expired. Please try resetting your password again.",
  err20:
    "Your account appears to be provisioned via SSO. Please reset your password using your Central Authentication Provider's methods.",
  err21: "Invalid reset token. Please try resetting your password again.",
  err22: "Sorry, we're having trouble retrieving that data.",
  err23: "Incorrect current password.",
  err24: "Specified parent task not found.",
  err25:
    "A task can't be marked completed until its dependencies are completed.",
  err26: "A user must be a project team member to be assigned to a task.",
  err27: "A subtask cannot be dependent on its parent task.",
  err28:
    "Oops, this project must have a libretexts.org Project URL saved to complete this request.",
  err29:
    "Oops, this resource appears to have its access restriced or privated.",
  err30: "A task can't be marked completed until its subtasks are completed.",
  err31: "A task cannot be dependent on itself.",
  err32: "Oops, this project does not have a Project Liaison specified.",
  err33: "A task's end date cannot be before its start date.",
  err44: "Oops, at least one team member must be a Project Lead.",
  err45:
    "Sorry, we're having trouble retrieving or generating this data export.",
  err46:
    "Oops, an account with this email has already been registered using traditional authentication.",
  err47: "Oops, a user with that email already exists.",
  err48: "Sorry, we're having trouble finding a Peer Review Rubric to use.",
  err49: "Oops, this review is missing required responses.",
  err50: "Oops, Peer Reviews must have at least one response to be saved.",
  err51: "Oops, a Dropdown Prompt requires at least one response option.",
  err52:
    "Oops, this Project's settings do not allow reviews from non-team members.",
  err53:
    "Sorry, we encountered an error uploading your file. Please check its format and size.",
  err54: "Oops, avatar files must be smaller than 5 MB.",
  err55: "Sorry, we're having trouble validating your file.",
  err56: "Sorry, we encountered an error while processing your file.",
  err57: "Sorry, we're having trouble saving your file.",
  err58: "Encountered an error deleting file(s). Try again in a moment.",
  err59:
    "Warning: Some files may not have been moved properly. Try deleting them manually.",
  err60: "Oops, materials files must be smaller than 25 MB.",
  err61: "Please provide at least one file.",
  err62: "Filenames cannot contain slashes.",
  err63: "Couldn't find a file with that identifier.",
  err64: "File cannot be uploaded to this location.",
  err65: "A folder name must be provided.",
  err66: "Sorry, that operation can't be performed on this resource.",
  err67: "Access Denied: Invalid client secret provided.",
  err68:
    "Access Denied: Unable to compute authorization code or access token expiration time.",
  err69: "Access Denied: Provided authorization grant is expired or invalid.",
  err70: "Access Denied: Access token is expired or invalid.",
  err71: "Access Denied: Invalid request parameters provided.",
  err72: "C-ID Descriptors sync appears to have failed. Check server logs.",
  err73: "Invalid library selections provided.",
  err74: "Missing instructor profile data.",
  err75:
    "At least one of a LibreTexts textbook URL or an ADAPT Analytics Sharing Key must be provided.",
  err76: "Provided Textbook URL is invalid, private, or not a book coverpage.",
  err77: "Provided ADAPT Analytics Sharing Key is invalid.",
  err78: "Course end date cannot be before start date.",
  err79: "Oops, branding asset files must be smaller than 5 MB.",
  err80: "Oops, another Project already has that Book associated with it.",
  err81: "Oops, your fee waiver code is invalid or expired.",
  err82: "Oops, it looks like you've already registered for this event.",
  err83: "Oops, a fee waiver with that name already exists for this event.",
  err84: "Unable to create new coverpage.",
  err85: "Unable to create chapter.",
  err86:
    "Unable to create book. Please check that your book title is unique to its library and try again.",
  err89: "Ticket is not in a valid status for this action.",
  err90: "Cannot get embed code for non-public resource.",
  err91: "Sorry, you can't remove your own role(s). Please contact our Support Center for assistance.",
  err92: "Sorry, an internal error occurred as a result of internal misconfiguration. Please contact our Support Center for assistance.",
};

export default conductorErrors;
