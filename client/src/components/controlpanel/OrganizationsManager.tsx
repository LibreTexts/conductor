import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Breadcrumb,
  Button,
  Dropdown,
  Grid,
  Header,
  Icon,
  Input,
  Pagination,
  Segment,
  Table,
} from "semantic-ui-react";
import { itemsPerPageOptions } from "../util/PaginationOptions.js";
import useGlobalError from "../error/ErrorHooks.js";
import "./ControlPanel.css";
import OrgDetailsModal from "./OrgsManager/OrgDetailsModal.js";
import { Organization } from "../../types/Organization.js";

const OrganizationsManager = () => {
  // Global State
  const { handleGlobalError } = useGlobalError();

  // Data
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [displayOrgs, setDisplayOrgs] = useState<Organization[]>([]);
  const [pageOrgs, setPageOrgs] = useState<Organization[]>([]);

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [searchString, setSearchString] = useState<string>("");
  const [sortChoice, setSortChoice] = useState<string>("name");
  const [showOrgDetailsModal, setShowOrgDetailsModal] =
    useState<boolean>(false);
  const [editOrgID, setEditOrgID] = useState<string>("");

  const sortOptions = [{ key: "name", text: "Sort by Name", value: "name" }];

  /**
   * Retrieve all organizations via GET request
   * to the server.
   */
  const getOrganizations = useCallback(async () => {
    try {
      const orgsRes = await axios.get("/orgs");
      if (!orgsRes.data.err) {
        if (orgsRes.data.orgs && Array.isArray(orgsRes.data.orgs)) {
          setOrgs(orgsRes.data.orgs);
        }
      } else {
        handleGlobalError(orgsRes.data.errMsg);
      }
      setLoadedData(true);
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    }
  }, [setOrgs, setLoadedData, handleGlobalError]);

  /**
   * Set page title and retrieve organizations
   * on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Organizations Manager";
    getOrganizations();
  }, [getOrganizations]);

  /**
   * Track changes to the number of collections loaded
   * and the selected itemsPerPage and update the
   * set of collections to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(displayOrgs.length / itemsPerPage));
    setPageOrgs(
      displayOrgs.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, displayOrgs, activePage]);

  /**
   * Filter and sort organizations according to
   * user's choices, then update the list.
   */
  useEffect(() => {
    filterAndSortOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs, searchString, sortChoice]);

  /**
   * Filter and sort collections according
   * to current filters and sort
   * choice.
   */
  function filterAndSortOrgs() {
    setLoadedData(false);
    let filtered = orgs.filter((org) => {
      var include = true;
      var descripString =
        String(org.name).toLowerCase() +
        String(org.shortName).toLowerCase() +
        String(org.abbreviation).toLowerCase();
      if (
        searchString !== "" &&
        String(descripString).indexOf(String(searchString).toLowerCase()) === -1
      ) {
        include = false;
      }
      if (include) {
        return org;
      } else {
        return false;
      }
    });
    if (sortChoice === "name") {
      const sorted = [...filtered].sort((a, b) => {
        var normalA = String(a.name)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        var normalB = String(b.name)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        if (normalA < normalB) {
          return -1;
        }
        if (normalA > normalB) {
          return 1;
        }
        return 0;
      });
      setDisplayOrgs(sorted);
    }
    setLoadedData(true);
  }

  function handleEditOrg(orgID: string) {
    setEditOrgID(orgID);
    setShowOrgDetailsModal(true);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Organizations Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Organizations Manager
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <div className="flex-row-div">
                <div className="left-flex">
                  <Dropdown
                    placeholder="Sort by..."
                    floating
                    selection
                    button
                    options={sortOptions}
                    onChange={(_e, { value }) => {
                      setSortChoice(value?.toString() || "name");
                    }}
                    value={sortChoice}
                  />
                </div>
                <div className="right-flex">
                  <Input
                    icon="search"
                    iconPosition="left"
                    placeholder="Search results..."
                    onChange={(e) => {
                      setSearchString(e.target.value);
                    }}
                    value={searchString}
                  />
                </div>
              </div>
            </Segment>
            <Segment>
              <div className="flex-row-div">
                <div className="left-flex">
                  <span>Displaying </span>
                  <Dropdown
                    className="commons-content-pagemenu-dropdown"
                    selection
                    options={itemsPerPageOptions}
                    onChange={(_e, { value }) => {
                      setItemsPerPage((value as number) ?? 10);
                    }}
                    value={itemsPerPage}
                  />
                  <span>
                    {" "}
                    items per page of{" "}
                    <strong>{Number(orgs.length).toLocaleString()}</strong>{" "}
                    results.
                  </span>
                </div>
                <div className="right-flex">
                  <Pagination
                    activePage={activePage}
                    totalPages={totalPages}
                    firstItem={null}
                    lastItem={null}
                    onPageChange={(_e, data) => {
                      setActivePage((data.activePage as number) ?? 1);
                    }}
                  />
                </div>
              </div>
            </Segment>
            <Segment loading={!loadedData}>
              <Table striped fixed>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell colSpan={3}>
                      {sortChoice === "name" ? (
                        <span>
                          <em>Organization Name</em>
                        </span>
                      ) : (
                        <span>Organization Name</span>
                      )}
                    </Table.HeaderCell>
                    <Table.HeaderCell>
                      <span>Actions</span>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {pageOrgs.length > 0 &&
                    pageOrgs.map((item, index) => {
                      return (
                        <Table.Row key={index}>
                          <Table.Cell colSpan={3}>
                            <p>
                              <strong>{item.name}</strong>
                            </p>
                          </Table.Cell>
                          <Table.Cell textAlign="center">
                            <Button
                              color="blue"
                              fluid
                              onClick={() => handleEditOrg(item.orgID)}
                            >
                              <Icon name="edit" />
                              Edit Organization Details
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {pageOrgs.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={4}>
                        <p className="text-center">
                          <em>No results found.</em>
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Segment>
          </Segment.Group>

          <OrgDetailsModal
            show={showOrgDetailsModal}
            onClose={() => setShowOrgDetailsModal(false)}
            orgID={editOrgID}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default OrganizationsManager;
