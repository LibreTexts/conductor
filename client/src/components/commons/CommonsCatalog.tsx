import "./Commons.css";
import { Grid, Segment, Header, Form, Dropdown, Icon } from "semantic-ui-react";
import { useEffect, useState, useRef, lazy, useMemo } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";
import api from "../../api";
import useDebounce from "../../hooks/useDebounce";
import { truncateString } from "../util/HelperFunctions";
import AdvancedSearchModal from "./AdvancedSearchModal";
import { AssetFilters, BookFilters } from "../../types";
import AdvancedSearchDrawer from "./AdvancedSearchDrawer";

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);
  const { debounce } = useDebounce();

  const catalogTabsRef = useRef<React.ElementRef<typeof CatalogTabs>>(null);

  const [searchString, setSearchString] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [didAutocompleteSearch, setDidAutocompleteSearch] =
    useState<boolean>(false); // Prevents autocomplete from showing up after user has already searched
  const [searchResourceType, setSearchResourceType] = useState<
    "books" | "assets" | "projects"
  >("books"); // 'books' or 'assets'
  const [bookFilters, setBookFilters] = useState<BookFilters>({});
  const [assetFilters, setAssetFilters] = useState<AssetFilters>({});
  const [strictMode, setStrictMode] = useState(false);

  /**
   * Update the page title based on
   * Organization information.
   */
  useEffect(() => {
    if (org.orgID !== "libretexts") {
      document.title = `${org.shortName} Commons | Catalog`;
    } else {
      document.title = "LibreCommons | Catalog";
    }
  }, [org]);

  useEffect(() => {
    if (searchString.length > 3) {
      getAutoCompleteDebounced(searchString);
    }
    if (searchString.length === 0 && didAutocompleteSearch) {
      setDidAutocompleteSearch(false);
    }
  }, [searchString]);

  const getAutoCompleteDebounced = debounce(
    (query: string) => getAutocompleteSuggestions(query),
    100
  );

  async function getAutocompleteSuggestions(query: string) {
    try {
      const res = await api.getAutoCompleteSuggestions(query);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.results || !Array.isArray(res.data.results)) {
        throw new Error("Invalid response from server");
      }

      setSuggestions(res.data.results);
    } catch (err) {
      console.log(err);
    }
  }

  const handleSelectSuggestion = (suggestion: string) => {
    setSearchString(suggestion);
    setSuggestions([]);
    setDidAutocompleteSearch(true);
    catalogTabsRef.current?.runSearch(suggestion);
  };

  const handleResetSearch = () => {
    setSearchString("");
    setSuggestions([]);
    setDidAutocompleteSearch(false);
    setBookFilters({});
    setAssetFilters({});
    catalogTabsRef.current?.resetSearch();
  };

  const handleSubmitSearch = () => {
    catalogTabsRef.current?.runSearch(searchString);
    // if (searchResourceType) {
    //   catalogTabsRef.current?.setActiveTab(searchResourceType);
    // }
    setDidAutocompleteSearch(true);
  };

  // const isRandomBrowsing = useMemo(() => {
  //   return (
  //     searchString === "" &&
  //     Object.keys(bookFilters).length === 0 &&
  //     Object.keys(assetFilters).length === 0
  //   );
  // }, [searchString, bookFilters, assetFilters]);

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            {((org.commonsHeader && org.commonsHeader !== "") ||
              (org.commonsMessage && org.commonsMessage !== "")) && (
              <Segment padded>
                {org.commonsHeader && org.commonsHeader !== "" && (
                  <Header
                    id="commons-intro-header"
                    as="h2"
                    className="text-center lg:text-left"
                  >
                    {org.commonsHeader}
                  </Header>
                )}
                <p
                  id="commons-intro-message"
                  className="text-center lg:text-left"
                >
                  {org.commonsMessage}
                </p>
              </Segment>
            )}
            <Segment>
              <div className="mt-8 mb-6 mx-56">
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <Form.Input
                      icon="search"
                      placeholder="Search..."
                      className="color-libreblue !mb-0"
                      id="commons-search-input"
                      iconPosition="left"
                      onChange={(e) => {
                        setSearchString(e.target.value);
                      }}
                      fluid
                      value={searchString}
                      aria-label="Search query"
                      action={{
                        content: "Search Catalog",
                        color: "blue",
                        onClick: handleSubmitSearch,
                      }}
                      onFocus={() => setDidAutocompleteSearch(false)}
                      onBlur={() => setDidAutocompleteSearch(true)}
                    />
                    {!didAutocompleteSearch && suggestions.length > 0 && (
                      <div className="py-2 border rounded-md shadow-md">
                        {suggestions.map((suggestion) => {
                          return (
                            <p
                              className="px-2 hover:bg-slate-50 rounded-md cursor-pointer font-semibold"
                              onClick={() => handleSelectSuggestion(suggestion)}
                              key={crypto.randomUUID()}
                            >
                              {truncateString(suggestion, 100)}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Form>
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
              </div>
              {showAdvanced && (
                <div className="mb-8">
                  <AdvancedSearchDrawer
                    searchString={searchString}
                    setSearchString={setSearchString}
                    resourceType={searchResourceType}
                    setResourceType={setSearchResourceType}
                    submitSearch={handleSubmitSearch}
                    bookFilters={bookFilters}
                    setBookFilters={setBookFilters}
                    assetFilters={assetFilters}
                    setAssetFilters={setAssetFilters}
                    strictMode={strictMode}
                    setStrictMode={setStrictMode}
                  />
                </div>
              )}
              {(searchString !== "" || Object.keys(bookFilters).length !== 0 || Object.keys(assetFilters).length !== 0) && (
                <p
                  className="italic font-semibold cursor-pointer underline text-center mt-2"
                  onClick={handleResetSearch}
                >
                  Reset Search
                </p>
              )}
              <CatalogTabs
                ref={catalogTabsRef}
                assetFilters={assetFilters}
                setAssetFilters={setAssetFilters}
                bookFilters={bookFilters}
                setBookFilters={setBookFilters}
                strictMode={strictMode}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
