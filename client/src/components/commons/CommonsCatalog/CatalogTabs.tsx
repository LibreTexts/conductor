import React, { useState } from "react";
import { Icon, Popup } from "semantic-ui-react";
import { CommonsModule } from "../../../types";
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
import CatalogProjectFilters from "./CatalogProjectFilters";
import CatalogMiniRepoFilters from "./CatalogMiniRepoFilters";
import { useCatalog } from "../../../context/CatalogContext";

const CatalogTabs: React.FC = () => {
  // Access all catalog data from context instead of props
  const catalog = useCatalog();
  const org = useTypedSelector((state) => state.org);
  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);

  const jumpToBottom = () => {
    catalog.triggerStopLoading();
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
          itemsCount={catalog.books.total}
          loading={catalog.books.loading}
          isActive={catalog.activeTab === "books"}
          onClick={() => catalog.setActiveTab("books")}
          key={"books-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.assets?.enabled) {
      labels.push(
        <TabLabel
          title="Assets"
          index="assets"
          itemsCount={catalog.assets.total}
          loading={catalog.assets.loading}
          isActive={catalog.activeTab === "assets"}
          onClick={() => catalog.setActiveTab("assets")}
          key={"assets-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.minirepos?.enabled) {
      labels.push(
        <TabLabel
          title="Mini-Repos"
          index="minirepos"
          itemsCount={catalog.miniRepos.total}
          loading={catalog.miniRepos.loading}
          isActive={catalog.activeTab === "minirepos"}
          onClick={() => catalog.setActiveTab("minirepos")}
          key={"minirepos-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.projects?.enabled) {
      labels.push(
        <TabLabel
          title="Projects"
          index="projects"
          itemsCount={catalog.projects.total}
          loading={catalog.projects.loading}
          isActive={catalog.activeTab === "projects"}
          onClick={() => catalog.setActiveTab("projects")}
          key={"projects-tab-label"}
        />
      );
    }

    if (!moduleSettings || moduleSettings.authors?.enabled) {
      labels.push(
        <TabLabel
          title="Authors"
          index="authors"
          itemsCount={catalog.authors.total}
          loading={catalog.authors.loading}
          isActive={catalog.activeTab === "authors"}
          onClick={() => catalog.setActiveTab("authors")}
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
        {catalog.activeTab === "books" && (
          <CatalogBookFilters
            filters={catalog.books.filters}
            onFilterChange={(type, value) => catalog.books.setFilter(type, value)}
          />
        )}
        {catalog.activeTab === "assets" && (
          <CatalogAssetFilters
            filters={catalog.assets.filters}
            onFilterChange={(type, value) => catalog.assets.setFilter(type, value)}
          />
        )}
        {catalog.activeTab === "authors" && (
          <CatalogAuthorFilters
            filters={catalog.authors.filters}
            onFilterChange={(type, value) => catalog.authors.setFilter(type, value)}
          />
        )}
        {catalog.activeTab === "minirepos" && (
          <CatalogMiniRepoFilters
            filters={catalog.miniRepos.filters}
            onFilterChange={(type, value) => catalog.miniRepos.setFilter(type, value)}
          />
        )}
        {catalog.activeTab === "projects" && (
          <CatalogProjectFilters
            filters={catalog.projects.filters}
            onFilterChange={(type, value) => catalog.projects.setFilter(type, value)}
          />
        )}
        {catalog.activeTab === "books" && (
          <CatalogTab
            key={"books-tab"}
            itemizedMode={itemizedMode}
            dataLength={catalog.books.data.length}
            totalLength={catalog.books.total}
            getNextPage={catalog.books.loadMore}
            loading={catalog.books.loading}
            itemizedRender={<BooksTable items={catalog.books.data} />}
            visualRender={<VisualMode items={catalog.books.data} loading={catalog.books.loading} />}
          />
        )}
        {catalog.activeTab === "assets" && (
          <CatalogTab
            key={"assets-tab"}
            itemizedMode={itemizedMode}
            dataLength={catalog.assets.data.length}
            totalLength={catalog.assets.total}
            getNextPage={catalog.assets.loadMore}
            loading={catalog.assets.loading}
            itemizedRender={<AssetsTable items={catalog.assets.data} />}
            visualRender={<VisualMode items={catalog.assets.data} loading={catalog.assets.loading} />}
          />
        )}
        {catalog.activeTab === "minirepos" && (
          <CatalogTab
            key={"minirepos-tab"}
            itemizedMode={itemizedMode}
            dataLength={catalog.miniRepos.data.length}
            totalLength={catalog.miniRepos.total}
            getNextPage={catalog.miniRepos.loadMore}
            loading={catalog.miniRepos.loading}
            itemizedRender={<ProjectsTable items={catalog.miniRepos.data} />}
            visualRender={
              <VisualMode items={catalog.miniRepos.data} loading={catalog.miniRepos.loading} />
            }
          />
        )}
        {catalog.activeTab === "projects" && (
          <CatalogTab
            key={"projects-tab"}
            itemizedMode={itemizedMode}
            dataLength={catalog.projects.data.length}
            totalLength={catalog.projects.total}
            getNextPage={catalog.projects.loadMore}
            loading={catalog.projects.loading}
            itemizedRender={<ProjectsTable items={catalog.projects.data} />}
            visualRender={
              <VisualMode items={catalog.projects.data} loading={catalog.projects.loading} />
            }
          />
        )}
        {catalog.activeTab === "authors" && (
          <CatalogTab
            key={"authors-tab"}
            itemizedMode={itemizedMode}
            dataLength={catalog.authors.data.length}
            totalLength={catalog.authors.total}
            getNextPage={catalog.authors.loadMore}
            loading={catalog.authors.loading}
            itemizedRender={<AuthorsTable items={catalog.authors.data} />}
            visualRender={
              <VisualMode items={catalog.authors.data} loading={catalog.authors.loading} />
            }
          />
        )}
      </div>
    </div>
  );
};

export default CatalogTabs;
