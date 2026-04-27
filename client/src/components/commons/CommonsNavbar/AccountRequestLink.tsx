import { Icon, Menu } from "semantic-ui-react";
import { getCentralAuthInstructorURL } from "../../../utils/centralIdentityHelpers";

const AccountRequestLink = ({ isMobile = false }) => {
  return (
    <Menu.Item
      as="a"
      href={getCentralAuthInstructorURL()}
      target="_blank"
      className="commons-nav-link"
    >
      Instructor Verification Request
      {isMobile && <Icon name="share alternate" className="float-right" />}
    </Menu.Item>
  );
};

export default AccountRequestLink;
