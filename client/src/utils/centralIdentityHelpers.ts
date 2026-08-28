import {
  CentralIdentityVerificationRequestStatus,
  GenericKeyTextValueObj,
} from "../types";

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
  },
];

export const verificationRequestStatusOptions: GenericKeyTextValueObj<CentralIdentityVerificationRequestStatus>[] =
  [
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
    },
  ];

export const academyOnlineAccessLevels: GenericKeyTextValueObj<number>[] = [
  {
    key: "0",
    text: "No Access/Not Assigned",
    value: 0,
  },
  {
    key: "1",
    text: "LibreTexts Team (Reserved)",
    value: 1,
  },
  {
    key: "2",
    text: "LibreNet Admin (Reserved)",
    value: 2,
  },
  {
    key: "3",
    text: "General Subscriber",
    value: 3,
  },
  {
    key: "4",
    text: "ADAPT Subscriber",
    value: 4,
  }
]

export const getPrettyAcademyOnlineAccessLevel = (level: number) => {
  const accessLevel = academyOnlineAccessLevels.find(
    (access) => access.value === level
  );
  return accessLevel ? `${level} - ${accessLevel.text}` : "Unknown";
}

export const getCentralAuthInstructorURL = () => {
  return "https://one.libretexts.org/instructor";
};
/**
 * Converts the Semantic-era `{ key, text, value }` option shape used throughout
 * this file into the `{ value, label }` shape Davis' `Select` expects. Davis
 * `Select` is string-valued only, so numeric option sets (e.g. Academy Online
 * access levels) are stringified here and must be coerced back by the caller.
 */
export function toSelectOptions<T extends string | number>(
  options: GenericKeyTextValueObj<T>[]
): { value: string; label: string }[] {
  return options.map((opt) => ({
    value: String(opt.value),
    label: opt.text,
  }));
}

/**
 * Human-readable summary of the password rules enforced client-side. LibreOne itself
 * scores passwords with zxcvbn rather than static rules, so this is a courtesy check
 * that catches obvious mistakes before a round trip. The server's rejection is
 * authoritative and must still render cleanly.
 */
export const PASSWORD_RULES_TEXT =
  "Must be at least 10 characters and include at least 1 number and 1 special character.";

export const MIN_PASSWORD_LENGTH = 10;

export function meetsPasswordRules(value: string): boolean {
  if (!value || value.length < MIN_PASSWORD_LENGTH) return false;
  if (!/\d/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}

const PASSWORD_POOLS = [
  "abcdefghijkmnopqrstuvwxyz", // no 'l'
  "ABCDEFGHJKLMNPQRSTUVWXYZ", // no 'I' or 'O'
  "23456789", // no '0' or '1'
  "!@#$%^&*-_=+?",
];

/**
 * Returns a uniformly distributed integer in [0, max) using the Web Crypto API.
 * Rejection sampling discards values in the final partial bucket, which is what
 * keeps a plain modulo from skewing toward the low end of the range.
 */
function randomInt(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

function randomChar(pool: string): string {
  return pool.charAt(randomInt(pool.length));
}

/**
 * Generates a password guaranteed to contain at least one character from each pool,
 * so it always satisfies `meetsPasswordRules` and comfortably clears zxcvbn's
 * threshold. Visually ambiguous characters (l/I/O/0/1) are excluded because these
 * passwords get read aloud or retyped by the user they are handed to.
 */
export function generateSecurePassword(length = 16): string {
  const minLength = Math.max(length, PASSWORD_POOLS.length, MIN_PASSWORD_LENGTH);
  const combined = PASSWORD_POOLS.join("");
  const chars = PASSWORD_POOLS.map((pool) => randomChar(pool));

  while (chars.length < minLength) {
    chars.push(randomChar(combined));
  }

  // Fisher-Yates, so the guaranteed characters aren't pinned to the first four slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
