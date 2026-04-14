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
import { Grid, Text } from "@libretexts/davis-react";

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
        <Grid gap="lg" className="grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
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
      <Grid className="grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {[...Array(10)].map((_, index) => (
          <PlaceholderCard key={index} />
        ))}
      </Grid>
    );
  }

  return (
    <div>
      <Text className="text-center italic" role="alert">
        {noResultsMessage ??
          "No results found - Try adjusting your search or filters."}
      </Text>
    </div>
  );
};

export default VisualMode;
