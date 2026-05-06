import React, { useCallback, useState } from "react";
import { VisuallyHidden } from "@libretexts/davis-react";
import { IconBrandFacebook, IconBrandX, type IconProps } from "@tabler/icons-react";
import classNames from "classnames";
import { useTypedSelector } from "../../state/hooks";
import { sanitizeCustomColor } from "../../utils/campusSettingsHelpers";

interface ContactLink {
  key: string;
  href: string;
  text: string | null;
  tooltip: string;
  external: boolean;
  icon: React.ComponentType<IconProps> | null;
  ariaLabel?: string;
}

/**
 * Signals the bottom of all Commons and Conductor interfaces, with LibreTexts contact links.
 */
const Footer = () => {
  const org = useTypedSelector((state) => state.org);
  const [tooltipsDismissed, setTooltipsDismissed] = useState(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setTooltipsDismissed(true);
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setTooltipsDismissed(false);
  }, []);

  const handleFocus = useCallback(() => {
    setTooltipsDismissed(false);
  }, []);

  const contactLinks: ContactLink[] = [
    {
      key: "contactus",
      href: "/support",
      text: "Contact Us",
      tooltip: "Contact Us",
      external: false,
      icon: null,
    },
    {
      key: "facebook",
      href: "https://www.facebook.com/LibreTexts",
      text: null,
      tooltip: "LibreTexts on Facebook (opens in new tab)",
      external: true,
      icon: IconBrandFacebook,
      ariaLabel: "LibreTexts on Facebook",
    },
    {
      key: "twitter",
      href: "https://twitter.com/libretexts",
      text: null,
      tooltip: "LibreTexts on X (opens in new tab)",
      external: true,
      icon: IconBrandX,
      ariaLabel: "LibreTexts on X",
    },
    {
      key: "legal",
      href: "https://libretexts.org/privacy",
      text: "Legal",
      tooltip: "Legal (opens in new tab)",
      external: true,
      icon: null,
    },
    {
      key: "a11y",
      href: "/accessibility",
      text: "Accessibility",
      tooltip: "Accessibility",
      external: false,
      icon: null,
    },
    {
      key: "status",
      href: "https://status.libretexts.org",
      text: "Status",
      tooltip: "Status (opens in new tab)",
      external: true,
      icon: null,
    },
    {
      key: "donate",
      href: "https://donate.libretexts.org",
      text: "Donate",
      tooltip: "Donate (opens in new tab)",
      external: true,
      icon: null,
    },
  ];

  return (
    <footer
      id="footer"
      className={classNames(
        "flex flex-col items-center py-7 px-4 shadow-md text-center",
        org.orgID === "libretexts"
          ? "bg-[#0E5E95] text-white"
          : org.footerColor
            ? ""
            : "bg-[#ccecfd]"
      )}
      style={
        org.orgID !== "libretexts" && org.footerColor
          ? { backgroundColor: sanitizeCustomColor(org.footerColor) }
          : {}
      }
    >
      {org.orgID === "libretexts" ? (
        <nav aria-label="Footer">
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 list-none m-0 p-0 max-md:flex-col max-md:items-center max-md:gap-y-1">
            {contactLinks.map((item) => (
              <li
                key={item.key}
                className="relative group"
                onMouseEnter={handleMouseEnter}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
              >
                <a
                  href={item.href}
                  rel="noreferrer"
                  target={item.external ? "_blank" : undefined}
                  aria-label={item.tooltip}
                  className={classNames(
                    "text-white no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    item.icon
                      ? "hover:scale-110 inline-block transition-transform"
                      : "text-lg hover:underline"
                  )}
                >
                  {item.icon ? (
                    <>
                      <item.icon
                        size={20}
                        aria-hidden={true}
                        className="inline-block"
                      />
                      <VisuallyHidden>{item.ariaLabel}</VisuallyHidden>
                    </>
                  ) : (
                    item.text
                  )}
                </a>
                {!tooltipsDismissed && (
                  <span
                    role="tooltip"
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-sm rounded shadow-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity whitespace-nowrap"
                  >
                    {item.tooltip}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <>
          <p className="m-0">
            <em>powered by</em>
          </p>
          <a
            href="https://libretexts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mx-auto"
          >
            <img
              src="/transparent_logo.png"
              alt="LibreTexts"
              className="max-w-[150px] mx-auto cursor-pointer"
            />
          </a>
        </>
      )}
    </footer>
  );
};

export default Footer;
