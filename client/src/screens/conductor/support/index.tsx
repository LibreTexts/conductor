import { useEffect } from "react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import SupportCenterJumbotron from "../../../components/support/Jumbotron";
import { Icon, SemanticICONS } from "semantic-ui-react";
import CommonsFooter from "../../../components/commons/CommonsFooter";

const SupportCenter = () => {
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
    <DefaultLayout>
      <SupportCenterJumbotron />
      <div
        className="flex flex-col lg:flex-row w-full justify-center my-14 "
        style={{ minHeight: "50vh" }}
      >
        <HomeItem
          title="Contact Support"
          text="
          Contact the LibreTexts Support Team for help
          (Coming Soon!)
          "
          icon="text telephone"
          link="/support/contact"
          disabled
        />
        <HomeItem
          title="Knowledge Base"
          text="Search the Knowledge Base for help with all of your LibreTexts apps &
          services."
          icon="question circle outline"
          link="/kb"
        />
        <HomeItem
          title="Systems Status"
          text="
          View systems status for all LibreTexts apps & services and check for known outages."
          icon="doctor"
          link="https://status.libretexts.org"
        />
      </div>
      <CommonsFooter />
    </DefaultLayout>
  );
};

export default SupportCenter;
