import { Link } from "react-router-dom";
import { Button, Form, Icon, Image } from "semantic-ui-react";
import Launchpad from "../Launchpad.js";
import AuthHelper from "../../util/AuthHelper.js";
import UserDropdown from "../UserDropdown.js";
import { User } from "../../../types/User.js";

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
    <div className="flex flex-row bg-white h-fit py-2 px-4 shadow-md border-b items-center justify-between">
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
      <div className="flex flex-1 justify-center px-4">
        <Form
          className="ml-8 w-full mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch();
          }}
        >
          {showSearch && (
            <Form.Input
              placeholder="Search LibreTexts Insight..."
              icon="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Form>
      </div>
      <div className="flex flex-row items-center flex-shrink-0">
        {/* Redirect to Conductor if logged in, else to Commons */}
        <Button
          className="h-10 !w-48 !mr-4"
          as={Link}
          to={user && user.uuid ? "/home" : "/"}
          size="small"
        >
          Back to {user && user.uuid ? "Conductor" : "Commons"}
        </Button>
        {(user.isSupport || user.isHarvester) ? (
          <Button
            className="h-10"
            color="blue"
            as={Link}
            to="/support/dashboard"
            size="small"
          >
            Staff Dashboard
          </Button>
        ) : (
          <>
            {user && user.uuid ? (
              <Button
                className="h-10 !w-44"
                color="blue"
                as={Link}
                to="/support/dashboard"
                size="small"
              >
                <Icon name="ticket" />
                My Tickets
              </Button>
            ) : (
              <Button
                className="h-10 !w-52"
                color="blue"
                as="a"
                href={AuthHelper.generateLoginURL("/support")}
                size="small"
                basic
              >
                <Icon name="sign in" />
                Login with LibreOne
              </Button>
            )}
            <Button
              className="h-10 !w-44 !ml-2"
              color="blue"
              as={Link}
              to="/support/contact"
              size="small"
            >
              <Icon name="text telephone" />
              Contact Support
            </Button>
          </>
        )}
        <div className="ml-4">{user && user.uuid && <UserDropdown />}</div>
      </div>
    </div>
  );
};

export default SupportCenterNavbarDesktop;
