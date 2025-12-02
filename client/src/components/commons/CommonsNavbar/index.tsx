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

  return (
    <div
      className="nav-menu"
      style={{
        height: isProduction ? "60px" : "100px",
      }}
    >
      {org.orgID === "libretexts" && <DonationCompaignBanner />}
      <EnvironmentBanner />
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
