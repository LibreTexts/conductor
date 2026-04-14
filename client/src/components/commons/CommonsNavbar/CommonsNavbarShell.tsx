import { useState, useRef, useEffect } from "react";
import { IconButton, VisuallyHidden } from "@libretexts/davis-react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { Organization, User } from "../../../types";
import Launchpad from "../../navigation/Launchpad";
import AboutOrgLink from "./AboutOrgLink";
import DonateLink from "./DonateLink";
import AccountRequestLink from "./AccountRequestLink";
import StoreLink from "./StoreLink";
import SupportDropdown from "./SupportDropdown";
import CommonsList from "./CommonsList";
import SwitchAppWithUser from "../../navigation/SwitchAppWithUser";

interface CommonsNavbarShellProps {
  org: Organization;
  user: User;
  commonsTitle: string;
}

const CommonsNavbarShell: React.FC<CommonsNavbarShellProps> = ({
  org,
  user,
  commonsTitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Return focus to hamburger when drawer closes (WCAG SC 2.4.3)
  useEffect(() => {
    if (!menuOpen) hamburgerRef.current?.focus();
  }, [menuOpen]);

  return (
    <>
      {/* Top bar — always visible */}
      <div className="flex flex-row items-center justify-between px-4 h-[60px] w-full shadow-md bg-white">

        {/* Left: Launchpad + Logo */}
        <div className="flex flex-row items-center gap-4">
          <h1 className="sr-only">{commonsTitle}</h1>
          <Launchpad />
          <img
            src={org.mediumLogo}
            alt=""
            className="max-h-[44px] w-auto"
          />
          <VisuallyHidden>{commonsTitle} Catalog Home</VisuallyHidden>
        </div>

        {/* Right cluster */}
        <div className="flex flex-row items-center gap-4">
          {/* Desktop nav items — hidden below xl */}
          <div className="hidden xl:flex items-center gap-4">
            <AboutOrgLink org={org} />
            {org.orgID === "libretexts" && (
              <>
                <DonateLink />
                <AccountRequestLink />
                <StoreLink />
              </>
            )}
            <SupportDropdown />
            {org.orgID === "libretexts" && <CommonsList />}
          </div>
          {/* Desktop only: login / switch app */}
          <div className="hidden xl:flex">
            <SwitchAppWithUser user={user} parent="commons" />
          </div>
          {/* Hamburger — hidden above xl */}
          <IconButton
            ref={hamburgerRef}
            icon={menuOpen ? <IconX /> : <IconMenu2 />}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="commons-mobile-nav-drawer"
            variant="ghost"
            size="md"
            className="xl:hidden min-w-[44px] min-h-[44px]"
            onClick={() => setMenuOpen((prev) => !prev)}
          />
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          id="commons-mobile-nav-drawer"
          className="xl:hidden bg-white w-full px-6 py-4 shadow-xl flex flex-col gap-3 border-t border-neutral-100 overflow-y-auto max-h-[50vh]"
        >
          <AboutOrgLink org={org} isMobile />
          {org.orgID === "libretexts" && (
            <>
              <DonateLink isMobile />
              <AccountRequestLink isMobile />
              <StoreLink isMobile />
            </>
          )}
          <SupportDropdown />
          {org.orgID === "libretexts" && <CommonsList />}
          <SwitchAppWithUser user={user} parent="commons" />
        </div>
      )}
    </>
  );
};

export default CommonsNavbarShell;
