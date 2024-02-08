import { useState } from "react";
import {
  Button,
  Checkbox,
  Divider,
  Form,
  Icon,
  Input,
  Modal,
  ModalProps,
  Popup,
} from "semantic-ui-react";
import CatalogAssetFilters from "./CommonsCatalog/CatalogAssetFilters";
import { AssetFilters, BookFilters } from "../../types";
import CatalogBookFilters from "./CommonsCatalog/CatalogBookFilters";

interface AdvancedSearchDrawerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  searchString: string;
  setSearchString: (searchString: string) => void;
  submitSearch: () => void;
  assetFilters: AssetFilters;
  setAssetFilters: (filters: AssetFilters) => void;
  bookFilters: BookFilters;
  setBookFilters: (filters: BookFilters) => void;
  strictMode: boolean;
  setStrictMode: (strictMode: boolean) => void;
}

const AdvancedSearchDrawer: React.FC<AdvancedSearchDrawerProps> = ({
  activeIndex,
  setActiveIndex,
  searchString,
  setSearchString,
  submitSearch,
  assetFilters,
  setAssetFilters,
  bookFilters,
  setBookFilters,
  strictMode,
  setStrictMode,
  ...rest
}) => {
  function handleSubmit() {
    submitSearch();
  }

  function clear() {
    setSearchString("");
    setBookFilters({});
    setAssetFilters({});
    setStrictMode(false);
  }

  function handleChangeResourceType(idx: number) {
    setActiveIndex(idx);
    setBookFilters({});
    setAssetFilters({});
    setStrictMode(false);
  }

  return (
    <div className="flex flex-row justify-center" {...rest}>
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
          <div className="mb-8">
            <label htmlFor="" className="font-bold">
              Additional Filters
            </label>
            {activeIndex === 0 ? (
              <CatalogBookFilters
                selectedFilters={bookFilters}
                setSelectedFilters={(filters) => setBookFilters(filters)}
              />
            ) : activeIndex === 1 ? (
              <CatalogAssetFilters
                selectedFilters={assetFilters}
                setSelectedFilters={(filters) => setAssetFilters(filters)}
              />
            ) : (
              <div>
                <p className="italic text-slate-500">
                  No additional filters available for this resource type.
                </p>
              </div>
            )}
          </div>
          <Divider />
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center">
              <label className="font-bold">Strictly Match Criteria:</label>
              <Checkbox
                label=""
                className="!font-semibold ml-4"
                toggle
                checked={strictMode}
                onChange={() => setStrictMode(!strictMode)}
              />
              <Popup
                content="If checked, search results will only include resources that explicitly match all of the above criteria."
                trigger={
                  <Icon name="question circle outline" className="ml-2 !mb-1" />
                }
              />
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default AdvancedSearchDrawer;
