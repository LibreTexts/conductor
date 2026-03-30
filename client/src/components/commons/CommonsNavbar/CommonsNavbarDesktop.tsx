import { Link } from "react-router-dom";
import { Image } from "semantic-ui-react";
import AccountRequestLink from "./AccountRequestLink";
import AboutOrgLink from "./AboutOrgLink";
import { Organization, User } from "../../../types";
import CommonsList from "./CommonsList";
import SwitchAppWithUser from "../../navigation/SwitchAppWithUser";
import DonateLink from "./DonateLink";
import Launchpad from "../../navigation/Launchpad";
import SupportDropdown from "./SupportDropdown";
import StoreLink from "./StoreLink";
import { Stack } from "@libretexts/davis-react";

interface CommonsNavbarDesktopProps {
  org: Organization;
  user: User;
  commonsTitle: string;
}

const CommonsNavbarDesktop: React.FC<CommonsNavbarDesktopProps> = ({
  org,
  user,
  commonsTitle,
  ...rest
}) => {
  return (
    <div className="flex w-full h-full !mt-0">
      <div className="flex flex-row px-4 justify-between w-full items-center shadow-md">
        <div className="flex flex-row items-center gap-x-4">
          <h1 className="sr-only">{commonsTitle}</h1>
          <div>
            <Launchpad />
          </div>
          <div>
            <Image src={org.mediumLogo} className="nav-logo" alt="" />
            <span className="sr-only">{commonsTitle} Catalog Home</span>
          </div>
        </div>
        <Stack direction="horizontal" gap="md" align="center">
          <AboutOrgLink org={org} />
          {org.orgID === "libretexts" && (
            <>
              <DonateLink />
              <AccountRequestLink />
              <StoreLink />
            </>
          )}
          <SupportDropdown />
          {
            org.orgID === 'libretexts' && (
              <CommonsList />
            )
          }
          <SwitchAppWithUser user={user} parent="commons" />
        </Stack>
      </div>
    </div>
  );
};

export default CommonsNavbarDesktop;
