import useClientConfig from "../../../hooks/useClientConfig";
import { Organization, User } from "../../../types";
import DonationCompaignBanner from "../../navigation/DonationCampaignBanner";
import EnvironmentBanner from "../../navigation/EnvironmentBanner";
import CommonsNavbarDesktop from "./CommonsNavbarDesktop";
import CommonsNavbarMobile from "./CommonsNavbarMobile";
import { useMediaQuery } from "react-responsive";

type CommonsNavbarProps = {
  org: Organization;
  user: User;
};

const CommonsNavbar: React.FC<CommonsNavbarProps> = ({ org, user }) => {
  /**
   * Close the mobile menu when the Tailwind XL breakpoint is reached.
   * @link https://www.npmjs.com/package/react-responsive
   * Must be defined up here to avoid a React Hook error (above return statements).
   */
  const isTailwindXl = useMediaQuery(
    { minWidth: 1280 }, // Tailwind XL breakpoint
    undefined
  );

  const { isProduction } = useClientConfig();

  const getCommonsTitle = () =>
    org.orgID === "libretexts" ? "LibreCommons" : "Campus Commons";

  const calculateNavbarHeight = () => {
    let height = 60; // Base height for mobile
    if (isTailwindXl) {
      if (!isProduction) {
        height += 40; // Desktop height + environment banner
      }
      if (org.orgID === "libretexts") {
        height += 40; // Add space for donation campaign banner
      }
      return height;
    }

    if (!isProduction) {
      height += 40; // Mobile height + environment banner
    }
    if (org.orgID === "libretexts") {
      height += 45; // Add space for the donation campaign banner
    }

    return height;
  };

  return (
    <div
      className="nav-menu"
      style={{
        height: calculateNavbarHeight(),
      }}
    >
      <EnvironmentBanner />
      {org.orgID === "libretexts" && <DonationCompaignBanner />}
      {isTailwindXl ? (
        <CommonsNavbarDesktop
          org={org}
          user={user}
          commonsTitle={getCommonsTitle()}
        />
      ) : (
        <CommonsNavbarMobile
          org={org}
          user={user}
          commonsTitle={getCommonsTitle()}
        />
      )}
    </div>
  );
};

export default CommonsNavbar;
