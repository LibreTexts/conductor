import AuthHelper from "../util/AuthHelper";
import { User } from "../../types";
import UserDropdown from "./UserDropdown";
import { Button } from "@libretexts/davis-react";
import { IconLogin2, IconSwitchHorizontal } from "@tabler/icons-react";

interface SwitchAppWithUserProps {
  parent: "commons" | "conductor";
  user: User;
}

const SwitchAppWithUser: React.FC<SwitchAppWithUserProps> = ({
  parent,
  user,
}) => {
  
  if (user.isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <Button
          onClick={() => {
            if (parent === "conductor") {
              window.location.href = "/";
            } else {
              window.location.href = "/home";
            }
          }}
          aria-label={`Back to ${parent === "commons" ? "Conductor" : "Commons"}`}
          icon={<IconSwitchHorizontal className="pb-1!" />}
          iconPosition="left"
        >
          {parent === "conductor" ? "Commons" : "Conductor"}
        </Button>
        <UserDropdown />
      </div>
    );
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

export default SwitchAppWithUser;
