import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import withUserStateDependency from "../../enhancers/withUserStateDependency.jsx";
import { Button, Icon, Image } from "semantic-ui-react";
import Launchpad from "../navigation/Launchpad.js";
import { useTypedSelector } from "../../state/hooks.js";

const SupportCenterNavbar: React.FC<{}> = () => {
  const user = useTypedSelector((state) => state.user);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (user && user.isSuperAdmin) {
      setIsStaff(true);
    }
  }, [user]);

  return (
    <div className="flex flex-row bg-white h-fit py-2 px-4 shadow-md border-b items-center justify-between">
      <div className="flex flex-row">
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
            <span className="hidden lg:flex ml-2 text-2xl font-semibold">
              | Support Center
            </span>
          </div>
        </div>
        <div className="flex">
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
