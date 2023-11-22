import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import withUserStateDependency from "../../enhancers/withUserStateDependency.jsx";
import { Button, Form, Icon, Image } from "semantic-ui-react";
import Launchpad from "../navigation/Launchpad.js";
import { useTypedSelector } from "../../state/hooks.js";
import { useMediaQuery } from "react-responsive";

const SupportCenterNavbar: React.FC<{}> = () => {
  const user = useTypedSelector((state) => state.user);
  const [isStaff, setIsStaff] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(true);

  const isTailwindXl = useMediaQuery(
    { minWidth: 1280 }, // Tailwind XL breakpoint
    undefined
  );

  useEffect(() => {
    if (user && user.isSuperAdmin) {
      setIsStaff(true);
    }
  }, [user]);

  useEffect(() => {
    // dont show search bar on /insight
    const split = window.location.href.split("/");
    const last = split[split.length - 1];
    if (last === "insight") {
      setShowSearch(false);
    } else {
      setShowSearch(true);
    }
  }, [window.location.href]);

  const handleSearch = () => {
    if (!search) return;
    window.location.href = `/insight/search?query=${encodeURIComponent(
      search
    )}`;
  };

  return (
    <div className="flex flex-row bg-white h-fit py-2 px-4 shadow-md border-b items-center justify-between">
      <div className="flex flex-row w-4/5">
        <div className="flex ml-2 mt-0.5">
          <Launchpad />
        </div>
        {isTailwindXl && (
          <div
            className="flex flex-row items-center cursor-pointer"
            onClick={() => window.location.assign("/support")}
          >
            <Image
              src="https://cdn.libretexts.net/Logos/libretexts_full.png"
              className="h-12 ml-6"
            />
            <span className="hidden lg:flex ml-2 text-2xl font-semibold">
              | Support Center
            </span>
          </div>
        )}
        <Form
          className="ml-8 w-3/5 xl:1/3 mt-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
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
      <div className="flex">
        {/* {user && (
          <Button
            className="h-10 !w-48"
            color="blue"
            as={Link}
            to="/home"
            size="small"
            basic
          >
            <Icon name="lightning" />
            Go to Conductor
          </Button>
        )}
        <Button
          className="h-10 !w-48"
          color="blue"
          as={Link}
          to="/"
          size="small"
          basic
        >
          <Icon name="book" />
          Go to Commons
        </Button> */}
        {isStaff ? (
          <Button
            className="h-10 !w-32"
            color="blue"
            as={Link}
            to="/support/dashboard"
            size="small"
          >
            Dashboard
          </Button>
        ) : (
          <Button
            className="h-10 !w-44"
            color="blue"
            as={Link}
            to="/support/contact"
            size="small"
          >
            <Icon name="text telephone" />
            Contact Support
          </Button>
        )}
      </div>
    </div>
  );
};

export default withUserStateDependency(SupportCenterNavbar);
