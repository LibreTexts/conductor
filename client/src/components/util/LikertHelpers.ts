import { CustomFormPromptType } from "../../types";

export const threePointLikertOptions = ["Disagree", "Neutral", "Agree"];

export const fivePointLikertOptions = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

export const sevenPointLikertOptions = [
  "Strongly Disagree",
  "Disagree",
  "Somewhat Disagree",
  "Neutral",
  "Somewhat Agree",
  "Agree",
  "Strongly Agree",
];

export function getLikertResponseText(
  type: CustomFormPromptType,
  rawValue?: number
): string {
  if (!rawValue) return "Unknown";
  const optValue = rawValue - 1;
  if (optValue < 0) return 'Unknown';

  if (type === "3-likert" && optValue <= threePointLikertOptions.length) {
    return `${threePointLikertOptions[optValue]} (${rawValue})`;
  }

  if (type === "5-likert" && optValue <= fivePointLikertOptions.length) {
    return `${fivePointLikertOptions[optValue]} (${rawValue})`;
  }

  if (type === "7-likert" && optValue <= sevenPointLikertOptions.length) {
    return `${sevenPointLikertOptions[optValue]} (${rawValue})`;
  }

  return "Unknown";
}
