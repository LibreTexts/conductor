import { TabPane, TabPaneProps } from "semantic-ui-react";
import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import VisualMode from "./VisualMode";
import { Project } from "../../../types";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";

interface CatalogProjectTabProps extends TabPaneProps {
  searchString: string;
  countUpdate?: (newCount: number) => void;
}

type CatalogProjectTabRef = {
  loadInitialCatalog: () => void;
  runSearch: () => void;
  resetSearch: () => void;
};

const CatalogProjectTab = forwardRef(
  (props: CatalogProjectTabProps, ref: ForwardedRef<CatalogProjectTabRef>) => {
    const { countUpdate, searchString, ...rest } = props;
    const { handleGlobalError } = useGlobalError();
    const [projects, setProjects] = useState<Project[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [projectsTotal, setProjectsTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      loadInitialCatalog: () => {
        loadPublicProjects();
      },
      runSearch: () => {
        setActivePage(1); // reset page
        handleSearch();
      },
      resetSearch: () => {
        setActivePage(1); // reset page
        loadPublicProjects();
      },
    }));

    useEffect(() => {
      loadPublicProjects();
    }, []);

    useEffect(() => {
      if (countUpdate) {
        countUpdate(projectsTotal);
      }
    }, [projectsTotal]);

    const isInitialSearch = useMemo(() => {
      return searchString === "";
    }, [searchString]);

    useEffect(() => {
      if (isInitialSearch) {
        loadPublicProjects();
      } else {
        handleSearch();
      }
    }, [activePage, searchString]);

    async function loadPublicProjects() {
      try {
        setLoading(true);
        const res = await api.getPublicProjects({
          page: activePage,
          limit: itemsPerPage,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.projects)) {
          setProjects([...projects, ...res.data.projects]);
        }
        if (typeof res.data.totalCount === "number") {
          setProjectsTotal(res.data.totalCount);
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

        const res = await api.projectsSearch({
          searchQuery: searchString,
          strictMode: false,
          page: activePage,
          limit: itemsPerPage,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          setProjects(res.data.results);
        }

        if (typeof res.data.numResults === "number") {
          setProjectsTotal(res.data.numResults);
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
        <InfiniteScroll
          dataLength={projects.length}
          next={() => setActivePage(activePage + 1)}
          hasMore={projects.length < projectsTotal}
          loader={<p className="text-center font-semibold mt-4">Loading...</p>}
          endMessage={<p className="text-center mt-4 italic">End of Results</p>}
        >
          <VisualMode items={projects} />
        </InfiniteScroll>
      </TabPane>
    );
  }
);

export default CatalogProjectTab;
