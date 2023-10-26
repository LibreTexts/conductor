import FeaturedListArticleCard from "./FeaturedListArticleCard";

const FeaturedList = () => {
  return (
    <div className="p-8">
      <p className="text-3xl font-bold">Featured Content</p>
      <p className="text-xl font-semibold">
        Explore featured knowledge base articles and videos curated by the
        LibreTexts team.
      </p>
      <div className="mt-8">
        <p className="text-lg font-semibold">Featured Articles</p>
        <div className="mt-4">
        <FeaturedListArticleCard />
        </div>
      </div>
      <div className="mt-8">
        <p className="text-lg font-semibold">Featured Videos</p>
      </div>
    </div>
  );
};

export default FeaturedList;
