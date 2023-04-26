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
