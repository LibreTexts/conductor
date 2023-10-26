import { Link, useLocation } from "react-router-dom";
import withUserStateDependency from "../../../enhancers/withUserStateDependency.jsx";
import { useTypedSelector } from "../../../state/hooks.js";
import { Image, Menu } from "semantic-ui-react";
import Launchpad from "../../navigation/Launchpad.js";
import SwitchAppWithUser from "../../navigation/SwitchAppWithUser.js";

const KBNavbar: React.FC = () => {
  // Global State, Location, and Error Handling
  const location = useLocation();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);

  return (
    <div className="flex flex-row bg-white h-fit py-2 shadow-md border-b">
      <Menu className="flex w-full" secondary>
        <div className="flex flex-row px-4 justify-between w-full items-center">
          <div className="flex flex-row items-center">
            <div className="ml-4">
              <Launchpad />
            </div>
            <Menu.Item
              as={Link}
              to="/home"
              header
              name="home"
              className="nav-logo"
            >
              {org.orgID !== "libretexts" ? (
                <Image src={org.mediumLogo} className="nav-logo" />
              ) : (
                <Image
                  src="https://cdn.libretexts.net/Logos/libretexts_full.png"
                  className="nav-logo mb-2"
                />
              )}
              <span className="sr-only">{org.shortName} Knowledge Base</span>
            </Menu.Item>
            <div className="flex flex-row"></div>
          </div>
          <div className="flex">
            <SwitchAppWithUser user={user} parent="conductor" />
          </div>
        </div>
      </Menu>
    </div>
  );
};

export default withUserStateDependency(KBNavbar);
