import { useEffect } from "react";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import FeaturedList from "../../../components/kb/FeaturedList";
import KBJumbotron from "../../../components/kb/Jumbotron";

const KnowledgeBase = () => {
  useEffect(() => {
    document.title = "LibreTexts | Knowledge Base";
  }, []);
  
  return (
    <DefaultLayout>
      <KBJumbotron />
      <FeaturedList />
    </DefaultLayout>
  );
};

export default KnowledgeBase;
