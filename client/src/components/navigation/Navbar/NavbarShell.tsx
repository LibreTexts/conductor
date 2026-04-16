import { useState, useRef, useEffect } from "react";
import { IconButton, VisuallyHidden } from "@libretexts/davis-react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import Launchpad from "../Launchpad";

interface NavbarShellProps {
  /** Resolved img src for the logo. */
  logoSrc: string;
  /** React Router path the logo links to (e.g. "/home", "/", "/store"). */
  logoLinkTo: string;
  /** VisuallyHidden accessible label for the logo link. */
  logoLabel: string;
  /** Optional text rendered beside the logo (e.g. "| Support Center"). */
  logoLockupText?: string;
  /** Rendered as a screen-reader-only <h1> when provided (commons catalog title). */
  pageTitle?: string;
  /** Rendered in the left cluster after the logo, hidden on mobile. */
  desktopNavItems?: React.ReactNode;
  /** Rendered in the right cluster, hidden on mobile. */
  desktopActions?: React.ReactNode;
  /** Content of the mobile drawer; if not provided, will default to desktopNavItems. */
  mobileDrawerItems?: React.ReactNode;
  /** id for the drawer element and the hamburger's aria-controls. */
  mobileDrawerId?: string;
}

/**
 * Pure layout frame for all app navbars. Owns only the hamburger open/close
 * state; all context-specific content is injected via slot props from
 * Navbar/index.tsx.
 */
const NavbarShell: React.FC<NavbarShellProps> = ({
  logoSrc,
  logoLinkTo,
  logoLabel,
  logoLockupText,
  pageTitle,
  desktopNavItems,
  desktopActions,
  mobileDrawerItems,
  mobileDrawerId = "mobile-nav-drawer",
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Return focus to hamburger when the mobile drawer closes (WCAG SC 2.4.3)
  useEffect(() => {
    if (!menuOpen) hamburgerRef.current?.focus();
  }, [menuOpen]);

  return (
    <>
      {/* Top bar — always visible */}
      <div className="flex flex-row items-center justify-between px-4 h-[60px] w-full bg-white border-b border-gray-300">
        {/* Left: Launchpad + Logo + Desktop nav links */}
        <div className="flex flex-row items-center gap-2">
          {pageTitle && <h1 className="sr-only">{pageTitle}</h1>}
          <Launchpad />
          <Link
            to={logoLinkTo}
            className="flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img src={logoSrc} alt="" className="max-h-[44px] w-auto" />
            {logoLockupText && (
              <span className="ml-2 text-2xl font-semibold text-nowrap">
                {logoLockupText}
              </span>
            )}
            <VisuallyHidden>{logoLabel}</VisuallyHidden>
          </Link>
          {desktopNavItems && (
            <div className="hidden xl:flex flex-row items-center ml-4 gap-2">
              {desktopNavItems}
            </div>
          )}
        </div>

        {/* Right: Desktop actions + Hamburger (mobile only) */}
        <div className="flex flex-row items-center gap-4">
          {desktopActions && (
            <div className="hidden xl:flex flex-row items-center gap-4">
              {desktopActions}
            </div>
          )}
          {(mobileDrawerItems || desktopActions) && (
            <IconButton
              ref={hamburgerRef}
              icon={menuOpen ? <IconX /> : <IconMenu2 />}
              aria-label={
                menuOpen ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={menuOpen}
              aria-controls={mobileDrawerId}
              variant="ghost"
              size="md"
              className="xl:hidden min-w-[44px] max-h-[44px]"
              onClick={() => setMenuOpen((prev) => !prev)}
            />
          )}
        </div>
      </div>

      {/* Mobile drawer — visible below xl breakpoint when open */}
      {menuOpen && (mobileDrawerItems || desktopActions) && (
        <div
          id={mobileDrawerId}
          className="xl:hidden bg-white w-full px-6 py-4 shadow-xl flex flex-col gap-3 border-t border-neutral-100 overflow-y-auto max-h-[50vh] justify-center"
        >
          {mobileDrawerItems || desktopActions}
        </div>
      )}
    </>
  );
};

export default NavbarShell;
