import { COLORS, INTERACTIVE } from "@libretexts/davis-core";

import "./davisRemixerButtons.css";

/** `className` strings for Davis theme surfaces (davis-react IconButton, Semantic UI Button, Dropdown.Item). */
export const DAVIS_REMIXER_BTN_CLASS = {
  base: "davis-remixer-btn",
  success: "davis-remixer-btn davis-remixer-btn--success",
  danger: "davis-remixer-btn davis-remixer-btn--danger",
  neutral: "davis-remixer-btn davis-remixer-btn--neutral",
  menuItem: "davis-remixer-menu-item",
  menuPrimary: "davis-remixer-menu-item davis-remixer-menu-item--primary",
  menuSuccess: "davis-remixer-menu-item davis-remixer-menu-item--success",
  menuDanger: "davis-remixer-menu-item davis-remixer-menu-item--danger",
} as const;

/** `className` strings for Davis-themed links in remixer surfaces. */
export const DAVIS_REMIXER_LINK_CLASS = {
  external: "davis-remixer-link",
} as const;

/** Checkbox layouts in remixer forms (label left, control right). */
export const DAVIS_REMIXER_CHECKBOX_CLASS = {
  labelLeft: "davis-remixer-checkbox--label-left",
} as const;

const buttonActiveStyle = { color: COLORS.primary[500] };
const buttonStyle = { backgroundColor: COLORS.neutral[50] };
const handleMouseEnter: React.MouseEventHandler<HTMLButtonElement> = (
  event,
) => {
  event.currentTarget.style.backgroundColor = "#afafaf";
};
const handleMouseLeave: React.MouseEventHandler<HTMLButtonElement> = (
  event,
) => {
  event.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)";
};

const STATUS_PALETTE = {
  info: COLORS.primary[500],
  infoBg: COLORS.primary[100],
  infoHover: INTERACTIVE.primaryHover,
  infoBgHover: COLORS.primary[200],

  error: COLORS.danger[500],
  errorBg: COLORS.danger[100],
  errorHover: INTERACTIVE.dangerHover,
  errorBgHover: COLORS.danger[200],

  success: COLORS.success[500],
  successBg: COLORS.success[100],
  successHover: INTERACTIVE.successHover,
  successBgHover: COLORS.success[200],

  warning: COLORS.warning[500],
  warningBg: COLORS.warning[100],
  warningHover: INTERACTIVE.warningHover,
  warningBgHover: COLORS.warning[200],

  neutral: COLORS.neutral[500],
  neutralBg: COLORS.neutral[100],
  neutralHover: INTERACTIVE.tertiaryHover,
  neutralBgHover: COLORS.neutral[200],
};

export { buttonActiveStyle, buttonStyle, handleMouseEnter, handleMouseLeave, STATUS_PALETTE };