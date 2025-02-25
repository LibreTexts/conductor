import React from "react";
import PropTypes from "prop-types";
import { Icon, Image, SemanticICONS } from "semantic-ui-react";
import "./Footer.css";
import { useTypedSelector } from "../../state/hooks";
import { sanitizeCustomColor } from "../../utils/campusSettingsHelpers";

/**
 * Signals the bottom of all Commons and Conductor interfaces, with LibreTexts contact links.
 */
const Footer = () => {
  // Global State
  const org = useTypedSelector((state) => state.org);

  const contactLinks = [
    {
      key: "contactus",
      href: "/support",
      text: "Contact Us",
      title: "Contact Us",
      icon: false,
    },
    {
      key: "facebook",
      href: "https://www.facebook.com/LibreTexts",
      text: "",
      title: "LibreTexts on Facebook (opens in new tab)",
      icon: true,
      iconName: "facebook f",
    },
    {
      key: "twitter",
      href: "https://twitter.com/libretexts",
      text: "Contact Us",
      title: "LibreTexts on Twitter (opens in new tab)",
      icon: true,
      iconName: "twitter",
    },
    {
      key: "legal",
      href: "https://libretexts.org/legal/index.html",
      text: "Legal",
      title: "Legal (opens in new tab)",
      icon: false,
    },
    {
      key: "a11y",
      href: "/accessibility",
      text: "Accessibility",
      title: "Accessibility (opens in new tab)",
      icon: false,
    },
    {
      key: "status",
      href: "https://status.libretexts.org",
      text: "Status",
      title: "Status (opens in new tab)",
      icon: false,
    },
    {
      key: "donate",
      href: "https://donate.libretexts.org",
      text: "Donate",
      title: "Donate (opens in new tab)",
      icon: false,
    },
  ];

  return (
    <div
      id="footer"
      className={
        org.orgID === "libretexts"
          ? "libretexts-footer"
          : (org.footerColor ? "" : "libregrid-footer")
      }
      style={
        org.orgID !== "libretexts" && org.footerColor
          ? { backgroundColor: sanitizeCustomColor(org.footerColor) }
          : {}
      }
    >
      {org.orgID === "libretexts" ? (
        <>
          <div className="footer-row footer-links">
            {contactLinks.map((item) => (
              <a
                href={item.href}
                rel="noreferrer"
                target="_blank"
                title={item.title}
                className="contact-link"
                key={item.key}
              >
                {item.icon ? (
                  <Icon name={item.iconName as SemanticICONS} />
                ) : (
                  <span aria-hidden={true}>{item.text}</span>
                )}
              </a>
            ))}
          </div>
        </>
      ) : (
        <>
          <p id="poweredby-tagline">
            <em>powered by</em>
          </p>
          <Image
            src="/transparent_logo.png"
            size="small"
            className="cursor-pointer"
            centered
            onClick={() => {
              window.open("https://libretexts.org", "_blank", "noopener");
            }}
            alt="LibreTexts"
          />
        </>
      )}
    </div>
  );
};

export default Footer;
