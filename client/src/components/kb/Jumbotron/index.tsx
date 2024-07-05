import KBSearchForm from "../KBSearchForm";

const KBJumbotron: React.FC<{}> = ({}) => {
  return (
    <div
      id="kb-jumbotron"
      className="z-50 h-80 flex flex-col items-center justify-center bg-primary"
    >
      <h1 className="text-5xl text-white font-bold">LibreTexts Insight</h1>
      <p className="text-white text-xl mt-2 px-4 lg:px-0 text-center">
        Search Insight for help with all of your LibreTexts apps & services.
      </p>
      <div className="mt-8 w-full">
        <KBSearchForm />
      </div>
      <a className="mt-4 text-white underline" href="/insight/welcome">
        View All Content
      </a>
    </div>
  );
};

export default KBJumbotron;
