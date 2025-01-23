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
        <Dropdown
          className="!flex items-center align-middle border border-slate-200 shadow-sm rounded-md pr-1.5"
          trigger={
            <div className="flex items-center align-middle p-1">
              {showAvatar && <Image src={`${user.avatar}`} avatar />}
              <div className="flex flex-col items-start justify-center ml-1">
                <p className="font-bold">{`${user.firstName} ${user.lastName}`}</p>
                <p className="text-sm">{user.email}</p>
              </div>
            </div>
          }
        >
          <Dropdown.Menu direction="left">
            <Dropdown.Item as={Link} to="/account/overview">
              <Icon name="settings" />
              Settings
            </Dropdown.Item>
            <Dropdown.Item onClick={logOut}>
              <Icon name="log out" />
              Log out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Menu.Item>
    );
  }

  return (
    <Menu.Menu className="!mt-2 !pl-0">
      <Menu.Item as={Link} to="/account/overview">
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
