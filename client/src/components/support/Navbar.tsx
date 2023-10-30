import { Link, useLocation } from "react-router-dom";
import withUserStateDependency from "../../enhancers/withUserStateDependency.jsx";
import { Image, Menu } from "semantic-ui-react";
import Launchpad from "../navigation/Launchpad.js";

const SupportCenterNavbar: React.FC<{}> = () => {
  // Global State, Location, and Error Handling
  const location = useLocation();

  return (
    <div className="flex flex-row bg-white h-fit py-2 shadow-md border-b">
      <Menu
        className="flex flex-row px-4 justify-between w-full items-center"
        secondary
      >
        <div className="ml-4">
          <Launchpad />
        </div>
        <Menu.Item as={Link} to="/kb" header name="home" className="nav-logo">
          <div className="flex flex-row items-center">
            <Image
              src="https://cdn.libretexts.net/Logos/libretexts_full.png"
              className="nav-logo mb-2"
            />
            <span className="ml-2 mb-1 text-xl">Knowledge Base</span>
          </div>
        </Menu.Item>
      </Menu>
    </div>
  );
};

export default withUserStateDependency(SupportCenterNavbar);
