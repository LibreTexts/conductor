import { Link } from "react-router-dom";
import { Dropdown, Icon, Image, Menu, MenuItemProps } from "semantic-ui-react";
import AuthHelper from "../util/AuthHelper";
import { useTypedSelector } from "../../state/hooks";
import classNames from "classnames";
import useClientConfig from "../../hooks/useClientConfig";

interface UserDropdownProps extends MenuItemProps {
  showAvatar?: boolean;
  dropdown?: boolean;
  className?: string;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  showAvatar = true,
  dropdown = true,
  className,
  ...props
}) => {
  const user = useTypedSelector((state) => state.user);
  const { clientConfig } = useClientConfig();
  /**
   * Ends the user's session.
   */
  const logOut = () => {
    AuthHelper.logout();
  };

  const centralIdentityBaseUrl = clientConfig?.central_identity_base_url || "";

  if (dropdown) {
    return (
      <Menu.Item {...props} className={classNames(className)}>
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
          <Dropdown.Menu direction="left" className="!z-[1000]">
            <Dropdown.Item 
              as="a" 
              href={`${centralIdentityBaseUrl}/profile`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="user" />
              Profile
            </Dropdown.Item>
            <Dropdown.Item 
              as="a" 
              href={`${centralIdentityBaseUrl}/security`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="lock" />
              Security
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
    <Menu.Menu className={classNames("!mt-2 !pl-0", className)}>
      <Menu.Item 
        as="a" 
        href={`${centralIdentityBaseUrl}/profile`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="user" />
        Profile
      </Menu.Item>
      <Menu.Item 
        as="a" 
        href={`${centralIdentityBaseUrl}/security`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="lock" />
        Security
      </Menu.Item>
      <Menu.Item onClick={logOut}>
        <Icon name="log out" />
        Log out
      </Menu.Item>
    </Menu.Menu>
  );
};

export default UserDropdown;
