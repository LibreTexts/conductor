import { useState } from "react";
import { TabProps, Checkbox } from "semantic-ui-react";
import {
  AssetFilters,
  AssetFiltersAction,
  Book,
  BookFilters,
  BookFiltersAction,
  Project,
  ProjectFileWProjectData,
} from "../../../types";
import CatalogTab from "./CatalogTab";
import BooksTable from "./BooksTable";
import VisualMode from "./VisualMode";
import AssetsTable from "./AssetsTable";
import ProjectsTable from "./ProjectsTable";
import TabLabel from "./CatalogTabLabel";
import CatalogBookFilters from "./CatalogBookFilters";
import CatalogAssetFilters from "./CatalogAssetFilters";

interface CatalogTabsProps extends TabProps {
  activeIndex: number;
  assetFilters: AssetFilters;
  assetFiltersDispatch: React.Dispatch<AssetFiltersAction>;
  bookFilters: BookFilters;
  bookFiltersDispatch: React.Dispatch<BookFiltersAction>;
  onActiveTabChange: (index: number) => void;
  books: Book[];
  booksCount: number;
  booksLoading: boolean;
  assets: ProjectFileWProjectData<"title" | "thumbnail">[];
  assetsCount: number;
  assetsLoading: boolean;
  projects: Project[];
  projectsCount: number;
  projectsLoading: boolean;
  onLoadMoreBooks: () => void;
  onLoadMoreAssets: () => void;
  onLoadMoreProjects: () => void;
  onTriggerStopLoading: () => void;
}

const CatalogTabs: React.FC<CatalogTabsProps> = ({
  activeIndex,
  assetFilters,
  assetFiltersDispatch,
  bookFilters,
  bookFiltersDispatch,
  onActiveTabChange,
  books,
  booksCount,
  booksLoading,
  assets,
  assetsCount,
  assetsLoading,
  projects,
  projectsCount,
  projectsLoading,
  onLoadMoreBooks,
  onLoadMoreAssets,
  onLoadMoreProjects,
  onTriggerStopLoading,
  ...rest
}) => {
  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);

  const jumpToBottom = () => {
    onTriggerStopLoading();
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  return (
    <div className="custom-tabs">
      <div className="flex flex-row justify-between border-b border-gray-300 mb-2 mx-1">
        <div className="flex flex-row px-0.5 items-center">
          <TabLabel
            title="Books"
            index={0}
            itemsCount={booksCount}
            loading={booksLoading}
            activeIndex={activeIndex}
            onClick={() => onActiveTabChange(0)}
          />
          <TabLabel
            title="Assets"
            index={1}
            itemsCount={assetsCount}
            loading={assetsLoading}
            activeIndex={activeIndex}
            onClick={() => onActiveTabChange(1)}
          />
          <TabLabel
            title="Projects"
            index={2}
            itemsCount={projectsCount}
            loading={projectsLoading}
            activeIndex={activeIndex}
            onClick={() => onActiveTabChange(2)}
          />
        </div>
        <div className="flex flex-row items-center mr-1 mb-1">
          <button
            onClick={() => {
              jumpToBottomClicked ? window.location.reload() : jumpToBottom();
            }}
            className="bg-slate-100 text-black mr-4 border border-slate-300 rounded-md px-2 py-1 shadow-sm hover:shadow-md"
          >
            {jumpToBottomClicked
              ? "Refresh Page to Continue Browsing"
              : "Jump to Bottom"}
          </button>
          <label className="font-semibold mr-2" htmlFor="itemizedModeCheckbox">
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
          <CatalogBookFilters
            filters={bookFilters}
            onFilterChange={(type, value) =>
              bookFiltersDispatch({ type, payload: value })
            }
          />
        )}
        {activeIndex === 1 && (
          <CatalogAssetFilters
            filters={assetFilters}
            onFilterChange={(type, value) =>
              assetFiltersDispatch({ type, payload: value })
            }
          />
        )}
        {activeIndex === 0 && (
          <CatalogTab
            key={"books-tab"}
            itemizedMode={itemizedMode}
            dataLength={books.length}
            totalLength={booksCount}
            getNextPage={onLoadMoreBooks}
            itemizedRender={<BooksTable items={books} />}
            visualRender={<VisualMode items={books} loading={booksLoading} />}
          />
        )}
        {activeIndex === 1 && (
          <CatalogTab
            key={"assets-tab"}
            itemizedMode={itemizedMode}
            dataLength={assets.length}
            totalLength={assetsCount}
            getNextPage={onLoadMoreAssets}
            itemizedRender={<AssetsTable items={assets} />}
            visualRender={<VisualMode items={assets} loading={assetsLoading} />}
          />
        )}
        {activeIndex === 2 && (
          <CatalogTab
            key={"projects-tab"}
            itemizedMode={itemizedMode}
            dataLength={projects.length}
            totalLength={projectsCount}
            getNextPage={onLoadMoreProjects}
            itemizedRender={<ProjectsTable items={projects} />}
            visualRender={
              <VisualMode items={projects} loading={projectsLoading} />
            }
          />
        )}
      </div>
    </div>
  );
};

export default CatalogTabs;
