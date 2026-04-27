import {
  Book,
  ConductorSearchResponseAuthor,
  ConductorSearchResponseFile,
  Project,
} from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";
import PlaceholderCard from "./PlaceholderCard";
import { useState } from "react";
import DetailModal from "./DetailModal";

const VisualMode = ({
  items,
  loading,
  noResultsMessage,
}: {
  items: (
    | Book
    | ConductorSearchResponseFile
    | Project
    | ConductorSearchResponseAuthor
  )[];
  loading?: boolean;
  noResultsMessage?: string;
}) => {
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | Book
    | ConductorSearchResponseFile
    | Project
    | ConductorSearchResponseAuthor
    | undefined
  >(undefined);

  if (items.length > 0) {
    return (
      <>
        <div className="commons-content-card-grid ">
          {items.map((item) => (
            <CatalogCard
              item={item}
              key={crypto.randomUUID()}
              onDetailClick={() => {
                setSelectedItem(item);
                setDetailModalOpen(true);
              }}
            />
          ))}
          {loading && (
            <>
              {[...Array(10)].map((_, index) => (
                <PlaceholderCard key={index} />
              ))}
            </>
          )}
        </div>
        <DetailModal
          item={selectedItem}
          open={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedItem(undefined);
          }}
        />
      </>
    );
  }

  if (items.length === 0 && loading) {
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
        {noResultsMessage ??
          "No results found - Try adjusting your search or filters."}
      </p>
    </div>
  );
};

export default VisualMode;
