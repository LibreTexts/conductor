import { TabPane, TabPaneProps } from "semantic-ui-react";
import CatalogBookFilters from "./CatalogBookFilters";
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
import { Book, BookFilters } from "../../../types";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";

interface CatalogBookTabProps extends TabPaneProps {
  searchString: string;
  countUpdate?: (newCount: number) => void;
  bookFilters: BookFilters;
  strictMode: boolean;
}

type CatalogBookTabRef = {
  loadInitialCatalog: () => void;
  runSearch: () => void;
  resetSearch: () => void;
};

const CatalogBookTab = forwardRef(
  (props: CatalogBookTabProps, ref: ForwardedRef<CatalogBookTabRef>) => {
    const { countUpdate, searchString, bookFilters, strictMode, ...rest } =
      props;
    const { handleGlobalError } = useGlobalError();
    const catalogBookFiltersRef =
      useRef<React.ElementRef<typeof CatalogBookFilters>>(null);

    const [books, setBooks] = useState<Book[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [booksTotal, setBooksTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      loadInitialCatalog: () => {
        loadCommonsCatalog();
      },
      runSearch: () => {
        setActivePage(1); // reset page
        handleSearch();
      },
      resetSearch: () => {
        setActivePage(1); // reset page
        setBooks([]);
        loadCommonsCatalog();
      },
    }));

    useEffect(() => {
      loadCommonsCatalog();
    }, []);

    useEffect(() => {
      if (countUpdate) {
        countUpdate(booksTotal);
      }
    }, [booksTotal]);

    const isInitialSearch = useMemo(() => {
      return searchString === "" && Object.keys(bookFilters).length === 0;
    }, [searchString, bookFilters]);

    useEffect(() => {
      if (isInitialSearch) {
        loadCommonsCatalog();
      } else {
        handleSearch();
      }
    }, [activePage]);

    async function loadCommonsCatalog() {
      try {
        setLoading(true);
        const res = await api.getCommonsCatalog({
          activePage: activePage,
          limit: itemsPerPage,
        });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.books)) {
          setBooks([...books, ...res.data.books]);
        }
        if (typeof res.data.numTotal === "number") {
          setBooksTotal(res.data.numTotal);
        }
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
      }
    }

    async function handleSearch() {
      try {
        setLoading(true);

        const res = await api.booksSearch({
          searchQuery: searchString,
          strictMode,
          page: activePage,
          limit: itemsPerPage,
          ...bookFilters,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          setBooks([...books, ...res.data.results]);
        }

        if (typeof res.data.numResults === "number") {
          setBooksTotal(res.data.numResults);
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
        {/* <CatalogBookFilters
          ref={catalogBookFiltersRef}
          selectedFilters={selectedFilters}
          setSelectedFilters={(filters) => setSelectedFilters(filters)}
          strictMode={strictMode}
          onStrictModeChange={(mode) => setStrictMode(mode)}
        /> */}
        <InfiniteScroll
          dataLength={books.length}
          next={() => setActivePage(activePage + 1)}
          hasMore={books.length < booksTotal}
          loader={<p className="text-center font-semibold mt-4">Loading...</p>}
          endMessage={<p className="text-center mt-4 italic">End of Results</p>}
        >
          <VisualMode items={books} />
        </InfiniteScroll>
      </TabPane>
    );
  }
);

export default CatalogBookTab;
