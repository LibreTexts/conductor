import { TabPane, TabPaneProps } from "semantic-ui-react";
import Button from "../../NextGenComponents/Button";

interface CatalogTabProps extends TabPaneProps {
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
  ...rest
}) => {
  // Inline useInfiniteScroll - it was just a pass-through wrapper
  const loadMore = getNextPage;
  const hasMore = dataLength < totalLength;
  const isLoading = loading;

  return (
    <TabPane
      attached={false}
      className="!flex flex-col !border-none !shadow-none !px-0 !pt-0 !rounded-md !mt-0 !pb-4 min-h-[800px] justify-between"
      {...rest}
    >
      {itemizedMode ? itemizedRender : visualRender}

      {/* Load More Button - replaces automatic scroll detection */}
      {hasMore && (
        <div className="w-full mt-6 flex justify-center">
          <Button
            icon="IconDownload"
            onClick={loadMore}
            disabled={isLoading}
            aria-label="Load more results"
          >
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* End of results message */}
      {!hasMore && dataLength > 0 && (
        <div className="w-full mt-4">
          <p className="text-center font-semibold">End of results</p>
        </div>
      )}
    </TabPane>
  );
};

export default CatalogTab;
