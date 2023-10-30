import { useEffect } from "react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import SupportCenterJumbotron from "../../../components/support/Jumbotron";
import { Icon, SemanticICONS } from "semantic-ui-react";

const SupportCenter = () => {
  useEffect(() => {
    document.title = "LibreTexts | Support Center";
  }, []);

  const HomeItem = ({
    title,
    text,
    icon,
    link,
  }: {
    title: string;
    text: string;
    icon: SemanticICONS;
    link: string;
  }) => {
    return (
      <div
        onClick={() => openLink(link)}
        className="flex flex-col h-80 w-96 p-4 mx-auto my-4 lg:m-4 border rounded-xl shadow-md hover:shadow-xl items-center cursor-pointer"
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
      <div className="flex flex-col lg:flex-row w-full justify-center">
        <HomeItem
          title="Knowledge Base"
          text="Search the Knowledge Base for help with all of your LibreTexts apps &
          services."
          icon="question circle outline"
          link="/kb"
        />
        <HomeItem
          title="Contact Support"
          text="
          Contact the LibreTexts Support Team for help
          "
          icon="text telephone"
          link="/support/contact"
        />
      </div>
    </DefaultLayout>
  );
};

export default SupportCenter;
