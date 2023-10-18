import { Button, Icon, Image, Menu } from "semantic-ui-react";
import AboutOrgLink from "./AboutOrgLink";
import { Organization, User } from "../../../types";
import AccountRequestLink from "./AccountRequestLink";
import CommonsList from "./CommonsList";
import { useState } from "react";
import SwitchAppWithUser from "../../navigation/SwitchAppWithUser";

interface CommonsNavbarMobileProps {
  org: Organization;
  user: User;
  commonsTitle: string;
}

const CommonsNavbarMobile: React.FC<CommonsNavbarMobileProps> = ({
  org,
  user,
  commonsTitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [commonsOpen, setCommonsOpen] = useState(false);

  return (
    <Menu className="flex w-full pt-2 flex-col" secondary>
      <div className="flex flex-row px-4 justify-between w-full items-center">
        <h1 className="sr-only">{commonsTitle}</h1>
        <Image src={org.mediumLogo} className="nav-logo" alt="" />
        <div>
          <Button
            basic
            icon={menuOpen ? "caret up" : "bars"}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Navigation Menu"
          />
        </div>
      </div>
      {menuOpen && (
        <div className="bg-white w-full px-6 shadow-xl pb-2">
          <Menu vertical fluid secondary>
            <AboutOrgLink org={org} isMobile={true} />
            {org.orgID === "libretexts" && (
              <>
                <AccountRequestLink isMobile={true} />
                <Menu.Item onClick={() => setCommonsOpen(!commonsOpen)}>
                  Campus Commons
                  <Icon
                    name={commonsOpen ? "angle up" : "angle down"}
                    className="float-right"
                  />
                </Menu.Item>
              </>
            )}
            {org.orgID === "libretexts" && commonsOpen && (
              <CommonsList isMobile={true} />
            )}
            <SwitchAppWithUser user={user} parent="commons" isMobile />
          </Menu>
        </div>
      )}
    </Menu>
  );
};

export default CommonsNavbarMobile;
