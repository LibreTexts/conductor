import { useState } from "react";
import { Icon, Menu, Button, Image, Divider } from "semantic-ui-react";
import CommonsLink from "./CommonsLink";
import UserDropdown from "../UserDropdown";
import ConstantMenuItems from "./ConstantMenuItems";
import { Organization } from "../../../types";
import Launchpad from "../Launchpad";
import { Link } from "react-router-dom";
import SearchForm from "./SearchForm";

interface NavbarMobileProps {
  org: Organization;
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const NavbarMobile: React.FC<NavbarMobileProps> = ({
  org,
  activeItem,
  setActiveItem,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Menu className="flex w-full pt-2 flex-col" secondary>
      <div className="flex flex-row justify-between w-full items-center px-4">
        <div className="mr-05p mt-1">
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
        <Button icon onClick={() => setMenuOpen(!menuOpen)} basic>
          <Icon name={menuOpen ? "caret up" : "bars"} />
        </Button>
      </div>
      {menuOpen && (
        <div className="bg-white w-full px-6 shadow-xl">
          <Menu vertical fluid secondary>
            <SearchForm className="!px-0" />
            <ConstantMenuItems
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
            <CommonsLink />
            <Divider />
            <UserDropdown showAvatar={false} dropdown={false}/>
          </Menu>
        </div>
      )}
    </Menu>
  );
};

export default NavbarMobile;
