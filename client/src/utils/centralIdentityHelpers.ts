export function getPrettyUserType(userType: string) {
  switch (userType) {
    case "student":
      return "Student";
    case "instructor":
      return "Instructor";
    default:
      return "Unknown";
  }
}

export function getPrettyVerficationStatus(status: string) {
  switch (status) {
    case "not_attempted":
      return "Not Attempted";
    case "pending":
      return "Pending";
    case "needs_review":
      return "Needs Review";
    case "verified":
      return "Verified";
    case "denied":
      return "Denied";
    default:
      return "Unknown";
  }
}

export function getPrettyAuthSource(source: string) {
  switch (source) {
    case "MicrosoftActiveDirectory":
      return "Microsoft Active Directory";
    case "GoogleWorkspace":
      return "Google Workspace";
    default:
      return "Unknown";
  }
}

/**
 * Used to get the pretty name of a user's account status in relation
 * to the disabled field in the database (hence the negation of the value)
 */
export const accountStatusOptions = [
  { key: "enabled", text: "Enabled", value: false },
  { key: "disabled", text: "Disabled", value: true },
];
