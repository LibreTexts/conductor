import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import withUserStateDependency from "../../../enhancers/withUserStateDependency.jsx";
import { useTypedSelector } from "../../../state/hooks.js";
import NavbarShell from "./NavbarShell.js";
import EnvironmentBanner from "../EnvironmentBanner.js";
import useClientConfig from "../../../hooks/useClientConfig.js";
import CommonsNavbar from "../../commons/CommonsNavbar/index.js";
import { SkipLink } from "@libretexts/davis-react";

const Navbar: React.FC = () => {
  const location = useLocation();

  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const { isProduction } = useClientConfig();

  const [activeItem, setActiveItem] = useState("");

  /**
   * Subscribe to route changes and update the active nav item.
   */
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes("/home")) {
      setActiveItem("home");
    } else if (currentPath.includes("/projects")) {
      setActiveItem("projects");
    } else if (currentPath.includes("analytics")) {
      setActiveItem("analytics");
    } else {
      setActiveItem("");
    }
  }, [location]);

  // If an anonymous user is accessing project analytics, render CommonsNavbar for aesthetic purposes
  if (location.pathname.endsWith("/analytics") && !user.isAuthenticated) {
    return <CommonsNavbar org={org} user={user} />;
  } else if (!user.isAuthenticated) {
    return null;
  }

  return (
    <header
      className="fixed top-0 left-0 w-full z-[100] bg-white flex flex-col"
      style={{ height: isProduction ? "60px" : "100px" }}
    >
      <SkipLink targetId="main-content" />
      <EnvironmentBanner />
      <nav
        aria-label="Main navigation"
        className="w-full flex-1 flex flex-col justify-center"
      >
        <NavbarShell
          org={org}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />
      </nav>
    </header>
  );
};

export default withUserStateDependency(Navbar);
