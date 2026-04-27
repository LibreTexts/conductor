import { Icon, Menu } from "semantic-ui-react";
import useClientConfig from "../../../hooks/useClientConfig";

const StoreLink = ({ isMobile = false }) => {
  const { clientConfig } = useClientConfig();
  return (
    <Menu.Item
      as="a"
      href={`${clientConfig?.main_commons_url || "https://commons.libretexts.org"}/store`}
      target="_blank"
      className="commons-nav-link"
    >
      Store
      {isMobile && <Icon name="shopping cart" className="float-right" />}
    </Menu.Item>
  );
};

export default StoreLink;
