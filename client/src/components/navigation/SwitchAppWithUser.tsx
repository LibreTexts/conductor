import { Icon, Menu } from "semantic-ui-react";
import AuthHelper from "../util/AuthHelper";
import { User } from "../../types";
import { Link } from "react-router-dom";
import { useState } from "react";
import UserDropdown from "./UserDropdown";
import { isSupportStaff } from "../../utils/supportHelpers";

interface SwitchAppWithUserProps {
  parent: "commons" | "conductor";
  user: User;
  isMobile?: boolean;
}

const SwitchAppWithUser: React.FC<SwitchAppWithUserProps> = ({
  parent,
  user,
  isMobile = false,
}) => {
  const [userOpen, setUserOpen] = useState(false);
  if (user.isAuthenticated) {
    return (
      <>
        {parent === "conductor" && (
          <Menu.Item
            as="a"
            href={`https://commons.libretexts.org/support${isSupportStaff(user) ? "/dashboard" : ""}`}
            className="commons-nav-link"
            aria-label="Support Center"
          >
            <Icon name="text telephone" className="float-right" />
            Support Center
          </Menu.Item>
        )}
        <Menu.Item
          as={Link}
          to={parent === "commons" ? "/home" : "/"}
          className="commons-nav-link"
          aria-label={`Back to ${
            parent === "commons" ? "Conductor" : "Commons"
          }`}
        >
          <Icon name="exchange" className="float-right" />
          {parent === "commons" ? "Conductor" : "Commons"}
        </Menu.Item>

        {isMobile && (
          <>
            <Menu.Item onClick={() => setUserOpen(!userOpen)}>
              <span className="font-bold">
                {`${user.firstName} ${user.lastName} (${user.email})`}
              </span>
              <Icon
                name={userOpen ? "angle up" : "angle down"}
                className="float-right"
              />
            </Menu.Item>
            {userOpen && <UserDropdown dropdown={false} />}
          </>
        )}
        {!isMobile && <UserDropdown />}
      </>
    );
  }
  return (
    <Menu.Item
      as="a"
      href={AuthHelper.generateLoginURL()}
      className="commons-nav-link"
    >
      Login with LibreOne <Icon name="lightning" className="float-right pl-2" />
    </Menu.Item>
  );
};

export default SwitchAppWithUser;
