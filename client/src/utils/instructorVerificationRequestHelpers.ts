import { SemanticCOLORS, SemanticICONS } from "semantic-ui-react";
import { InstructorVerifReqStatus } from "../types";

export const purposeOptions = [
  {
    key: "oer",
    text: "Create, contribute, or customize OER content on the LibreTexts Libraries",
    shortText: "Libraries",
    value: "oer",
  },
  {
    key: "h5p",
    text: "Create, contribute, or customize H5P assessments on the LibreStudio",
    shortText: "Studio",
    value: "h5p",
  },
  {
    key: "adapt",
    text: "Create, contribute, or customize homework assignments on ADAPT",
    shortText: "ADAPT",
    value: "adapt",
  },
  {
    key: "analytics",
    text: "Explore student analytics on Conductor",
    shortText: "Analytics",
    value: "analytics",
  },
];

export const STATUS_OPTIONS_DATA: {
  key: InstructorVerifReqStatus;
  heading: string;
  message: string;
  icon: SemanticICONS;
  color: SemanticCOLORS;
  canResubmit: boolean;
}[] = [
  {
    key: "not_attempted",
    heading: "Not Attempted",
    message:
      "You have not yet attempted to submit a request for instructor verification. Please fill out the form below to submit a request.",
    icon: "question circle outline",
    color: "grey",
    canResubmit: true,
  },
  {
    key: "pending",
    heading: "Pending Review",
    message:
      "Your request is currrently in review. Please check back later for updates.",
    icon: "clock outline",
    color: "blue",
    canResubmit: false,
  },
  {
    key: "needs_review",
    heading: "Additional Information Required",
    message:
      "Your request was reviewed, but some information was missing. Please click below to resubmit your request.",
    icon: "question circle outline",
    color: "yellow",
    canResubmit: true,
  },
  {
    key: "denied",
    heading: "Denied",
    message:
      "Your request was denied. If you feel this was in error, please click below to resubmit your request or contact info@libretexts.org for more information.",
    icon: "times circle outline",
    color: "red",
    canResubmit: true,
  },
  {
    key: "verified",
    heading: "Verified",
    message: "Your request was approved and no further action is required. If you need to update your information, you may resubmit a request.",
    icon: "check circle outline",
    color: "green",
    canResubmit: true,
  },
];

/**
 * Returns a UI-ready string of a provided Account Request 'Purpose'.
 *
 * @param {string} purpose - The purpose identifier.
 * @param {boolean} [short=false] - Return the shortened purpose text.
 * @returns {string} The UI-ready purpose text.
 */
export function getPurposeText(purpose: string, short = false) {
  if (typeof purpose !== "string") return "Unknown";
  const foundPurpose = purposeOptions.find((item) => item.value === purpose);
  if (!foundPurpose) {
    return "Unknown";
  }
  if (short) {
    return foundPurpose.shortText;
  }
  return foundPurpose.text;
}
