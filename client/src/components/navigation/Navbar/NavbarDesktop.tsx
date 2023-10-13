import { Image, Menu } from "semantic-ui-react";
import Launchpad from "../Launchpad";
import { Link } from "react-router-dom";
import CommonsLink from "./CommonsLink";
import UserDropdown from "../UserDropdown";
import ConstantMenuItems from "./ConstantMenuItems";
import { Organization } from "../../../types";
import SearchForm from "./SearchForm";

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
  return (
    <Menu className="flex w-full" secondary>
      <div className="flex flex-row px-4 justify-between w-full items-center shadow-md">
        <div className="flex flex-row">
          <div className="mr-05p mt-0.5">
            <Launchpad />
          </div>
          <Menu.Item
            as={Link}
            to="/home"
            header
            name="home"
            id="nav-logo-item"
            onClick={(_e, data) => {
              setActiveItem(data.name ?? "");
            }}
          >
            {org.orgID !== "libretexts" ? (
              <Image src={org.mediumLogo} id="nav-org-logo" />
            ) : (
              <Image
                src="https://cdn.libretexts.net/Logos/conductor_full.png"
                id="nav-logo"
                alt="LibreTexts Conductor"
              />
            )}
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
          <CommonsLink />
          <UserDropdown />
        </div>
      </div>
    </Menu>
  );
};

export default NavbarDesktop;
