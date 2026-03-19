import { Icon, Menu } from "semantic-ui-react";
import useClientConfig from "../../../hooks/useClientConfig";

const AccountRequestLink = ({ isMobile = false }) => {
  const { clientConfig } = useClientConfig();
  if (!clientConfig?.instructor_verification_url) {
    return null;
  }

  return (
    <Menu.Item
      as="a"
      href={clientConfig?.instructor_verification_url}
      target="_blank"
      className="commons-nav-link"
      rel="noopener noreferrer"
    >
      Instructor Verification Request
      {isMobile && <Icon name="share alternate" className="float-right" />}
    </Menu.Item>
  );
};

export default AccountRequestLink;
