import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import withUserStateDependency from "../../../enhancers/withUserStateDependency.jsx";
import { useTypedSelector } from "../../../state/hooks.js";
import { useMediaQuery } from "react-responsive";
import NavbarDesktop from "./NavbarDesktop.js";
import NavbarMobile from "./NavbarMobile.js";
import EnvironmentBanner from "../EnvironmentBanner.js";
import useClientConfig from "../../../hooks/useClientConfig.js";
import CommonsNavbar from "../../commons/CommonsNavbar/index.js";

const Navbar: React.FC = () => {
  // Global State, Location, and Error Handling
  const location = useLocation();

  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const { isProduction } = useClientConfig();

  // UI
  const [activeItem, setActiveItem] = useState("");

  /**
   * Close the mobile menu when the Tailwind XL breakpoint is reached.
   * @link https://www.npmjs.com/package/react-responsive
   * Must be defined up here to avoid a React Hook error (above return statements).
   */
  const isTailwindXl = useMediaQuery(
    { minWidth: 1280 }, // Tailwind XL breakpoint
    undefined
  );

  /**
   * Subscribe to changes to location
   * and update the Navbar with the
   * active page.
   */
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes("/home")) {
      setActiveItem("home");
    } else if (currentPath.includes("/projects")) {
      setActiveItem("projects");
    } else if (currentPath.includes("analytics")) {
      setActiveItem("analytics");
      // } else if (currentPath.includes("/search")) {
      //   // Set the search query in the UI if the URL was visited directly
      //   if (searchInput === "") {
      //     const urlParams = new URLSearchParams(location.search);
      //     const urlQuery = urlParams.get("query");
      //     if (typeof urlQuery === "string" && urlQuery.length > 0) {
      //       setSearchInput(urlQuery);
      //     }
      //   }
      // } else {
      setActiveItem("");
    }
  }, [
    location,
    setActiveItem,
    //setSearchInput
  ]);

  // If anonymous user is access project analytics, render CommonsNavbar instead for aesthetic purposes
  if (location.pathname.endsWith('/analytics') && !user.isAuthenticated) {
    return <CommonsNavbar org={org} user={user} />;
  } else if (!user.isAuthenticated) {
    return null;
  }

  return (
    <div
      className="nav-menu"
      style={{ height: org.orgID === "libretexts" ? "100px" : "60px" }}
    >
      <EnvironmentBanner />
      {isTailwindXl ? (
        <NavbarDesktop
          org={org}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />
      ) : (
        <NavbarMobile
          org={org}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />
      )}
    </div>
  );
};

export default withUserStateDependency(Navbar);
