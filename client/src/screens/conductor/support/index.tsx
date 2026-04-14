import DefaultLayout from "../../../components/navigation/AlternateLayout";
import SupportCenterJumbotron from "../../../components/support/Jumbotron";
import { Icon, SemanticICONS } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import { useMediaQuery } from "react-responsive";
import { useDocumentTitle } from "usehooks-ts";

const SupportCenter = () => {
  useDocumentTitle("LibreTexts | Support Center");
  const user = useTypedSelector((state) => state.user);
  const isTailwindLg = useMediaQuery({ minWidth: 1024 });

  const officeHoursAvailable = (): boolean => {
    // Office hours are available tuesday and thursday from 9am to 10am Pacific Time (use a 30 minute buffer on either side)
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    // Detect if Pacific Time is in DST
    const january = new Date(now.getFullYear(), 0, 1);
    const july = new Date(now.getFullYear(), 6, 1);
    const stdOffset = Math.max(
      january.getTimezoneOffset(),
      july.getTimezoneOffset(),
    );
    const isDST = now.getTimezoneOffset() < stdOffset;

    // Pacific Time is UTC-8 (standard) or UTC-7 (DST)
    // 8:30am PT = 16:30 UTC (standard) or 15:30 UTC (DST)
    // 10:30am PT = 18:30 UTC (standard) or 17:30 UTC (DST)
    const utcOffset = isDST ? 7 : 8;
    const startHour = 8 + utcOffset; // 15 or 16
    const endHour = 10 + utcOffset; // 17 or 18

    const isCorrectDay = day === 2 || day === 4; // Tuesday or Thursday
    const isInTimeWindow =
      (hour === startHour && minute >= 30) ||
      hour === startHour + 1 ||
      (hour === endHour && minute < 30);

    return isCorrectDay && isInTimeWindow;
  };

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
          disabled
            ? "opacity-70 !cursor-not-allowed"
            : "opacity-100 hover:shadow-xl"
        }`}
        aria-disabled={disabled}
      >
        <div className="w-16 h-16 my-8">
          <Icon name={icon} size="huge" className="text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-center">{title}</h2>
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
      <div className="lt-legacy flex flex-col lg:flex-row w-full justify-center my-0 lg:my-12 flex-grow !h-auto">
        <HomeItem
          title="Contact Support"
          text="Contact the LibreTexts Support Team for help"
          icon="text telephone"
          link="/support/contact"
        />
        <HomeItem
          title="Connections"
          text="Connect and converse with fellow instructors and OER authors (Verified Instructors only)."
          icon="comments"
          link="/support/connections"
        />
        <HomeItem
          title="Insight"
          text="Search Insight for help with all of your LibreTexts apps &
          services."
          icon="question circle outline"
          link="/insight"
        />
        <HomeItem
          title="Office Hours"
          text="Join our office hours to get live help from the LibreTexts Team. Tuesdays & Thursdays, 9am-10am Pacific Time"
          icon="video"
          link="https://zoom.libretexts.org"
          disabled={!officeHoursAvailable()}
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
            title={
              user.isSupport || user.isHarvester
                ? "Staff Dashboard"
                : "My Tickets"
            }
            text="View and manage support tickets."
            icon={user.isSupport || user.isHarvester ? "user doctor" : "ticket"}
            link="/support/dashboard"
          />
        )}
      </div>
    </DefaultLayout>
  );
};

export default SupportCenter;
