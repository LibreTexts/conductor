import { Link } from "react-router-dom";
import { Form, Icon, Image } from "semantic-ui-react";
import Launchpad from "../Launchpad.js";
import AuthHelper from "../../util/AuthHelper.js";
import UserDropdown from "../UserDropdown.js";
import { User } from "../../../types/User.js";
import { Button, Input } from "@libretexts/davis-react";
import { IconLifebuoy, IconLogin2, IconSearch, IconTicket } from "@tabler/icons-react";

interface SupportCenterNavbarDesktopProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  showSearch: boolean;
  user: User;
  onSubmitSearch: () => void;
}

const SupportCenterNavbarDesktop: React.FC<SupportCenterNavbarDesktopProps> = ({
  search,
  setSearch,
  showSearch,
  user,
  onSubmitSearch,
}) => {
  return (
    <div className="flex flex-row bg-white h-fit py-2 px-4 shadow-md border-b border-b-gray-400 items-center justify-between">
      <div className="flex flex-row items-center flex-shrink-0">
        <div className="flex ml-2 mt-0.5">
          <Launchpad />
        </div>
        <div
          className="flex flex-row items-center cursor-pointer"
          onClick={() => window.location.assign("/support")}
        >
          <Image
            src="https://cdn.libretexts.net/Logos/libretexts_full.png"
            className="h-12 ml-6"
          />
          <span className="flex ml-2 base:text-xl lg:text-2xl font-semibold text-nowrap">
            | Support Center
          </span>
        </div>
      </div>
      <div className="flex flex-1 justify-center px-4 items-center pb-1">
        <form
          className="ml-8 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch();
          }}
        >
          {showSearch && (
            <Input
              name="search-input"
              label=""
              placeholder="Search LibreTexts Insight..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              rightIcon={<IconSearch />}
            />
          )}
        </form>
      </div>
      <div className="flex flex-row items-center flex-shrink-0 gap-4">
        {/* Redirect to Conductor if logged in, else to Commons */}
        <Button
          className=""
          as={Link}
          to={user && user.uuid ? "/home" : "/"}
          variant="outline"
        >
          Back to {user && user.uuid ? "Conductor" : "Commons"}
        </Button>
        {(user.isSupport || user.isHarvester) ? (
          <Button
            as={Link}
            to="/support/dashboard"
            variant="outline"
            icon={<IconTicket />}
          >
            Staff Dashboard
          </Button>
        ) : (
          <>
            {user && user.uuid ? (
              <Button
                className=""
                as={Link}
                to="/support/dashboard"
                variant="secondary"
                icon={<IconTicket />}
              >
                My Tickets
              </Button>
            ) : (
              <Button
                variant="outline"
                as="a"
                href={AuthHelper.generateLoginURL("/support")}
                icon={<IconLogin2 />}
              >
                Login with LibreOne
              </Button>
            )}
            <Button
              as={Link}
              to="/support/contact"
              variant="outline"
              icon={<IconLifebuoy />}
            >
              Contact Support
            </Button>
          </>
        )}
        {user && user.uuid && <UserDropdown />}
      </div>
    </div>
  );
};

export default SupportCenterNavbarDesktop;
