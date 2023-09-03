import "./Launchpad.css";

const Launchpad = () => {
  return (
    <button
      role="link"
      className="app-switcher"
      onClick={() => window.open("https://one.libretexts.org/home", "_blank")}
    >
      <img
        src="https://cdn.libretexts.net/Icons/launchpad-rocket-icon.svg"
        alt="rocket icon"
        className="app-switcher-icon"
      />
    </button>
  );
};

export default Launchpad;
