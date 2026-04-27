import { Icon, Menu } from "semantic-ui-react";

const DonateLink = ({ isMobile = false }) => {
  return (
    <Menu.Item
      as="a"
      href="https://donate.libretexts.org"
      target="_blank"
      className="commons-nav-link"
    >
      Donate
      {isMobile && <Icon name="heart" className="float-right" />}
    </Menu.Item>
  );
};

export default DonateLink;
