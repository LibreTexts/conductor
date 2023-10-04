import { useEffect, useState } from "react";
import { useLocation, Switch, Route } from "react-router-dom";
import axios from "axios";
import CommonsBook from "./screens/commons/Book";
import CommonsCatalog from "./components/commons/CommonsCatalog";
import CommonsCollections from "./components/commons/CommonsCollections";
import CommonsCollectionView from "./components/commons/CommonsCollectionView";
import CommonsFooter from "./components/commons/CommonsFooter";
import CommonsHomework from "./components/commons/CommonsHomework";
import CommonsJumbotron from "./components/commons/CommonsJumbotron";
import CommonsMenu from "./components/commons/CommonsMenu";
import CommonsNavbar from "./components/commons/CommonsNavbar";
import CommonsUnderDevelopment from "./components/commons/CommonsUnderDevelopment";
import SystemAnnouncement from "./components/util/SystemAnnouncement";
import withUserStateDependency from "./enhancers/withUserStateDependency";
import "./components/commons/Commons.css";
import { useTypedSelector } from "./state/hooks";
import { Announcement } from "./types";

/**
 * The public-facing catalog and showcase application.
 */
const Commons = () => {
  // Global State and Location
  const location = useLocation();
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const LAUNCHPAD_URL = "https://one.libretexts.org/launchpad";

  // Navbar state
  const [showNavMobileMenu, setShowNavMobileMenu] = useState(false);
  const [showNavMobileCommonsList, setShowNavMobileCommonsList] =
    useState(false);

  // Menu state
  const [activeItem, setActiveItem] = useState("");

  // System Announcement
  const [systemAnnouncement, setSystemAnnouncement] =
    useState<Announcement | null>(null);

  /**
   * Check for any available global System Announcements on load.
   */
  useEffect(() => {
    loadSystemAnnouncements();
  }, []);

  /**
   * Subscribe to changes to location and update the Menu with the active page.
   */
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes("/collection")) {
      setActiveItem("collections");
    } else if (currentPath.includes("/homework")) {
      setActiveItem("homework");
    } else if (currentPath.includes("/libraries")) {
      window.location.href = LAUNCHPAD_URL; // Redirects to the LibreTexts Launchpad.
    } else if (currentPath.includes("/underdevelopment")) {
      setActiveItem("underdevelopment");
    } else {
      setActiveItem("catalog");
    }
  }, [location.pathname]);

  async function loadSystemAnnouncements() {
    try {
      const res = await axios.get("/announcements/system");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.sysAnnouncement !== null) {
        setSystemAnnouncement(res.data.sysAnnouncement);
      }
    } catch (err) {
      console.error(err); // fail silently
    }
  }

  /**
   * Toggles state for the Navbar mobile menu.
   */
  const handleNavMobileMenuToggle = () => {
    if (!showNavMobileMenu === false) {
      setShowNavMobileCommonsList(false); // also hide commons list if menu is hidden
    }
    setShowNavMobileMenu(!showNavMobileMenu);
  };

  /**
   * Toggles state for the Navbar mobile commons list.
   */
  const handleNavMobileCommonsListToggle = () => {
    setShowNavMobileCommonsList(!showNavMobileCommonsList);
  };

  return (
    <div className="commons">
      <CommonsNavbar
        org={org}
        user={user}
        commonsTitle={
          org.orgID === "libretexts" ? "LibreCommons" : "Campus Commons"
        }
        showMobileMenu={showNavMobileMenu}
        showMobileCommonsList={showNavMobileCommonsList}
        onMobileMenuToggle={handleNavMobileMenuToggle}
        onMobileCommonsListToggle={handleNavMobileCommonsListToggle}
      />
      <CommonsJumbotron backgroundURL={org.coverPhoto ?? ""} />
      <CommonsMenu activeItem={activeItem} />
      {systemAnnouncement && (
        <SystemAnnouncement
          title={systemAnnouncement.title}
          message={systemAnnouncement.message}
        />
      )}
      <Switch>
        <Route exact path="/" component={CommonsCatalog} />
        <Route exact path="/catalog" component={CommonsCatalog} />
        <Route exact path="/collections" component={CommonsCollections} />
        {org.orgID === "libretexts" && [
          <Route
            exact
            path="/homework"
            key="homework"
            component={CommonsHomework}
          />,
          <Route
            exact
            path="/underdevelopment"
            key="underdev"
            component={CommonsUnderDevelopment}
          />,
        ]}
        <Route exact path="/collection/:id" component={CommonsCollectionView} />
        <Route exact path="/book/:id" component={CommonsBook} />
      </Switch>
      <CommonsFooter />
    </div>
  );
};

export default withUserStateDependency(Commons);
