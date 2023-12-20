import "./Commons.css";
import { Grid, Segment, Header, Form } from "semantic-ui-react";
import { useEffect, useState, useRef } from "react";
import { useTypedSelector } from "../../state/hooks";
import CatalogTabs from "./CommonsCatalog/CatalogTabs";

const CommonsCatalog = () => {
  // Global State and Location/History
  const org = useTypedSelector((state) => state.org);

  const catalogTabsRef = useRef<React.ElementRef<typeof CatalogTabs>>(null);

  const [searchString, setSearchString] = useState<string>("");
  const [searchStringToSend, setSearchStringToSend] = useState<string>("");

  useEffect(() => {
    catalogTabsRef.current?.loadInitialCatalogs();
  }, []);

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

  const handleResetSearch = () => {
    setSearchString("");
    setSearchStringToSend("");
    catalogTabsRef.current?.resetSearch();
  };

  const handleSubmitSearch = () => {
    setSearchStringToSend(searchString);
    catalogTabsRef.current?.runSearch();
  };

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
                    handleSubmitSearch();
                  }}
                >
                  <Form.Input
                    icon="search"
                    placeholder="Search..."
                    className="color-libreblue"
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
                  />
                </Form>
                <p
                  className="underline cursor-pointer text-center mt-4"
                  onClick={handleResetSearch}
                >
                  Reset Search
                </p>
              </div>
              <CatalogTabs
                ref={catalogTabsRef}
                searchString={searchStringToSend}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCatalog;
