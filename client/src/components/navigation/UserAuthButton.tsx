import AuthHelper from "../util/AuthHelper";
import { User } from "../../types";
import UserDropdown from "./UserDropdown";
import { Button } from "@libretexts/davis-react";
import { IconLogin2 } from "@tabler/icons-react";

interface UserAuthButtonProps {
  user: User;
}

/**
 * Displays either a login button (if user not authenticated) or the UserDropdown (if authenticated).
 * Used in multiple navbar contexts, so created as separate component.
 */
const UserAuthButton: React.FC<UserAuthButtonProps> = ({
  user,
}) => {

  if (user && user.isAuthenticated) {
    return (
      <UserDropdown />
    )
  }

  return (
    <Button
      onClick={() => {
        window.open(AuthHelper.generateLoginURL(), "_blank", "noopener noreferrer");
      }}
      icon={<IconLogin2 />}
    >
      Login with LibreOne
    </Button>
  );
};

export default UserAuthButton;
