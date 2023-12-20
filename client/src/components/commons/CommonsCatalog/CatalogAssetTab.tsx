import { TabPane, TabPaneProps } from "semantic-ui-react";
import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import VisualMode from "./VisualMode";
import { AssetFilters, ProjectFileWProjectID } from "../../../types";
import CatalogAssetFilters from "./CatalogAssetFilters";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";

interface CatalogAssetTab extends TabPaneProps {
  searchString: string;
  countUpdate?: (newCount: number) => void;
}

type CatalogAssetTabRef = {
  loadInitialCatalog: () => void;
  runSearch: () => void;
  resetSearch: () => void;
};

const CatalogAssetTab = forwardRef(
  (props: CatalogAssetTab, ref: ForwardedRef<CatalogAssetTabRef>) => {
    const { countUpdate, searchString, ...rest } = props;

    const { handleGlobalError } = useGlobalError();
    const catalogAssetFiltersRef =
      useRef<React.ElementRef<typeof CatalogAssetFilters>>(null);

    const [files, setFiles] = useState<ProjectFileWProjectID[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [filesTotal, setFilesTotal] = useState(0);
    const [strictMode, setStrictMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<AssetFilters>({});

    useImperativeHandle(ref, () => ({
      loadInitialCatalog: () => {
        loadPublicAssets();
      },
      runSearch: () => {
        setActivePage(1); // reset page
        handleSearch();
      },
      resetSearch: () => {
        setActivePage(1); // reset page
        setSelectedFilters({});
        setStrictMode(false);
        loadPublicAssets();
      },
    }));

    useEffect(() => {
      loadPublicAssets();
    }, []);

    useEffect(() => {
      if (countUpdate) {
        countUpdate(filesTotal);
      }
    }, [filesTotal]);

    const isInitialSearch = useMemo(() => {
      return searchString === "" && Object.keys(selectedFilters).length === 0;
    }, [searchString, selectedFilters]);

    useEffect(() => {
      if (isInitialSearch) {
        loadPublicAssets();
      } else {
        handleSearch();
      }
    }, [activePage, itemsPerPage, selectedFilters]);

    async function loadPublicAssets() {
      try {
        setLoading(true);
        const res = await api.getPublicProjectFiles({
          page: activePage,
          limit: itemsPerPage,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.files)) {
          setFiles([...files, ...res.data.files]);
        }
        if (typeof res.data.totalCount === "number") {
          setFilesTotal(res.data.totalCount);
        }
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
      }
    }

    async function handleSearch() {
      try {
        console.log("assetsSearch");
        setLoading(true);

        const res = await api.assetsSearch({
          searchQuery: searchString,
          strictMode,
          page: activePage,
          limit: itemsPerPage,
          ...selectedFilters,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          setFiles(res.data.results);
        }
        if (typeof res.data.numResults === "number") {
          setFilesTotal(res.data.numResults);
        }
      } catch (err) {
        handleGlobalError(err);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    }

    return (
      <TabPane
        attached={false}
        className="!border-none !shadow-none !px-0 !pt-0 !rounded-md"
        {...rest}
      >
        <CatalogAssetFilters
          ref={catalogAssetFiltersRef}
          selectedFilters={selectedFilters}
          setSelectedFilters={(filters) => setSelectedFilters(filters)}
          strictMode={strictMode}
          onStrictModeChange={(mode) => setStrictMode(mode)}
        />
        <InfiniteScroll
          dataLength={files.length}
          next={() => setActivePage(activePage + 1)}
          hasMore={files.length < filesTotal}
          loader={<p className="text-center font-semibold mt-4">Loading...</p>}
          endMessage={<p className="text-center mt-4 italic">End of Results</p>}
        >
          <VisualMode items={files} />
        </InfiniteScroll>
      </TabPane>
    );
  }
);

export default CatalogAssetTab;
