import { addDays, subDays } from "date-fns";

export const PRIVACY_QUEUE_SLUG = "privacy";
export const PRIVACY_RESPONSE_DAYS = 30;
export const PRIVACY_APPEAL_RESPONSE_DAYS = 45;
export const PRIVACY_RETENTION_MONTHS = 24;
// Grace period so the requester can still open files linked from the outcome email
export const PRIVACY_REDACTION_DELAY_DAYS = 7;
// Days before due date; for a 30-day request these land on day 20 and day 27
export const PRIVACY_REMINDER_DAYS_BEFORE_DUE = [10, 3];

export const PrivacyRequestTypes = [
  "access",
  "correction",
  "deletion",
  "marketing_opt_out",
  "parent_guardian",
  "legal_disclosure",
  "appeal",
  "general",
] as const;

export const PrivacyIntakeChannels = [
  "support_form",
  "email",
  "postal_mail",
  "phone",
  "institution_referral",
] as const;

export const PrivacyProducts = [
  "libraries",
  "adapt",
  "conductor",
  "libreone",
  "academy_online",
  "connections",
  "forge",
  "jupyterhub",
  "store",
] as const;

export const PrivacyVerificationMethods = [
  "registered_email",
  "signed_in_session",
  "proof_of_authority",
  "could_not_verify",
] as const;

export const PrivacyOutcomes = [
  "fulfilled",
  "partly_fulfilled",
  "denied",
  "referred",
  "withdrawn",
  "could_not_verify",
] as const;

export const PrivacyDenialBases = [
  "identity_not_verified",
  "school_record",
  "legal_obligation",
  "policy_exception",
  "third_party_privacy",
  "other",
] as const;

export type PrivacyRequestType = (typeof PrivacyRequestTypes)[number];
export type PrivacyIntakeChannel = (typeof PrivacyIntakeChannels)[number];
export type PrivacyProduct = (typeof PrivacyProducts)[number];
export type PrivacyVerificationMethod = (typeof PrivacyVerificationMethods)[number];
export type PrivacyOutcome = (typeof PrivacyOutcomes)[number];
export type PrivacyDenialBasis = (typeof PrivacyDenialBases)[number];

export const PrivacyOutcomeLabels: Record<PrivacyOutcome, string> = {
  fulfilled: "Fulfilled",
  partly_fulfilled: "Partly fulfilled",
  denied: "Denied",
  referred: "Referred to institution",
  withdrawn: "Withdrawn",
  could_not_verify: "Could not verify identity",
};

export const PRIVACY_DENIAL_OUTCOMES: PrivacyOutcome[] = [
  "partly_fulfilled",
  "denied",
  "could_not_verify",
];

export interface PrivacyTicketFields {
  dateReceived: Date;
  requestType: PrivacyRequestType;
  intakeChannel: PrivacyIntakeChannel;
  actingForOther?: { isAgent: boolean; note?: string };
  products?: PrivacyProduct[];
  schoolRecord?: { isSchoolRecord: boolean; institution?: string };
  identityVerification?: { method: PrivacyVerificationMethod; date?: Date };
  dueDate: Date;
  extension?: { reason: string; newDueDate: Date; notifiedAt?: Date };
  responseDate?: Date;
  responseOutcome?: PrivacyOutcome;
  responseSummary?: string;
  denialBasis?: { reason: PrivacyDenialBasis; note?: string };
  appealOf?: string;
  appealUUIDs?: string[];
  remindersSent?: number[];
  redactedAt?: Date;
  responseNotifiedAt?: Date;
}

/** Client-correctable privacy ticket rule violation; controllers map it to a 400 */
export class PrivacyTicketError extends Error {}

export function getPrivacyDueDate(
  dateReceived: Date,
  requestType?: string,
): Date {
  return addDays(
    dateReceived,
    requestType === "appeal"
      ? PRIVACY_APPEAL_RESPONSE_DAYS
      : PRIVACY_RESPONSE_DAYS,
  );
}

/**
 * Fields for an existing ticket moved into the privacy queue. Request type can't be inferred,
 * so it starts as a general question for staff to correct; the clock runs from the original open date.
 */
export function getDefaultPrivacyFields(
  timeOpened: string,
  hasSignedInRequester: boolean,
): PrivacyTicketFields {
  const dateReceived = new Date(timeOpened);
  return {
    dateReceived,
    requestType: "general",
    intakeChannel: "support_form",
    dueDate: getPrivacyDueDate(dateReceived, "general"),
    ...(hasSignedInRequester && {
      identityVerification: { method: "signed_in_session", date: dateReceived },
    }),
  };
}

export function isPrivacyDenial(outcome?: string): boolean {
  return !!outcome && PRIVACY_DENIAL_OUTCOMES.includes(outcome as PrivacyOutcome);
}

/** Names of required fields still missing before a privacy ticket may close. */
export function getPrivacyCloseErrors(
  privacy?: Partial<PrivacyTicketFields>,
): string[] {
  if (!privacy) return [];
  const missing: string[] = [];
  if (!privacy.responseDate) missing.push("Response date");
  if (!privacy.responseOutcome) missing.push("Response outcome");
  if (!privacy.responseSummary?.trim()) missing.push("Response summary");
  if (isPrivacyDenial(privacy.responseOutcome)) {
    if (!privacy.denialBasis?.reason) {
      missing.push("Denial basis");
    } else if (
      privacy.denialBasis.reason === "other" &&
      !privacy.denialBasis.note?.trim()
    ) {
      missing.push("Denial basis explanation");
    }
  }
  return missing;
}

export function shouldRedactOnClose(
  privacy?: Partial<PrivacyTicketFields>,
): boolean {
  return (
    privacy?.requestType === "deletion" &&
    (privacy.responseOutcome === "fulfilled" ||
      privacy.responseOutcome === "partly_fulfilled")
  );
}

/** Grace period runs from the outcome email, so a late retry still gives the requester the full window. */
export function isPrivacyRedactionDue(
  privacy: Partial<PrivacyTicketFields> | undefined,
  now: Date = new Date(),
): boolean {
  if (!shouldRedactOnClose(privacy) || privacy?.redactedAt || !privacy?.responseNotifiedAt) return false;
  return now.getTime() >= addDays(privacy.responseNotifiedAt, PRIVACY_REDACTION_DELAY_DAYS).getTime();
}

/**
 * Reminder thresholds reached by `now`, and whether any of them is new.
 * Missed runs collapse into one reminder rather than several.
 */
export function getPrivacyReminderState(
  dueDate: Date,
  sent: number[] = [],
  now: Date = new Date(),
): { reached: number[]; shouldSend: boolean } {
  const reached = PRIVACY_REMINDER_DAYS_BEFORE_DUE.filter(
    (d) => now.getTime() >= subDays(dueDate, d).getTime(),
  );
  return { reached, shouldSend: reached.some((d) => !sent.includes(d)) };
}
