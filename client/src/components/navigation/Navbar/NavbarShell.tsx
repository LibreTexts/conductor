import { useState, useRef, useEffect } from "react";
import { IconButton, VisuallyHidden } from "@libretexts/davis-react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Organization } from "../../../types";
import { useTypedSelector } from "../../../state/hooks";
import Launchpad from "../Launchpad";
import ConstantMenuItems from "./ConstantMenuItems";
import SearchForm from "./SearchForm";
import SwitchAppWithUser from "../SwitchAppWithUser";

interface NavbarShellProps {
  org: Organization;
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const NavbarShell: React.FC<NavbarShellProps> = ({
  org,
  activeItem,
  setActiveItem,
}) => {
  const user = useTypedSelector((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Return focus to hamburger when the mobile drawer closes (WCAG SC 2.4.3)
  useEffect(() => {
    if (!menuOpen) hamburgerRef.current?.focus();
  }, [menuOpen]);

  const logoSrc =
    org.orgID !== "libretexts"
      ? org.mediumLogo
      : "https://cdn.libretexts.net/Logos/conductor_full.png";

  return (
    <>
      {/* Top bar — always visible */}
      <div className="flex flex-row items-center justify-between px-4 h-[60px] w-full shadow-md bg-white">
        {/* Left: Launchpad + Logo + Desktop nav links */}
        <div className="flex flex-row items-center gap-2">
          <Launchpad />
          <Link
            to="/home"
            onClick={() => setActiveItem("home")}
            className="flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img src={logoSrc} alt="" className="max-h-[44px] w-auto" />
            <VisuallyHidden>{org.shortName} Conductor Home</VisuallyHidden>
          </Link>
          <div className="hidden xl:flex flex-row items-center ml-4 gap-2">
            <ConstantMenuItems
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
          </div>
        </div>

        {/* Right: Search (desktop only) + SwitchApp/User + Hamburger (mobile only) */}
        <div className="flex flex-row items-center gap-2">
          <div className="hidden xl:flex mr-4">
            <SearchForm />
          </div>
          <div className="hidden xl:flex">
            <SwitchAppWithUser user={user} parent="conductor" />
          </div>
          <IconButton
            ref={hamburgerRef}
            icon={menuOpen ? <IconX /> : <IconMenu2 />}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            variant="ghost"
            size="md"
            className="xl:hidden min-w-[44px] max-h-[44px]"
            onClick={() => setMenuOpen((prev) => !prev)}
          />
        </div>
      </div>

      {/* Mobile drawer — visible below xl breakpoint when open */}
      {menuOpen && (
        <div
          id="mobile-nav-drawer"
          className="xl:hidden bg-white w-full px-6 py-4 shadow-xl flex flex-col gap-3 border-t border-neutral-100"
        >
          <SearchForm />
          <ConstantMenuItems
            activeItem={activeItem}
            setActiveItem={setActiveItem}
          />
          <SwitchAppWithUser user={user} parent="conductor" />
        </div>
      )}
    </>
  );
};

export default NavbarShell;
