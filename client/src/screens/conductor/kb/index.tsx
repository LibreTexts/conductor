import DefaultLayout from "../../../components/kb/DefaultLayout";
import FeaturedList from "../../../components/kb/FeaturedList";
import KBJumbotron from "../../../components/kb/Jumbotron";

const KnowledgeBase = () => {
  return (
    <DefaultLayout>
      <KBJumbotron />
      <FeaturedList />
    </DefaultLayout>
  );
};

export default KnowledgeBase;
