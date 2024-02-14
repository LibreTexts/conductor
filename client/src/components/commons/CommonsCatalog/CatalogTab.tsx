import { Button, TabPane, TabPaneProps } from "semantic-ui-react";
import InfiniteScroll from "react-infinite-scroll-component";

interface CatalogTabProps extends TabPaneProps {
  itemizedMode: boolean;
  dataLength: number;
  totalLength: number;
  getNextPage: () => void;
  itemizedRender: React.ReactNode;
  visualRender: React.ReactNode;
}

const CatalogTab: React.FC<CatalogTabProps> = ({
  itemizedMode,
  dataLength,
  totalLength,
  getNextPage,
  itemizedRender,
  visualRender,
  ...rest
}) => {
  return (
    <TabPane
      attached={false}
      className="!border-none !shadow-none !px-0 !pt-0 !rounded-md"
      {...rest}
    >
      <InfiniteScroll
        dataLength={dataLength}
        next={getNextPage}
        hasMore={dataLength < totalLength}
        loader={<p className="text-center font-semibold mt-4">Loading...</p>}
        endMessage={<p className="text-center mt-4 italic">End of Results</p>}
        height={800}
      >
        {itemizedMode ? itemizedRender : visualRender}
      </InfiniteScroll>
    </TabPane>
  );
};

export default CatalogTab;
