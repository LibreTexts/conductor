import React, { useState } from "react";
import { IconButton } from "@libretexts/davis-react";
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
        <div className="flex flex-row items-center mb-1 gap-1">
          <IconButton
            variant="outline"
            size="sm"
            tooltip={jumpToBottomClicked ? "Refresh to continue browsing" : "Jump to bottom"}
            aria-label={jumpToBottomClicked ? "Refresh to continue browsing" : "Jump to bottom"}
            onClick={() => jumpToBottomClicked ? window.location.reload() : jumpToBottom()}
            icon={
              jumpToBottomClicked ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                </svg>
              )
            }
          />
          <IconButton
            variant="outline"
            size="sm"
            tooltip={itemizedMode ? "Switch to visual mode" : "Switch to itemized mode"}
            aria-label={itemizedMode ? "Switch to visual mode" : "Switch to itemized mode"}
            onClick={() => setItemizedMode(!itemizedMode)}
            icon={
              itemizedMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              )
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
