const buttonActiveStyle = { color: "#0288d1" };
const buttonStyle = { backgroundColor: "rgb(255, 255, 255)" };
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
  info: "#0288d1",
  infoBg: "#bbdefb",
  error: "#d32f2f",
  errorBg: "#ffcdd2",
  success: "#2e7d32",
  successBg: "#c8e6c9",
  warning: "#ed6c02",
  warningBg: "#ffe0b2",
};

export { buttonActiveStyle, buttonStyle, handleMouseEnter, handleMouseLeave, STATUS_PALETTE };