import { Book, Project, ProjectFileWProjectID } from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";
import PlaceholderCard from "./PlaceholderCard";

const VisualMode = ({
  items,
  loading,
}: {
  items: (Book | ProjectFileWProjectID | Project)[];
  loading?: boolean;
}) => {
  if (items.length > 0) {
    return (
      <div className="commons-content-card-grid">
        {items.map((item, index) => (
          <CatalogCard item={item} key={index} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="text-center italic">
        No results found - Try adjusting your search or filters.
      </p>
    </div>
  );
};

export default VisualMode;
