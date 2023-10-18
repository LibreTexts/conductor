import { Icon, Menu, MenuItemProps } from "semantic-ui-react";
import { Organization } from "../../../types";

interface AboutOrgLinkProps extends MenuItemProps {
  org: Organization;
  isMobile?: boolean;
}

const AboutOrgLink: React.FC<AboutOrgLinkProps> = ({
  org,
  isMobile = false,
  ...rest
}) => {
  return (
    <Menu.Item
      as="a"
      href={org.aboutLink}
      target="_blank"
      rel="noopener"
      className="commons-nav-link"
      {...rest}
    >
      About {org.shortName}
      {isMobile && <Icon name="external" className="float-right" />}
    </Menu.Item>
  );
};

export default AboutOrgLink;
