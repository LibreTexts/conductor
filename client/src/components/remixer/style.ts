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

export { buttonActiveStyle, buttonStyle, handleMouseEnter, handleMouseLeave };