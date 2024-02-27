// @ts-nocheck
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

interface AdvancedSearchModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  searchString: string;
  setSearchString: (searchString: string) => void;
  resourceType: "books" | "assets" | "projects";
  setResourceType: (resourceType: "books" | "assets" | "projects") => void;
  submitSearch: () => void;
  assetFilters: AssetFilters;
  setAssetFilters: (filters: AssetFilters) => void;
  bookFilters: BookFilters;
  setBookFilters: (filters: BookFilters) => void;
  strictMode: boolean;
  setStrictMode: (strictMode: boolean) => void;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  show,
  onClose,
  searchString,
  setSearchString,
  resourceType,
  setResourceType,
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
    onClose();
  }

  function clear() {
    setSearchString("");
    setBookFilters({});
    setAssetFilters({});
    setStrictMode(false);
  }

  return (
    <Modal
      size="large"
      open={show}
      onClose={onClose}
      closeIcon={<Icon name="close" />}
      {...rest}
    >
      <Modal.Header>Advanced Search</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()}>
          <Form.Field className="!-mt-4">
            <label htmlFor="commons-advanced-search-input">Search Query</label>
            <Input
              icon="search"
              placeholder="Search query..."
              className="color-libreblue !mb-0"
              id="commons-advanced-search-input"
              iconPosition="left"
              onChange={(e) => {
                setSearchString(e.target.value);
              }}
              fluid
              value={searchString}
              aria-label="Search query"
            />
          </Form.Field>
          <div className="flex flex-row mt-2">
            <label className="font-bold">Resource Type:</label>
            <div className="flex flex-row">
              <input
                type="radio"
                name="resource-type"
                id="books"
                className="!ml-4"
                checked={resourceType === "books"}
                onChange={() => setResourceType("books")}
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
                checked={resourceType === "assets"}
                onChange={() => setResourceType("assets")}
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
                checked={resourceType === "projects"}
                onChange={() => setResourceType("projects")}
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
            {resourceType === "books" ? (
              <CatalogBookFilters
                selectedFilters={bookFilters}
                setSelectedFilters={(filters) => setBookFilters(filters)}
              />
            ) : resourceType === "assets" ? (
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
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={clear}>
          <Icon name="trash" />
          Clear
        </Button>
        <Button onClick={handleSubmit} color="blue">
          <Icon name="search" />
          Search
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AdvancedSearchModal;
