import { useEffect } from "react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import SupportCenterJumbotron from "../../../components/support/Jumbotron";
import { Icon, SemanticICONS } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import { isSupportStaff } from "../../../utils/supportHelpers";
import { useMediaQuery } from "react-responsive";

const SupportCenter = () => {
  const user = useTypedSelector((state) => state.user);
  const isTailwindLg = useMediaQuery({ minWidth: 1024 });

  useEffect(() => {
    document.title = "LibreTexts | Support Center";
  }, []);

  const HomeItem = ({
    title,
    text,
    icon,
    link,
    disabled = false,
  }: {
    title: string;
    text: string;
    icon: SemanticICONS;
    link: string;
    disabled?: boolean;
  }) => {
    return (
      <div
        onClick={() => {
          if (!disabled) openLink(link);
        }}
        className={`flex flex-col h-80 w-96 p-4 mx-auto my-4 lg:m-4 border rounded-xl shadow-md items-center cursor-pointer ${
          disabled ? "opacity-50" : "opacity-100 hover:shadow-xl"
        }`}
        aria-disabled={disabled}
      >
        <div className="w-16 h-16 my-8">
          <Icon name={icon} size="huge" className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-center">{title}</h1>
        <p className="text-xl text-center mt-2">{text}</p>
      </div>
    );
  };

  function openLink(link: string) {
    window.location.href = link;
  }

  return (
    <DefaultLayout h={isTailwindLg ? "screen-content" : "screen"}>
      <SupportCenterJumbotron />
      <div
        className="flex flex-col lg:flex-row w-full justify-center my-0 lg:my-12 flex-grow !h-auto"
      >
        <HomeItem
          title="Contact Support"
          text="Contact the LibreTexts Support Team for help"
          icon="text telephone"
          link="/support/contact"
        />
        <HomeItem
          title="Insight"
          text="Search Insight for help with all of your LibreTexts apps &
          services."
          icon="question circle outline"
          link="/insight"
        />
        <HomeItem
          title="Systems Status"
          text="
          View systems status for all LibreTexts apps & services and check for known outages."
          icon="dashboard"
          link="https://status.libretexts.org"
        />
        {user?.uuid && (
          <HomeItem
            title={isSupportStaff(user) ? "Staff Dashboard" : "My Tickets"}
            text="View and manage support tickets."
            icon={isSupportStaff(user) ? "user doctor" : "ticket"}
            link="/support/dashboard"
          />
        )}
      </div>
    </DefaultLayout>
  );
};

export default SupportCenter;
