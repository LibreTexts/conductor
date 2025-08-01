import { useState } from "react";
import { Icon, Menu, Button, Image, Form } from "semantic-ui-react";
import Launchpad from "../Launchpad";
import { Link } from "react-router-dom";
import SwitchAppWithUser from "../SwitchAppWithUser";
import { User } from "../../../types";
import { isSupportStaff } from "../../../utils/supportHelpers";
import { useCart } from "../../../context/CartContext";

interface StoreNavbarMobileProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  showSearch: boolean;
  user: User;
  onSubmitSearch: () => void;
}

const StoreNavbarMobile: React.FC<StoreNavbarMobileProps> = ({
  search,
  setSearch,
  showSearch,
  user,
  onSubmitSearch,
}) => {
  const { productCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Menu
      className={`flex w-full flex-col bg-white max-h-12 z-[50] ${
        menuOpen ? "pt-1" : ""
      }`}
    >
      <div className="flex flex-row justify-between !h-fit w-full items-center bg-white px-4 py-2 z-50">
        <div className="mr-05p">
          <Launchpad />
        </div>
        <div
          className="flex flex-row items-center cursor-pointer"
          onClick={() => window.location.assign("/store")}
        >
          <Image
            src="https://cdn.libretexts.net/Logos/libretexts_icon.png"
            className="h-12"
          />
          <span className="flex ml-2 text-2xl font-semibold text-nowrap">
            Store
          </span>
        </div>
        <Button icon onClick={() => setMenuOpen(!menuOpen)} basic>
          <Icon name={menuOpen ? "caret up" : "bars"} />
        </Button>
      </div>
      {menuOpen && (
        <div className="bg-white w-full px-6 pb-2 shadow-xl z-50">
          <Menu vertical fluid secondary>
            <Form
              className="mt-2 pl-3"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitSearch();
              }}
            >
              {showSearch && (
                <Form.Input
                  placeholder="Search LibreTexts Store..."
                  icon="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
            </Form>
            <Menu.Item
              name="cart"
              as={Link}
              to="/store/cart"
            />
            <SwitchAppWithUser user={user} parent="commons" isMobile />
          </Menu>
        </div>
      )}
    </Menu>
  );
};

export default StoreNavbarMobile;
