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
  headingLevel,
}: {
  items: (
    | Book
    | ConductorSearchResponseFile
    | Project
    | Author
  )[];
  loading?: boolean;
  noResultsMessage?: string;
  headingLevel?: 2 | 3;
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
        {/* Davis Grid rendered as a real <ul>; role="list" restores the list
            semantics Chromium drops from a display:grid container (SC 1.3.1). */}
        <Grid
          as="ul"
          role="list"
          gap="lg"
          className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 list-none m-0 p-0"
        >
          {items.map((item) => (
            <li key={crypto.randomUUID()} className="h-full">
              <CatalogCard
                item={item}
                headingLevel={headingLevel}
                onDetailClick={() => {
                  setSelectedItem(item);
                  setDetailModalOpen(true);
                }}
              />
            </li>
          ))}
          {loading && (
            <>
              {[...Array(10)].map((_, index) => (
                // Skeletons are decorative; hide from AT so they don't inflate
                // the announced list count.
                <li key={index} aria-hidden="true" className="h-full">
                  <PlaceholderCard />
                </li>
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
      <Grid
        as="ul"
        role="list"
        className="grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 list-none m-0 p-0"
      >
        {[...Array(10)].map((_, index) => (
          // Skeletons are decorative; hide from AT (SC 1.3.1).
          <li key={index} aria-hidden="true" className="h-full">
            <PlaceholderCard />
          </li>
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
