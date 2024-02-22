import { Link } from "react-router-dom";
import { Image, Menu, MenuProps } from "semantic-ui-react";
import AccountRequestLink from "./AccountRequestLink";
import AboutOrgLink from "./AboutOrgLink";
import { Organization, User } from "../../../types";
import CommonsList from "./CommonsList";
import SwitchAppWithUser from "../../navigation/SwitchAppWithUser";
import DonateLink from "./DonateLink";
import Launchpad from "../../navigation/Launchpad";

interface CommonsNavbarDesktopProps extends MenuProps {
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
    <Menu className="flex w-full" secondary>
      <div className="flex flex-row px-4 justify-between w-full items-center shadow-md">
        <div className="flex flex-row items-center">
          <h1 className="sr-only">{commonsTitle}</h1>
          <div>
            <Launchpad />
          </div>
          <Menu.Item as={Link} to="/">
            <Image src={org.mediumLogo} className="nav-logo" alt="" />
            <span className="sr-only">{commonsTitle} Catalog Home</span>
          </Menu.Item>
          </div>
          <Menu.Menu position="right">
            <AboutOrgLink org={org} />
            {org.orgID === "libretexts" && (
              <>
                <DonateLink />
                <AccountRequestLink />
                <CommonsList />
              </>
            )}
            <SwitchAppWithUser user={user} parent="commons" />
          </Menu.Menu>
        </div>
    </Menu>
  );
};

export default CommonsNavbarDesktop;
