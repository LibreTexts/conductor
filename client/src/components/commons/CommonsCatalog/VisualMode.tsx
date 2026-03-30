import {
  Book,
  Author,
  ConductorSearchResponseFile,
  Project,
} from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";
import PlaceholderCard from "./PlaceholderCard";
import { useState } from "react";
import DetailModal from "./DetailModal";
import { Grid } from "@libretexts/davis-react";

const VisualMode = ({
  items,
  loading,
  noResultsMessage,
}: {
  items: (
    | Book
    | ConductorSearchResponseFile
    | Project
    | Author
  )[];
  loading?: boolean;
  noResultsMessage?: string;
}) => {
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    | Book
    | ConductorSearchResponseFile
    | Project
    | Author
    | undefined
  >(undefined);

  if (items.length > 0) {
    return (
      <>
        <Grid cols={6} gap="lg">
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
        </Grid>
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
      <Grid cols={6}>
        {[...Array(10)].map((_, index) => (
          <PlaceholderCard key={index} />
        ))}
      </Grid>
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
