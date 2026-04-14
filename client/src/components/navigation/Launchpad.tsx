import "./Launchpad.css";

const Launchpad = () => {
  return (
    <button
      role="link"
      className="app-switcher"
      onClick={() => window.open("https://one.libretexts.org/home", "_blank")}
      aria-label="Open LibreTexts Launchpad in new tab"
    >
      <img
        src="https://cdn.libretexts.net/Icons/launchpad-rocket-icon.svg"
        alt="" // Decorative image, so alt text is empty to be ignored by screen readers
        className="app-switcher-icon"
      />
    </button>
  );
};

export default Launchpad;
