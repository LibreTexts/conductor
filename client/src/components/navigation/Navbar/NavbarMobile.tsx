import { useState } from "react";
import { Icon, Menu, Button, Image} from "semantic-ui-react";
import ConstantMenuItems from "./ConstantMenuItems";
import { Organization } from "../../../types";
import Launchpad from "../Launchpad";
import { Link } from "react-router-dom";
import SearchForm from "./SearchForm";
import { useTypedSelector } from "../../../state/hooks";
import SwitchAppWithUser from "../SwitchAppWithUser";

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
  const user = useTypedSelector((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Menu className={`flex w-full flex-col ${menuOpen ? 'pt-1' : ''}`} secondary>
      <div className="flex flex-row justify-between w-full items-center px-4">
        <div className="mr-05p">
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
            <Image src={org.mediumLogo} id="nav-org-logo" />
          ) : (
            <Image
              src="https://cdn.libretexts.net/Logos/conductor_full.png"
              className="nav-logo mb-1"
              alt="LibreTexts Conductor"
            />
          )}
        </Menu.Item>
        <Button icon onClick={() => setMenuOpen(!menuOpen)} basic>
          <Icon name={menuOpen ? "caret up" : "bars"} />
        </Button>
      </div>
      {menuOpen && (
        <div className="bg-white w-full px-6 pb-2 shadow-xl">
          <Menu vertical fluid secondary>
            <SearchForm className="!px-0" />
            <ConstantMenuItems
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
            <SwitchAppWithUser user={user} parent="conductor" isMobile />
          </Menu>
        </div>
      )}
    </Menu>
  );
};

export default NavbarMobile;
