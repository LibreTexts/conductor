import { useState } from "react";
import { Divider, Form, Icon } from "semantic-ui-react";
import CatalogAssetFilters from "./CommonsCatalog/CatalogAssetFilters";
import {
  AssetFilters,
  AssetFiltersAction,
  BookFilters,
  BookFiltersAction,
} from "../../types";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";

interface AdvancedSearchDrawerProps {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  assetFilters: AssetFilters;
  assetFiltersDispatch: React.Dispatch<AssetFiltersAction>;
  bookFilters: BookFilters;
  bookFiltersDispatch: React.Dispatch<BookFiltersAction>;
}

const AdvancedSearchDrawer: React.FC<AdvancedSearchDrawerProps> = ({
  activeIndex,
  setActiveIndex,
  assetFilters,
  assetFiltersDispatch,
  bookFilters,
  bookFiltersDispatch,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleChangeResourceType(idx: number) {
    setActiveIndex(idx);
    bookFiltersDispatch({ type: "reset" });
    assetFiltersDispatch({ type: "reset" });
  }

  return (
    <div className="flex flex-col">
      <div
        className="flex flex-row items-center justify-center text-primary font-semibold cursor-pointer text-center mt-4"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <Icon
          name={showAdvanced ? "caret down" : "caret right"}
          className="mr-1 !mb-2"
        />
        <p className="">Advanced Search</p>
        <Icon
          name={showAdvanced ? "caret down" : "caret left"}
          className="ml-1 !mb-2"
        />
      </div>
      <div className="flex flex-row justify-center mt-2">
        {showAdvanced && (
          <div className="border-2 rounded-md shadow-md p-4 w-2/3">
            <Form onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-row mt-2">
                <label className="font-bold">Resource Type:</label>
                <div className="flex flex-row">
                  <input
                    type="radio"
                    name="resource-type"
                    id="books"
                    className="!ml-4"
                    checked={activeIndex === 0}
                    onChange={() => handleChangeResourceType(0)}
                  />
                  <label htmlFor="books" className="ml-1">
                    Books
                  </label>
                </div>
                <div className="flex flex-row">
                  <input
                    type="radio"
                    name="resource-type"
                    id="assets"
                    className="!ml-4"
                    checked={activeIndex === 1}
                    onChange={() => handleChangeResourceType(1)}
                  />
                  <label htmlFor="assets" className="ml-1">
                    Assets
                  </label>
                </div>
                <div className="flex flex-row">
                  <input
                    type="radio"
                    name="resource-type"
                    id="projects"
                    className="!ml-4"
                    checked={activeIndex === 2}
                    onChange={() => handleChangeResourceType(2)}
                  />
                  <label htmlFor="projects" className="ml-1">
                    Projects
                  </label>
                </div>
              </div>
              <Divider />
              <div className="mb-4">
                <label htmlFor="" className="font-bold">
                  Additional Filters
                </label>
                {activeIndex === 0 ? (
                  <CatalogBookFilters
                    filters={bookFilters}
                    onFilterChange={(type, value) =>
                      bookFiltersDispatch({ type, payload: value })
                    }
                  />
                ) : activeIndex === 1 ? (
                  <CatalogAssetFilters
                    filters={assetFilters}
                    onFilterChange={(type, value) =>
                      assetFiltersDispatch({ type, payload: value })
                    }
                  />
                ) : (
                  <div>
                    <p className="italic text-slate-500">
                      No additional filters available for this resource type.
                    </p>
                  </div>
                )}
              </div>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSearchDrawer;
