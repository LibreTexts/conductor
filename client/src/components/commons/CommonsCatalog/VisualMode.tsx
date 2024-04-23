import { Author, Book, Project, ProjectFileWProjectData } from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";
import PlaceholderCard from "./PlaceholderCard";

const VisualMode = ({
  items,
  loading,
  noResultsMessage,
}: {
  items: (Book | ProjectFileWProjectData<"title" | "thumbnail" | "description" | 'projectURL'> | Project | Author)[];
  loading?: boolean;
  noResultsMessage?: string;
}) => {
  if (items.length > 0) {
    return (
      <div className="commons-content-card-grid">
        {items.map((item, index) => (
          <CatalogCard item={item} key={crypto.randomUUID()} />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="commons-content-card-grid">
        {[...Array(10)].map((_, index) => (
          <PlaceholderCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="text-center italic">
        {noResultsMessage ?? "No results found - Try adjusting your search or filters."}
      </p>
    </div>
  );
};

export default VisualMode;
