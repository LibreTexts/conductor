import { useEffect } from "react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import FeaturedList from "../../../components/kb/FeaturedList";
import KBJumbotron from "../../../components/kb/Jumbotron";
import Footer from "../../../components/navigation/Footer";

const KnowledgeBase = () => {
  useEffect(() => {
    document.title = "LibreTexts | Insight";
  }, []);
  
  return (
    <div>
      <DefaultLayout>
        <KBJumbotron />
        <FeaturedList />
        <div className="flex flex-col justify-end h-full"><Footer /></div>
      </DefaultLayout>
    </div>
  );
};

export default KnowledgeBase;
