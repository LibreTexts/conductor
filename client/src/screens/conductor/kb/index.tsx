import { useEffect } from "react";
import AlternativeLayout from "../../../components/navigation/AlternateLayout";
import FeaturedList from "../../../components/kb/FeaturedList";
import KBJumbotron from "../../../components/kb/Jumbotron";

const KnowledgeBase = () => {
  useEffect(() => {
    document.title = "LibreTexts | Insight";
  }, []);
  
  return (
    <AlternativeLayout>
      <KBJumbotron />
      <FeaturedList />
    </AlternativeLayout>
  );
};

export default KnowledgeBase;
