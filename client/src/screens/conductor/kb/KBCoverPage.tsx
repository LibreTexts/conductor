import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import KBFooter from "../../../components/kb/KBFooter";

const KBCoverPage = () => {
  return (
    <DefaultLayoutWNavTree>
      <div className="flex flex-col text-center">
        <h1 className="text-4xl font-semibold">
          Welcome to the LibreTexts Knowledge Base!
        </h1>
        <p className="mt-4">
          This knowledge base is designed to help you find answers to your
          questions about the many LibreTexts apps and services (aka "the
          LibreVerse").
        </p>
      </div>
      <KBFooter className="mt-8" />
    </DefaultLayoutWNavTree>
  );
};

export default KBCoverPage;
