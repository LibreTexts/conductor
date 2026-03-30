import AuthHelper from "../util/AuthHelper";
import { User } from "../../types";
import { useState } from "react";
import UserDropdown from "./UserDropdown";
import { Button } from "@libretexts/davis-react";
import { IconLogin2, IconSwitchHorizontal } from "@tabler/icons-react";

interface SwitchAppWithUserProps {
  parent: "commons" | "conductor";
  user: User;
  isMobile?: boolean;
}

const SwitchAppWithUser: React.FC<SwitchAppWithUserProps> = ({
  parent,
  user,
  isMobile = false,
}) => {
  const [userOpen, setUserOpen] = useState(false);

  const getSupportCenterHref = () => {
    // Always nav to main commons in production, otherwise use the current origin (e.g. development)
    if (window.location.origin.endsWith("libretexts.org")) {
      return `https://commons.libretexts.org/support${user.isSupport || user.isHarvester ? "/dashboard" : ""
        }`;
    }
    return `${window.location.origin}/support${user.isSupport || user.isHarvester ? "/dashboard" : ""
      }`;
  };

  const getStoreHref = () => {
    // Always nav to main store in production, otherwise use the current origin (e.g. development)
    if (window.location.origin.endsWith("libretexts.org")) {
      return `https://store.libretexts.org`;
    }
    return `${window.location.origin}/store`;
  };

  if (user.isAuthenticated) {
    return (
      <>
        {/* We'll need to make these Link elements instead of Menu items for Davis */}
        {/* {parent === "conductor" && (
          <>
            <Menu.Item
              as="a"
              href={getStoreHref()}
              className="commons-nav-link"
              aria-label="Store"
            >
              <Icon name="shopping cart" className="float-right" />
              Store
            </Menu.Item>
            <Menu.Item
              as="a"
              href={getSupportCenterHref()}
              className="commons-nav-link"
              aria-label="Support Center"
            >
              <Icon name="text telephone" className="float-right" />
              Support Center
            </Menu.Item>
          </>
        )} */}
        <Button
          onClick={() => {
            if (parent === "conductor") {
              window.location.href = "/home";
            } else {
              window.location.href = "/";
            }
          }}
          aria-label={`Back to ${parent === "commons" ? "Conductor" : "Commons"
            }`}
          icon={<IconSwitchHorizontal className="pb-1!" />}
          iconPosition="left"
        >
          {parent === "conductor" ? "Commons" : "Conductor"}
        </Button>
        <UserDropdown />
      </>
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
