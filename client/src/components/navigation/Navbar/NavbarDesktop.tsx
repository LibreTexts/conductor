import { Image, Menu } from "semantic-ui-react";
import Launchpad from "../Launchpad";
import { Link } from "react-router-dom";
import ConstantMenuItems from "./ConstantMenuItems";
import { Organization } from "../../../types";
import SearchForm from "./SearchForm";
import SwitchAppWithUser from "../SwitchAppWithUser";
import { useTypedSelector } from "../../../state/hooks";

interface NavbarDesktopProps {
  org: Organization;
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const NavbarDesktop: React.FC<NavbarDesktopProps> = ({
  org,
  activeItem,
  setActiveItem,
}) => {
  const user = useTypedSelector((state) => state.user);

  return (
    <Menu className="flex w-full" secondary>
      <div className="flex flex-row px-4 justify-between w-full items-center shadow-md">
        <div className="flex flex-row items-center">
          <div>
            <Launchpad />
          </div>
          <Menu.Item
            as={Link}
            to="/home"
            header
            name="home"
            className="nav-logo"
            onClick={(_e, data) => {
              setActiveItem(data.name ?? "");
            }}
          >
            {org.orgID !== "libretexts" ? (
              <Image src={org.mediumLogo} className="nav-logo" />
            ) : (
              <Image src="https://cdn.libretexts.net/Logos/conductor_full.png" className="nav-logo" />
            )}
            <span className="sr-only">{org.shortName} Conductor Home</span>
          </Menu.Item>
          <div className="flex flex-row">
            <ConstantMenuItems
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
          </div>
        </div>
        <div className="flex">
          <SearchForm />
          <SwitchAppWithUser user={user} parent="conductor" />
        </div>
      </div>
    </Menu>
  );
};

export default NavbarDesktop;
