import { useState } from "react";
import { TabProps, Checkbox, Icon, Popup } from "semantic-ui-react";
import {
  AssetFilters,
  AssetFiltersAction,
  Author,
  AuthorFilters,
  AuthorFiltersAction,
  Book,
  BookFilters,
  BookFiltersAction,
  CommonsModule,
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
import { useTypedSelector } from "../../../state/hooks";
import AuthorsTable from "./AuthorsTable";
import CatalogAuthorFilters from "./CatalogAuthorFilters";

interface CatalogTabsProps extends TabProps {
  activeTab: CommonsModule;
  assetFilters: AssetFilters;
  assetFiltersDispatch: React.Dispatch<{ type: string; payload: string }>;
  bookFilters: BookFilters;
  bookFiltersDispatch: React.Dispatch<BookFiltersAction>;
  authorFilters: AuthorFilters;
  authorFiltersDispatch: React.Dispatch<AuthorFiltersAction>;
  onActiveTabChange: (newTab: CommonsModule) => void;
  books: Book[];
  booksCount: number;
  booksLoading: boolean;
  assets: ProjectFileWProjectData<"title" | "thumbnail">[];
  assetsCount: number;
  assetsLoading: boolean;
  projects: Project[];
  projectsCount: number;
  projectsLoading: boolean;
  authors: Author[];
  authorsCount: number;
  authorsLoading: boolean;
  onLoadMoreBooks: () => void;
  onLoadMoreAssets: () => void;
  onLoadMoreProjects: () => void;
  onLoadMoreAuthors: () => void;
  onTriggerStopLoading: () => void;
}

const CatalogTabs: React.FC<CatalogTabsProps> = ({
  activeTab,
  assetFilters,
  assetFiltersDispatch,
  authorFilters,
  authorFiltersDispatch,
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
  authors,
  authorsCount,
  authorsLoading,
  onLoadMoreBooks,
  onLoadMoreAssets,
  onLoadMoreProjects,
  onLoadMoreAuthors,
  onTriggerStopLoading,
  ...rest
}) => {
  const org = useTypedSelector((state) => state.org);
  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);

  const jumpToBottom = () => {
    onTriggerStopLoading();
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  const RenderTabLabels = () => {
    const moduleSettings = org.commonsModules;
    const labels = [];

    // If module settings are not available, show all tabs
    if (!moduleSettings || moduleSettings.books.enabled) {
      labels.push(
        <TabLabel
          title="Books"
          index="books"
          itemsCount={booksCount}
          loading={booksLoading}
          isActive={activeTab === "books"}
          onClick={() => onActiveTabChange("books")}
          key={"books-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.assets.enabled) {
      labels.push(
        <TabLabel
          title="Assets"
          index="assets"
          itemsCount={assetsCount}
          loading={assetsLoading}
          isActive={activeTab === "assets"}
          onClick={() => onActiveTabChange("assets")}
          key={"assets-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.projects.enabled) {
      labels.push(
        <TabLabel
          title="Projects"
          index="projects"
          itemsCount={projectsCount}
          loading={projectsLoading}
          isActive={activeTab === "projects"}
          onClick={() => onActiveTabChange("projects")}
          key={"projects-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.authors.enabled) {
      labels.push(
        <TabLabel
          title="Authors"
          index="authors"
          itemsCount={authorsCount}
          loading={authorsLoading}
          isActive={activeTab === "authors"}
          onClick={() => onActiveTabChange("authors")}
          key={"authors-tab-label"}
        />
      );
    }

    labels.sort((a, b) => {
      const aIndex = a.props.index;
      const bIndex = b.props.index;
      if (moduleSettings) {
        return (
          moduleSettings[aIndex as CommonsModule].order -
          moduleSettings[bIndex as CommonsModule].order
        );
      }
      return 0;
    });

    return <>{labels}</>;
  };

  return (
    <div className="custom-tabs">
      <div className="flex flex-row justify-between border-b border-gray-300 mb-2 mx-1">
        <div className="flex flex-row px-0.5 items-center">
          <RenderTabLabels />
        </div>
        <div className="flex flex-row items-center mb-1">
          <Popup
            trigger={
              <button
                onClick={() => {
                  jumpToBottomClicked
                    ? window.location.reload()
                    : jumpToBottom();
                }}
                className="bg-slate-100 text-black border border-slate-300 rounded-md mr-2 !pl-1.5 p-1 shadow-sm hover:shadow-md"
                aria-label={
                  jumpToBottomClicked
                    ? "Refresh to continue browsing"
                    : "Jump to bottom"
                }
              >
                {jumpToBottomClicked ? (
                  <Icon name="refresh" />
                ) : (
                  <Icon name="arrow down" />
                )}
              </button>
            }
            content={
              jumpToBottomClicked
                ? "Refresh to continue browsing"
                : "Jump to bottom"
            }
          />
          <Popup
            trigger={
              <button
                onClick={() => {
                  setItemizedMode(!itemizedMode);
                }}
                className="bg-slate-100 text-black border border-slate-300 rounded-md !pl-1.5 p-1 shadow-sm hover:shadow-md"
                aria-label={
                  itemizedMode
                    ? "Switch to visual mode"
                    : "Switch to itemized mode"
                }
              >
                {itemizedMode ? (
                  <Icon name="grid layout" />
                ) : (
                  <Icon name="list layout" />
                )}
              </button>
            }
            content={
              itemizedMode ? "Switch to visual mode" : "Switch to itemized mode"
            }
          />
        </div>
      </div>
      <div className="tab-content">
        {activeTab === "books" && (
          <CatalogBookFilters
            filters={bookFilters}
            onFilterChange={(type, value) =>
              bookFiltersDispatch({ type, payload: value })
            }
          />
        )}
        {activeTab === "assets" && (
          <CatalogAssetFilters
            filters={assetFilters}
            onFilterChange={(type, value) =>
              assetFiltersDispatch({ type, payload: value })
            }
          />
        )}
        {activeTab === "authors" && (
          <CatalogAuthorFilters
            filters={authorFilters}
            onFilterChange={(type, value) =>
              authorFiltersDispatch({ type, payload: value })
            }
          />
        )}
        {activeTab === "books" && (
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
        {activeTab === "assets" && (
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
        {activeTab === "projects" && (
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
        {activeTab === "authors" && (
          <CatalogTab
            key={"authors-tab"}
            itemizedMode={itemizedMode}
            dataLength={authors.length}
            totalLength={authorsCount}
            getNextPage={onLoadMoreAuthors}
            itemizedRender={<AuthorsTable items={authors} />}
            visualRender={
              <VisualMode items={authors} loading={authorsLoading} />
            }
          />
        )}
      </div>
    </div>
  );
};

export default CatalogTabs;
