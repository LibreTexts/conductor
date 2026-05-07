import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import withUserStateDependency from "../../../enhancers/withUserStateDependency.jsx";
import { useTypedSelector } from "../../../state/hooks.js";
import NavbarShell from "./NavbarShell.js";
import EnvironmentBanner from "../EnvironmentBanner.js";
import useClientConfig from "../../../hooks/useClientConfig.js";
import { Button } from "@libretexts/davis-react";
import { NavbarContext } from "../../../types/index.js";
import {
  IconLifebuoy,
  IconShoppingCart,
  IconTicket,
} from "@tabler/icons-react";
import UserDropdown from "../UserDropdown.js";
import AboutOrgLink from "../AboutOrgLink.js";
import DonateLink from "../DonateLink.js";
import AccountRequestLink from "../AccountRequestLink.js";
import StoreLink from "../StoreLink.js";
import CommonsList from "../CommonsList.js";
import SupportDropdown from "../SupportDropdown.js";
import UserAuthButton from "../UserAuthButton.js";
import SearchForm from "./SearchForm.js";
import { useCart } from "../../../context/CartContext.js";
import SwitchApp from "../SwitchApp.jsx";
import { COMMONS_PATHS } from "../../../Platform.js";

// ─── Conductor nav items ──────────────────────────────────────────────────────
const menuItemBase =
  "flex items-center px-3 py-2 text-base font-medium transition-colors min-h-[44px] " +
  "hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const menuItemActive = "text-primary font-semibold border-b-2 border-primary";
const menuItemInactive = "text-text hover:text-primary";

interface ConductorNavItemsProps {
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const ConductorNavItems: React.FC<ConductorNavItemsProps> = ({
  activeItem,
  setActiveItem,
}) => (
  <>
    <li>
      <Link
        to="/home"
        className={`${menuItemBase} ${activeItem === "home" ? menuItemActive : menuItemInactive}`}
        aria-current={activeItem === "home" ? "page" : undefined}
        onClick={() => setActiveItem("home")}
      >
        Home
      </Link>
    </li>
    <li>
      <Link
        to="/projects"
        className={`${menuItemBase} ${activeItem === "projects" ? menuItemActive : menuItemInactive}`}
        aria-current={activeItem === "projects" ? "page" : undefined}
        onClick={() => setActiveItem("projects")}
      >
        My Projects
      </Link>
    </li>
  </>
);

/**
 * Single navbar orchestrator for all app contexts (conductor, commons, store, support).
 * Resolves logo props, owns per-context state, composes named slot content, and
 * delegates layout to NavbarShell. All context branching lives here so NavbarShell
 * remains a stable, context-agnostic layout frame.
 */
const Navbar: React.FC<{}> = () => {
  const location = useLocation();

  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const { productCount } = useCart();
  const { isProduction } = useClientConfig();

  const [context, setContext] = useState<NavbarContext>("conductor");
  const [activeItem, setActiveItem] = useState("");

  // Determine context
  useEffect(() => {
    const pathname = location.pathname;
    if (pathname.startsWith("/store")) {
      setContext("store");
    }
    else if (pathname.startsWith("/support") || pathname.startsWith("/insight")) {
      setContext("support");
    }
    else if (pathname === "/" || COMMONS_PATHS.some((path) => pathname.startsWith(path))) {
      setContext("commons");
    } else {
      setContext("conductor");
    }
  }, [location.pathname]);

  // Conductor: sync active nav item with route changes.
  useEffect(() => {
    if (context !== "conductor") return;
    const p = location.pathname;
    if (p.includes("/home")) setActiveItem("home");
    else if (p.includes("/projects")) setActiveItem("projects");
    else if (p.includes("analytics")) setActiveItem("analytics");
    else setActiveItem("");
  }, [location, context]);

  // Conductor only: suppress the navbar for unauthenticated users.
  if (context === "conductor") {
    if (location.pathname.endsWith("/analytics") && !user.isAuthenticated) {
      // TODO: Render as a limited CommonsNavbar instead of returning null
      return null;
    }
    if (!user.isAuthenticated) return null;
  }

  const getLogoSrc = () => {
    if (context === "conductor") {
      if (org.mediumLogo && org.orgID !== "libretexts") {
        return org.mediumLogo;
      }
      return "https://cdn.libretexts.net/Logos/conductor_full.png";
    }

    if (context === "commons") {
      if (org.mediumLogo && org.orgID !== "libretexts") {
        return org.mediumLogo;
      }
      return "https://cdn.libretexts.net/Logos/commons_full.png";
    }

    return "https://cdn.libretexts.net/Logos/libretexts_full.png"; // fallback to LibreTexts full logo
  }

  const getLogoLockupText = () => {
    if (context === "support") {
      return "| Support Center";
    }
    if (context === "store") {
      return "| Store";
    }
    return undefined;
  }

  const getLogoLinkTo = () => {
    if (context === "conductor") {
      return "/home";
    }
    if (context === "commons") {
      return "/";
    }
    if (context === "support") {
      return "/support";
    }
    if (context === "store") {
      return "/store";
    }
    return "/";
  }

  const getLogoLabel = () => {
    if (context === "conductor") {
      return `${org.shortName ?? org.name} Conductor Home`;
    }

    if (context === "commons") {
      return `${org.name} Commons — Catalog Home`;
    }
    if (context === "support") {
      return "LibreTexts Support Center Home";
    }
    if (context === "store") {
      return "LibreTexts Store Home";
    }
    return "LibreTexts Home";
  }

  const pageTitle = context === "commons" ? org.name : undefined;

  // ── Slot composition ──────────────────────────────────────────────────────
  let desktopNavItems: React.ReactNode = null;
  let desktopActions: React.ReactNode = null;
  let mobileDrawerItems: React.ReactNode = null;
  let mobileDrawerId = "mobile-nav-drawer";

  switch (context) {
    case "conductor": {
      desktopNavItems = (
        <ConductorNavItems activeItem={activeItem} setActiveItem={setActiveItem} />
      );
      desktopActions = (
        <>
          <li><SearchForm context="conductor" /></li>
          <li><SupportDropdown /></li>
          <li><SwitchApp user={user} parent="conductor" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      mobileDrawerItems = (
        <>
          <ConductorNavItems activeItem={activeItem} setActiveItem={setActiveItem} />
          <li><SearchForm context="conductor" /></li>
          <li><SupportDropdown /></li>
          <li><SwitchApp user={user} parent="conductor" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      break;
    }

    case "commons": {
      const libretextsOnly = org.orgID === "libretexts";
      desktopActions = (
        <>
          <li><AboutOrgLink org={org} /></li>
          {libretextsOnly && (
            <>
              <li><DonateLink /></li>
              <li><AccountRequestLink /></li>
              <li><StoreLink /></li>
            </>
          )}
          <li><SupportDropdown /></li>
          {libretextsOnly && <li><CommonsList /></li>}
          <li><SwitchApp user={user} parent="commons" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      mobileDrawerItems = (
        <>
          <li><AboutOrgLink org={org} /></li>
          {libretextsOnly && (
            <>
              <li><DonateLink /></li>
              <li><AccountRequestLink /></li>
              <li><StoreLink /></li>
            </>
          )}
          <li><SupportDropdown /></li>
          {libretextsOnly && <li><CommonsList /></li>}
          <li><SwitchApp user={user} parent="commons" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      break;
    }

    case "support": {
      desktopActions = (
        <>
          <li><SearchForm context="support" /></li>
          <li><SwitchApp user={user} parent="support" /></li>
          {user.isSupport || user.isHarvester ? (
            <li>
              <Button
                onClick={() => window.location.href = "/support/dashboard"}
                variant="primary"
                icon={<IconTicket />}
              >
                Staff Dashboard
              </Button>
            </li>
          ) : (
            <>
              <li><UserAuthButton user={user} /></li>
              <li>
                <Button
                  as={Link}
                  to="/support/contact"
                  variant="outline"
                  icon={<IconLifebuoy />}
                >
                  Contact Support
                </Button>
              </li>
            </>
          )}
          {user.uuid && <li><UserDropdown /></li>}
        </>
      );
      mobileDrawerItems = (
        <>
          <li><SearchForm context="support" /></li>
          <li><SwitchApp user={user} parent="support" /></li>
          {user.isSupport || user.isHarvester ? (
            <li>
              <Button
                onClick={() => window.location.href = "/support/dashboard"}
                variant="primary"
                icon={<IconTicket />}
              >
                Staff Dashboard
              </Button>
            </li>
          ) : (
            <>
              <li><UserAuthButton user={user} /></li>
              <li>
                <Button
                  as={Link}
                  to="/support/contact"
                  variant="outline"
                  icon={<IconLifebuoy />}
                >
                  Contact Support
                </Button>
              </li>
            </>
          )}
          {user.uuid && <li><UserDropdown /></li>}
        </>
      );
      break;
    }

    case "store": {
      desktopActions = (
        <>
          <li><SearchForm context="store" /></li>
          <li>
            <Link
              to="/store/cart"
              className="flex items-center gap-2 text-base font-medium text-text hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconShoppingCart size={20} />
              Cart ({productCount})
            </Link>
          </li>
          <li><SwitchApp user={user} parent="conductor" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      mobileDrawerItems = (
        <>
          <li><SearchForm context="store" /></li>
          <li>
            <Link
              to="/store/cart"
              className="flex items-center gap-2 text-base font-medium text-text hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconShoppingCart size={20} />
              Cart ({productCount})
            </Link>
          </li>
          <li><SwitchApp user={user} parent="conductor" /></li>
          <li><UserAuthButton user={user} /></li>
        </>
      );
      break;
    }
  }

  return (
    <header
      className="w-full bg-white flex flex-col"
      style={{
        height: isProduction ? "60px" : "100px",
        overflow: "visible",
        position: "relative",
        zIndex: 9999,
      }}
    >
      <EnvironmentBanner />
      <nav
        aria-label="Main navigation"
        className="w-full flex-1 flex flex-col justify-center"
        style={{ overflow: "visible" }}
      >
        <NavbarShell
          logoSrc={getLogoSrc()}
          logoLinkTo={getLogoLinkTo()}
          logoLabel={getLogoLabel()}
          logoLockupText={getLogoLockupText()}
          pageTitle={pageTitle}
          desktopNavItems={desktopNavItems}
          desktopActions={desktopActions}
          mobileDrawerItems={mobileDrawerItems}
          mobileDrawerId={mobileDrawerId}
        />
      </nav>
    </header>
  );
};

export default withUserStateDependency(Navbar);
