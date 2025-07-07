import { Icon, Menu } from "semantic-ui-react";

const StoreLink = ({ isMobile = false }) => {
  return (
    <Menu.Item
      as="a"
      href="https://commons.libretexts.org/store"
      target="_blank"
      className="commons-nav-link"
    >
      Store
      {isMobile && <Icon name="shopping cart" className="float-right" />}
    </Menu.Item>
  );
};

export default StoreLink;
