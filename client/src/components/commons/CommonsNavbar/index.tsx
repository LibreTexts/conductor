import useClientConfig from "../../../hooks/useClientConfig";
import { Organization, User } from "../../../types";
import DonationCompaignBanner from "../../navigation/DonationCampaignBanner";
import EnvironmentBanner from "../../navigation/EnvironmentBanner";
import CommonsNavbarShell from "./CommonsNavbarShell";

type CommonsNavbarProps = {
  org: Organization;
  user: User;
};

const CommonsNavbar: React.FC<CommonsNavbarProps> = ({ org, user }) => {
  const { isProduction } = useClientConfig();

  const getCommonsTitle = () =>
    org.orgID === "libretexts" ? "LibreCommons" : "Campus Commons";

  return (
    <header
      className="fixed top-0 left-0 w-full z-[100] bg-white flex flex-col"
      style={{ height: isProduction ? "60px" : "100px" }}
    >
      <EnvironmentBanner />
      {/* {org.orgID === "libretexts" && <DonationCompaignBanner />} */}
      <nav
        aria-label="Main navigation"
        className="w-full flex-1 flex flex-col justify-center"
      >
        <CommonsNavbarShell
          org={org}
          user={user}
          commonsTitle={getCommonsTitle()}
        />
      </nav>
    </header>
  );
};

export default CommonsNavbar;
