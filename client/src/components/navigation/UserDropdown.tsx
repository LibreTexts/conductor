import { Link } from "react-router-dom";
import { Dropdown, Icon, Image, Menu, MenuItemProps } from "semantic-ui-react";
import AuthHelper from "../util/AuthHelper";
import { useTypedSelector } from "../../state/hooks";

interface UserDropdownProps extends MenuItemProps {
  showAvatar?: boolean;
  dropdown?: boolean;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  showAvatar = true,
  dropdown = true,
  ...props
}) => {
  const user = useTypedSelector((state) => state.user);
  /**
   * Ends the user's session.
   */
  const logOut = () => {
    AuthHelper.logout();
  };

  if (dropdown) {
    return (
      <Menu.Item {...props}>
        <div className="flex flex-row items-center">
        {showAvatar && <Image src={`${user.avatar}`} avatar />}
        <Dropdown text={user.firstName + " " + user.lastName}>
          <Dropdown.Menu direction="left">
            <Dropdown.Item as={Link} to="/account">
              <Icon name="settings" />
              Settings
            </Dropdown.Item>
            <Dropdown.Item onClick={logOut}>
              <Icon name="log out" />
              Log out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        </div>
      </Menu.Item>
    );
  }

  return (
    <Menu.Menu className="!mt-2 !pl-0">
      <Menu.Item as={Link} to="/account">
        <Icon name="settings" />
        Settings
      </Menu.Item>
      <Menu.Item onClick={logOut}>
        <Icon name="log out" />
        Log out
      </Menu.Item>
    </Menu.Menu>
  );
};

export default UserDropdown;
