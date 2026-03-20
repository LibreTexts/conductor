import { Button } from "@libretexts/davis-react";

interface CatalogTabProps {
  itemizedMode: boolean;
  dataLength: number;
  totalLength: number;
  getNextPage: () => void;
  itemizedRender: React.ReactNode;
  visualRender: React.ReactNode;
  loading: boolean;
}

const CatalogTab: React.FC<CatalogTabProps> = ({
  itemizedMode,
  dataLength,
  totalLength,
  getNextPage,
  itemizedRender,
  visualRender,
  loading,
}) => {
  const hasMore = dataLength < totalLength;

  return (
    <div className="flex flex-col min-h-[800px] justify-between pt-0 pb-4">
      {itemizedMode ? itemizedRender : visualRender}

      {hasMore && (
        <div className="w-full mt-6 flex justify-center">
          <Button
            variant="secondary"
            onClick={getNextPage}
            disabled={loading}
            aria-label="Load more results"
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {!hasMore && dataLength > 0 && (
        <div className="w-full mt-4">
          <p className="text-center font-semibold">End of results</p>
        </div>
      )}
    </div>
  );
};

export default CatalogTab;
