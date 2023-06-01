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
  value?: number
): string {
  if (!value) return "Unknown";
  if (type === "3-likert" && value <= threePointLikertOptions.length) {
    return `${threePointLikertOptions[value]} (${value})`;
  }

  if (type === "5-likert" && value <= fivePointLikertOptions.length) {
    return `${fivePointLikertOptions[value]} (${value})`;
  }

  if (type === "7-likert" && value <= sevenPointLikertOptions.length) {
    return `${sevenPointLikertOptions[value]} (${value})`;
  }

  return "Unknown";
}
