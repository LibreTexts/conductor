import { useState } from "react";
import { TabProps, Label, Icon, Checkbox } from "semantic-ui-react";
import {
  AssetFilters,
  Book,
  BookFilters,
  Project,
  ProjectFileWCustomData,
} from "../../../types";
import CatalogTab from "./CatalogTab";
import BooksTable from "./BooksTable";
import VisualMode from "./VisualMode";
import AssetsTable from "./AssetsTable";
import ProjectsTable from "./ProjectsTable";
import TabLabel from "./CatalogTabLabel";
import { getAssetFilterText, getBookFilterText } from "../../../utils/misc";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";

interface CatalogTabsProps extends TabProps {
  activeIndex: number;
  assetFilters: AssetFilters;
  bookFilters: BookFilters;
  onActiveTabChange: (index: number) => void;
  books: Book[];
  booksCount: number;
  booksLoading: boolean;
  assets: ProjectFileWCustomData<
    "projectTitle" | "projectThumbnail",
    "projectID"
  >[];
  assetsCount: number;
  assetsLoading: boolean;
  projects: Project[];
  projectsCount: number;
  projectsLoading: boolean;
  onLoadMoreBooks: () => void;
  onLoadMoreAssets: () => void;
  onLoadMoreProjects: () => void;
  onRemoveBookFilter: (key: keyof BookFilters) => void;
  onRemoveAssetFilter: (key: keyof AssetFilters) => void;
}

const CatalogTabs: React.FC<CatalogTabsProps> = ({
  activeIndex,
  bookFilters,
  assetFilters,
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
  onRemoveBookFilter,
  onRemoveAssetFilter,
  ...rest
}) => {
  const [itemizedMode, setItemizedMode] = useState(false);

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
          <div className="flex flex-row">
            {Object.entries(bookFilters).map(([key, value]) => {
              return (
                <Label circular size="medium" key={crypto.randomUUID()}>
                  <div
                    className="flex flex-row items-center cursor-pointer"
                    onClick={() => onRemoveBookFilter(key as keyof BookFilters)}
                  >
                    <p className="">
                      {getBookFilterText(key)}: {capitalizeFirstLetter(value)}
                    </p>
                    <Icon name="x" className="!ml-1" />
                  </div>
                </Label>
              );
            })}
          </div>
        )}
        {activeIndex === 1 && (
          <div className="flex flex-row">
            {Object.entries(assetFilters).map(([key, value]) => {
              return (
                <Label circular size="medium" key={crypto.randomUUID()}>
                  <div
                    className="flex flex-row items-center cursor-pointer"
                    onClick={() =>
                      onRemoveAssetFilter(key as keyof AssetFilters)
                    }
                  >
                    <p className="">
                      {getAssetFilterText(key)}: {value}
                    </p>
                    <Icon name="x" className="!ml-1" />
                  </div>
                </Label>
              );
            })}
          </div>
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
