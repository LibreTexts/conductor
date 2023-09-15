import { CentralIdentityVerificationRequestStatus, GenericKeyTextValueObj } from "../types";

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

/**
 * Valid verification status options for a user
 */
export const verificationStatusOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "not_attempted",
    text: "Not Attempted",
    value: "not_attempted",
  },
  {
    key: "pending",
    text: "Pending",
    value: "pending",
  },
  {
    key: "needs_review",
    text: "Needs Review",
    value: "needs_review",
  },
  {
    key: "verified",
    text: "Verified",
    value: "verified",
  },
  {
    key: "denied",
    text: "Denied",
    value: "denied",
  },
];

/**
 * Valid user type options for a user
 */
export const userTypeOptions: GenericKeyTextValueObj<string>[] = [
  {
    key: "student",
    text: "Student",
    value: "student",
  },
  {
    key: "instructor",
    text: "Instructor",
    value: "instructor",
  }
];

export const verificationRequestStatusOptions: GenericKeyTextValueObj<CentralIdentityVerificationRequestStatus>[] = [
  {
    key: "Open",
    text: "Open",
    value: "open",
  },
  {
    key: "Needs Change",
    text: "Needs Change",
    value: "needs_change",
  },
  {
    key: "Approved",
    text: "Approved",
    value: "approved",
  },
  {
    key: "Denied",
    text: "Denied",
    value: "denied",
  }
]

export const getCentralAuthProfileEditURL = () => {
  return (
    import.meta.env.VITE_CENTRAL_AUTH_EDIT_PROFILE_URL ||
    "https://one.libretexts.org/profile"
  );
};

export const getCentralAuthInstructorURL = () => {
  return (
    import.meta.env.VITE_CENTRAL_AUTH_INSTRUCTOR_URL ||
    "https://one.libretexts.org/instructor"
  );
};
