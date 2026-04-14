import DefaultLayout from "../../../components/navigation/AlternateLayout";
import SupportCenterJumbotron from "../../../components/support/Jumbotron";
import { useTypedSelector } from "../../../state/hooks";
import { useDocumentTitle } from "usehooks-ts";
import { Card, Heading, Text } from "@libretexts/davis-react";
import { IconLifebuoy, IconMessages, IconProgressCheck, IconQuestionMark, IconTicket, IconVideoPlus } from "@tabler/icons-react";

const SupportCenter = () => {
  useDocumentTitle("LibreTexts | Support Center");
  const user = useTypedSelector((state) => state.user);
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

  const ICON_MAP = {
    contact: <IconLifebuoy size={72} className="text-primary" />,
    connections: <IconMessages size={72} className="text-primary" />,
    insight: <IconQuestionMark size={72} className="text-primary" />,
    officeHours: <IconVideoPlus size={72} className="text-primary" />,
    status: <IconProgressCheck size={72} className="text-primary" />,
    dashboard: <IconTicket size={72} className="text-primary" />,
  }

  const HomeItem = ({
    title,
    text,
    icon,
    link,
    disabled = false,
  }: {
    title: string;
    text: string;
    icon: JSX.Element;
    link: string;
    disabled?: boolean;
  }) => {
    return (
      <Card
        onClick={() => {
          if (!disabled) openLink(link);
        }}
        variant="elevated"
        padding="lg"
        className={`flex flex-col items-center text-center ${disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer hover:border-secondary hover:border-2"
          }`}
        aria-disabled={disabled}
      >
        <div className="">
          {icon}
        </div>
        <Heading level={2} className="text-center">
          {title}
        </Heading>
        <Text className="text-center mt-2">{text}</Text>
      </Card>
    );
  };

  function openLink(link: string) {
    window.location.href = link;
  }

  return (
    <DefaultLayout h="screen">
      <SupportCenterJumbotron />
      <div className="lt-legacy grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto px-6 py-12">
        <HomeItem
          title="Contact Support"
          text="Contact the LibreTexts Support Team for help"
          icon={ICON_MAP.contact}
          link="/support/contact"
        />
        <HomeItem
          title="Connections"
          text="Connect and converse with fellow instructors and OER authors (Verified Instructors only)."
          icon={ICON_MAP.connections}
          link="/support/connections"
        />
        <HomeItem
          title="Insight"
          text="Search Insight for help with all of your LibreTexts apps &
          services."
          icon={ICON_MAP.insight}
          link="/insight"
        />
        <HomeItem
          title="Office Hours"
          text="Join our office hours to get live help from the LibreTexts Team. Tuesdays & Thursdays, 9am-10am Pacific Time"
          icon={ICON_MAP.officeHours}
          link="https://zoom.libretexts.org"
          disabled={!officeHoursAvailable()}
        />
        <HomeItem
          title="Systems Status"
          text="
          View systems status for all LibreTexts apps & services and check for known outages."
          icon={ICON_MAP.status}
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
            icon={user.isSupport || user.isHarvester ? ICON_MAP.dashboard : ICON_MAP.dashboard}
            link="/support/dashboard"
          />
        )}
      </div>
    </DefaultLayout>
  );
};

export default SupportCenter;
