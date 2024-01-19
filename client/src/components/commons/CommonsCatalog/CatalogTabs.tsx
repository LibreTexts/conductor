import {
  forwardRef,
  ForwardedRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { TabProps, Label, Icon, Checkbox } from "semantic-ui-react";
import {
  AssetFilters,
  Book,
  BookFilters,
  Project,
  ProjectFileWCustomData,
} from "../../../types";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";
import CatalogTab from "./CatalogTab";
import BooksTable from "./BooksTable";
import VisualMode from "./VisualMode";
import AssetsTable from "./AssetsTable";
import ProjectsTable from "./ProjectsTable";
import TabLabel from "./CatalogTabLabel";

interface CatalogTabsProps extends TabProps {
  assetFilters: AssetFilters;
  bookFilters: BookFilters;
  strictMode: boolean;
}

type CatalogTabsRef = {
  getActiveTab: () => "books" | "assets" | "projects";
  setActiveTab: (tab: "books" | "assets" | "projects") => void;
  loadInitialCatalogs: () => void;
  runSearch: (query: string) => void;
  resetSearch: () => void;
};

const CatalogTabs = forwardRef(
  (props: CatalogTabsProps, ref: ForwardedRef<CatalogTabsRef>) => {
    const { paneProps, bookFilters, assetFilters, strictMode, ...rest } = props;

    const ITEMS_PER_PAGE = 24;
    const { handleGlobalError } = useGlobalError();
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [itemizedMode, setItemizedMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState<string>("");

    const [books, setBooks] = useState<Book[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [booksCount, setBooksCount] = useState<number>(0);

    const [assets, setAssets] = useState<
      ProjectFileWCustomData<"projectTitle" | "projectThumbnail", "projectID">[]
    >([]);
    const [assetsCount, setAssetsCount] = useState<number>(0);

    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsCount, setProjectsCount] = useState<number>(0);

    useImperativeHandle(ref, () => ({
      getActiveTab: () => {
        return computeActiveTabFromIDX(activeIndex);
      },
      setActiveTab: (tab: "books" | "assets" | "projects") => {
        const idx = tab === "books" ? 0 : tab === "assets" ? 1 : 2;
        setActiveIndex(idx);
      },
      loadInitialCatalogs: () => {
        _loadInitialCatalogs();
      },
      runSearch: (query) => {
        setSearchQuery(query);
        _runSearch(query);
      },
      resetSearch: () => {
        _resetSearch();
      },
    }));

    useEffect(() => {
      _loadInitialCatalogs();
    }, []);

    async function _loadInitialCatalogs() {
      try {
        setLoading(true);
        await Promise.all([
          loadCommonsCatalog(),
          loadPublicAssets(),
          loadPublicProjects(),
        ]);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
      }
    }

    async function _runSearch(query?: string) {
      try {
        setLoading(true);
        setActivePage(1);

        await Promise.all([
          handleBooksSearch(query, true),
          handleAssetsSearch(query, true),
          handleProjectsSearch(query, true),
        ]);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
      }
    }

    async function _resetSearch() {
      setActivePage(1);
      setBooks([]);
      setAssets([]);
      setProjects([]);
      _loadInitialCatalogs();
    }

    // Books
    async function loadCommonsCatalog() {
      try {
        const res = await api.getCommonsCatalog({
          activePage: activePage,
          limit: ITEMS_PER_PAGE,
        });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.books)) {
          setBooks([...books, ...res.data.books]);
        }
        if (typeof res.data.numTotal === "number") {
          setBooksCount(res.data.numTotal);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    async function handleBooksSearch(query?: string, clearIfNone = false) {
      try {
        const res = await api.booksSearch({
          searchQuery: query,
          strictMode,
          page: activePage,
          limit: ITEMS_PER_PAGE,
          ...bookFilters,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          updateBooks(
            res.data.results,
            res.data.results.length === 0 && clearIfNone ? true : false
          );
        }

        if (typeof res.data.numResults === "number") {
          setBooksCount(res.data.numResults);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    // Assets
    async function loadPublicAssets() {
      try {
        const res = await api.getPublicProjectFiles({
          page: activePage,
          limit: ITEMS_PER_PAGE,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.files)) {
          setAssets([...assets, ...res.data.files]);
        }
        if (typeof res.data.totalCount === "number") {
          setAssetsCount(res.data.totalCount);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    async function handleAssetsSearch(query?: string, clearIfNone = false) {
      try {
        const res = await api.assetsSearch({
          searchQuery: query,
          strictMode,
          page: activePage,
          limit: ITEMS_PER_PAGE,
          ...assetFilters,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          updateAssets(
            res.data.results,
            res.data.results.length === 0 && clearIfNone ? true : false
          );
        }
        if (typeof res.data.numResults === "number") {
          setAssetsCount(res.data.numResults);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    // Projects
    async function loadPublicProjects() {
      try {
        const res = await api.getPublicProjects({
          page: activePage,
          limit: ITEMS_PER_PAGE,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (Array.isArray(res.data.projects)) {
          setProjects([...projects, ...res.data.projects]);
        }
        if (typeof res.data.totalCount === "number") {
          setProjectsCount(res.data.totalCount);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    async function handleProjectsSearch(query?: string, clearIfNone = false) {
      try {
        const res = await api.projectsSearch({
          searchQuery: query,
          strictMode: false,
          page: activePage,
          limit: ITEMS_PER_PAGE,
        });

        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        if (!res.data.results) {
          throw new Error("No results found.");
        }

        if (Array.isArray(res.data.results)) {
          updateProjects(
            res.data.results,
            res.data.results.length === 0 && clearIfNone ? true : false
          );
        }

        if (typeof res.data.numResults === "number") {
          setProjectsCount(res.data.numResults);
        }
      } catch (err) {
        handleGlobalError(err);
      }
    }

    function computeActiveTabFromIDX(idx: number) {
      const activeTab = idx === 0 ? "books" : idx === 1 ? "assets" : "projects";
      return activeTab;
    }

    function handleLoadMoreBooks() {
      setActivePage(activePage + 1);
      if (!searchQuery) {
        return loadCommonsCatalog();
      } else {
        return handleBooksSearch(searchQuery);
      }
    }

    function handleLoadMoreAssets() {
      setActivePage(activePage + 1);
      if (!searchQuery) {
        return loadPublicAssets();
      } else {
        return handleAssetsSearch(searchQuery);
      }
    }

    function handleLoadMoreProjects() {
      setActivePage(activePage + 1);
      if (!searchQuery) {
        return loadPublicProjects();
      } else {
        return handleProjectsSearch(searchQuery);
      }
    }

    /**
     * This is a workaround to handle cases where we want to clear the existing state,
     * but React doesn't update the state immediately/recognize the change.
     * This helps us distinguish between the case where a new search was ran and no results were found,
     * and the case where we are just loading more results, and don't want to clear the existing state.
     */
    function updateAssets(
      newAssets: ProjectFileWCustomData<
        "projectTitle" | "projectThumbnail",
        "projectID"
      >[],
      clear = false
    ) {
      if (clear) {
        setAssets([]);
      } else {
        setAssets([...assets, ...newAssets]);
      }
    }

    function updateBooks(newBooks: Book[], clear = false) {
      if (clear) {
        setBooks([]);
      } else {
        setBooks([...books, ...newBooks]);
      }
    }

    function updateProjects(newProjects: Project[], clear = false) {
      if (clear) {
        setProjects([]);
      } else {
        setProjects([...projects, ...newProjects]);
      }
    }

    function handleTabChange(index: number) {
      setActiveIndex(index);
      setActivePage(1);
      if(index === 0) {
        setBooks([]);
      }
      if(index === 1) {
        setAssets([]);
      }
      if(index === 2) {
        setProjects([]);
      }
    }

    return (
      <div className="custom-tabs">
        <div className="flex flex-row justify-between border-b border-gray-300 mb-2 mx-1">
          <div className="flex flex-row px-0.5 items-center">
            <TabLabel
              title="Books"
              index={0}
              itemsCount={booksCount}
              activeIndex={activeIndex}
              onClick={handleTabChange}
              loading={loading}
            />
            <TabLabel
              title="Assets"
              index={1}
              itemsCount={assetsCount}
              activeIndex={activeIndex}
              onClick={handleTabChange}
              loading={loading}
            />
            <TabLabel
              title="Projects"
              index={2}
              itemsCount={projectsCount}
              activeIndex={activeIndex}
              onClick={handleTabChange}
              loading={loading}
            />
          </div>
          <div className="flex flex-row items-center mr-1">
            <label
              className="mt-0.5 font-semibold mr-2"
              htmlFor="itemizedModeCheckbox"
            >
              Itemized Mode
            </label>
            <Checkbox
              id="itemizedModeCheckbox"
              toggle
              checked={itemizedMode}
              onChange={() => setItemizedMode(!itemizedMode)}
            />
          </div>
        </div>
        <div className="tab-content">
          {activeIndex === 0 && (
            <CatalogTab
              key={"books-tab"}
              itemizedMode={itemizedMode}
              dataLength={books.length}
              totalLength={booksCount}
              getNextPage={handleLoadMoreBooks}
              itemizedRender={<BooksTable items={books} />}
              visualRender={<VisualMode items={books} />}
            />
          )}
          {activeIndex === 1 && (
            <CatalogTab
              key={"assets-tab"}
              itemizedMode={itemizedMode}
              dataLength={assets.length}
              totalLength={assetsCount}
              getNextPage={handleLoadMoreAssets}
              itemizedRender={<AssetsTable items={assets} />}
              visualRender={<VisualMode items={assets} />}
            />
          )}
          {activeIndex === 2 && (
            <CatalogTab
              key={"projects-tab"}
              itemizedMode={itemizedMode}
              dataLength={projects.length}
              totalLength={projectsCount}
              getNextPage={handleLoadMoreProjects}
              itemizedRender={<ProjectsTable items={projects} />}
              visualRender={<VisualMode items={projects} />}
            />
          )}
        </div>
      </div>
    );
  }
);

export default CatalogTabs;
