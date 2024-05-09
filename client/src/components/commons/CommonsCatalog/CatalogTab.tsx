import { TabPane, TabPaneProps } from "semantic-ui-react";
import { cloneElement, useState } from "react";
import useInfiniteScroll from "../../../hooks/useInfiniteScroll";

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
  const { lastElementRef } = useInfiniteScroll({
    next: getNextPage,
    hasMore: dataLength < totalLength,
    isLoading: loading,
  });

  return (
    <TabPane
      attached={false}
      className="!flex flex-col !border-none !shadow-none !px-0 !pt-0 !rounded-md !mt-0 !pb-4 min-h-[800px] justify-between"
      {...rest}
    >
      {itemizedMode ? itemizedRender : visualRender}
      <div ref={lastElementRef}></div>
      {dataLength >= totalLength && (
        <div className="w-full mt-4">
          <p className="text-center font-semibold">End of results</p>
        </div>
      )}
    </TabPane>
  );
};

export default CatalogTab;
