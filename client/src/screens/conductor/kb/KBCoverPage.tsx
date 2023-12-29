import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import KBFooter from "../../../components/kb/KBFooter";

const KBCoverPage = () => {
  return (
    <DefaultLayoutWNavTree>
      <div className="flex flex-col text-center">
        <h1 className="text-4xl font-semibold">
          Welcome to LibreTexts Insight!
        </h1>
        <p className="mt-4">
          Insight is designed to help you find answers to your
          questions about the many LibreTexts apps and services (aka "the
          LibreVerse").
        </p>
      </div>
      <div className="mt-12">
        <KBFooter />
      </div>
    </DefaultLayoutWNavTree>
  );
};

export default KBCoverPage;
