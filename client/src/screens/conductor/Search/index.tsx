import "./Search.css";
import "../../../components/projects/Projects.css";

import {
  Grid,
  Header,
  Segment,
  Message,
  Loader,
  Image,
  List,
  Form,
  Select,
  Divider,
  Label,
  Icon,
  Button,
  Table,
  Dropdown,
  Popup,
  Placeholder,
} from "semantic-ui-react";
import { useState, useEffect, useCallback, lazy } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import AlertModal from "../../../components/alerts/AlertModal.jsx";
import ConductorPagination from "../../../components/util/ConductorPagination";
import {
  getClassificationText,
  getVisibilityText,
} from "../../../components/util/ProjectHelpers";
import {
  getLibGlyphURL,
  getLibGlyphAltText,
} from "../../../components/util/LibraryOptions.js";
import { truncateString } from "../../../components/util/HelperFunctions.js";
import { catalogItemsPerPageOptions } from "../../../components/util/PaginationOptions.js";
import useGlobalError from "../../../components/error/ErrorHooks";
import { Book, Homework, Project, ProjectFile, User } from "../../../types";
import { format, parseISO } from "date-fns";
import RenderAssetTags from "../../../components/FilesManager/RenderAssetTags";
import api from "../../../api";
import {
  downloadFile,
  fileSizePresentable,
  getPrettyCreatedDate,
  getPrettyUploader,
} from "../../../utils/assetHelpers";
import FileIcon from "../../../components/FileIcon";
import { ProjectFileWProjectID } from "../../../types/Project";
const PreviewHomework = lazy(
  () => import("../../../components/Search/PreviewHomework")
);

const Search = () => {
  const projLocationParam = "proj_location";
  const projLocationDefault = "global";
  const projStatusParam = "proj_status";
  const projStatusDefault = "any";
  const projVisibilityParam = "proj_visibility";
  const projVisibilityDefault = "any";
  const projSortParam = "proj_sort";
  const projSortDefault = "title";
  const bookSortParam = "book_sort";
  const bookSortDefault = "title";
  const hwSortParam = "hw_sort";
  const hwSortDefault = "name";
  const userSortParam = "user_sort";
  const userSortDefault = "first";

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  // UI
  const [loadedData, setLoadedData] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [projLocationFilter, setProjLocationFilter] =
    useState(projLocationDefault);
  const [projStatusFilter, setProjStatusFilter] = useState(projStatusDefault);
  const [projVisibilityFilter, setProjVisibilityFilter] = useState(
    projVisibilityDefault
  );
  const [numResults, setNumResults] = useState<number>(0);

  const [projResults, setProjResults] = useState<Project[]>([]);
  const [projSort, setProjSort] = useState(projSortDefault);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [projActivePage, setProjActivePage] = useState<number>(1);
  const [projTotalPages, setProjTotalPages] = useState<number>(1);
  const [projectsPerPage, setProjectsPerPage] = useState<number>(12);

  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [bookSort, setBookSort] = useState(bookSortDefault);
  const [displayBooks, setDisplayBooks] = useState<Book[]>([]);
  const [bookActivePage, setBookActivePage] = useState<number>(1);
  const [bookTotalPages, setBookTotalPages] = useState<number>(1);
  const [booksPerPage, setBooksPerPage] = useState<number>(12);

  const [assetResults, setAssetResults] = useState<ProjectFileWProjectID[]>([]);
  const [displayAssets, setDisplayAssets] = useState<ProjectFileWProjectID[]>(
    []
  );
  const [assetActivePage, setAssetActivePage] = useState<number>(1);
  const [assetTotalPages, setAssetTotalPages] = useState<number>(1);
  const [assetsPerPage, setAssetsPerPage] = useState<number>(12);

  const [hwResults, setHwResults] = useState<Homework[]>([]);
  const [hwSort, setHwSort] = useState(hwSortDefault);
  const [displayHomework, setDisplayHomework] = useState<Homework[]>([]);
  const [hwActivePage, setHwActivePage] = useState<number>(1);
  const [hwTotalPages, setHwTotalPages] = useState<number>(1);
  const [hwPerPage, setHwPerPage] = useState<number>(12);
  const [showHwModal, setShowHwModal] = useState<boolean>(false);
  const [selectedHW, setSelectedHW] = useState<Homework | null>(null);

  const [userResults, setUserResults] = useState<User[]>([]);
  const [userSort, setUserSort] = useState(userSortDefault);
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [userActivePage, setUserActivePage] = useState<number>(1);
  const [userTotalPages, setUserTotalPages] = useState<number>(1);
  const [usersPerPage, setUsersPerPage] = useState<number>(12);

  // Create Alert
  const [showAlertModal, setShowAlertModal] = useState(false);

  const projLocationOptions = [
    { key: "global", text: "LibreGrid (all instances)", value: "global" },
    { key: "local", text: "This Campus", value: "local" },
  ];
  const projStatusOptions = [
    { key: "any", text: "Any Status", value: "any" },
    {
      key: "available",
      text: "Available (awaiting development)",
      value: "available",
    },
    { key: "open", text: "Open (under active development)", value: "open" },
    {
      key: "completed",
      text: "Completed (under curation and review)",
      value: "completed",
    },
  ];
  const projVisibilityOptions = [
    { key: "any", text: "Any Visibility", value: "any" },
    { key: "public", text: "Public Projects", value: "public" },
    {
      key: "private",
      text: "Private Projects (visible to me)",
      value: "private",
    },
  ];
  const projSortOptions = [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "progress", text: "Sort by Current Progress", value: "progress" },
    {
      key: "classification",
      text: "Sort by Classification",
      value: "classification",
    },
    { key: "visibility", text: "Sort by Visibility", value: "visibility" },
    { key: "lead", text: "Sort by Project Lead", value: "lead" },
    { key: "updated", text: "Sort by Last Updated", value: "updated" },
  ];
  const bookSortOptions = [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
    { key: "library", text: "Sort by Library", value: "library" },
    { key: "subject", text: "Sort by Subject", value: "subject" },
    { key: "affiliation", text: "Sort by Affiliation", value: "affiliation" },
  ];
  const hwSortOptions = [
    { key: "name", text: "Sort by Name", value: "name" },
    { key: "description", text: "Sort by Description", value: "description" },
  ];
  const userSortOptions = [
    { key: "first", text: "Sort by First Name", value: "first" },
    { key: "last", text: "Sort by Last Name", value: "last" },
  ];

  /**
   * Initialization and plugin registration.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Search Results";
  }, []);

  /**
   * Sends a request to the server for search results based on the provided query, filters,
   * and sort options.
   * @param {string} query - The search terms/query.
   * @param {string} projLoc - The active Project Location filter.
   * @param {string} projStatus - The active Project Status filter.
   * @param {string} projVis - The active Project Visibility filter.
   * @param {string} projSortChoice - The active Project sort option.
   * @param {string} bookSortChoice - The active Book sort option.
   * @param {string} homeworkSortChoice - The active Homework sort option.
   * @param {string} userSortChoice - The active User sort option.
   */
  const performSearch = useCallback(
    async (
      query: string,
      projLoc: string,
      projStatus: string,
      projVis: string,
      projSortChoice: string,
      bookSortChoice: string,
      homeworkSortChoice: string,
      userSortChoice: string
    ) => {
      try {
        setLoadedData(false);
        const res = await api.conductorSearch({
          searchQuery: query,
          projLocation: projLoc,
          projStatus: projStatus,
          //projVisibility: projVis,
          projSort: projSortChoice,
          bookSort: bookSortChoice,
          hwSort: homeworkSortChoice,
          userSort: userSortChoice,
        });
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (typeof res.data.numResults === "number") {
          setNumResults(res.data.numResults);
        }
        if (res.data.results) {
          if (Array.isArray(res.data.results.projects))
            setProjResults(res.data.results.projects);
          if (Array.isArray(res.data.results.books))
            setBookResults(res.data.results.books);
          if (Array.isArray(res.data.results.files))
            setAssetResults(res.data.results.files);
          if (Array.isArray(res.data.results.homework))
            setHwResults(res.data.results.homework);
          if (Array.isArray(res.data.results.users))
            setUserResults(res.data.results.users);
        }
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadedData(true);
      }
    },
    [
      setLoadedData,
      setNumResults,
      setProjResults,
      setBookResults,
      setHwResults,
      setUserResults,
      handleGlobalError,
    ]
  );

  /**
   * Subscribe to changes in the URL search query, process parameters,
   * and trigger the search function.
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const query = urlParams.get("query");
    const projLocation =
      urlParams.get(projLocationParam) || projLocationDefault;
    const projStatus = urlParams.get(projStatusParam) || projStatusDefault;
    const projVisibility =
      urlParams.get(projVisibilityParam) || projVisibilityDefault;
    const projSortChoice = urlParams.get(projSortParam) || projSortDefault;
    const bookSortChoice = urlParams.get(bookSortParam) || bookSortDefault;
    const hwSortChoice = urlParams.get(hwSortParam) || hwSortDefault;
    const userSortChoice = urlParams.get(userSortParam) || userSortDefault;
    setProjLocationFilter(projLocation);
    setProjStatusFilter(projStatus);
    setProjVisibilityFilter(projVisibility);
    setProjSort(projSortChoice);
    setBookSort(bookSortChoice);
    setHwSort(hwSortChoice);
    setUserSort(userSortChoice);
    if (typeof query === "string" && query.length > 0) {
      document.title = `LibreTexts Conductor | Search | "${query}" | Results`;
      setSearchQuery(query);
      performSearch(
        query,
        projLocation,
        projStatus,
        projVisibility,
        projSortChoice,
        bookSortChoice,
        hwSortChoice,
        userSortChoice
      );
    } else {
      handleGlobalError("Oops, please provide a valid search query.");
    }
  }, [
    location.search,
    performSearch,
    setSearchQuery,
    setProjLocationFilter,
    setProjStatusFilter,
    setProjVisibilityFilter,
    setProjSort,
    setBookSort,
    setHwSort,
    setUserSort,
    handleGlobalError,
  ]);

  /**
   * Update the URL search query with a new value after a filter or sort option change.
   * @param {string} name - The internal filter or sort option name.
   * @param {string} newValue - The new value of the search parameter to set.
   */
  const handleFilterSortChange = (name: string, newValue: string) => {
    let urlParams = new URLSearchParams(location.search);
    switch (name) {
      case "location":
        urlParams.set(projLocationParam, newValue);
        break;
      case "status":
        urlParams.set(projStatusParam, newValue);
        break;
      case "visibility":
        urlParams.set(projVisibilityParam, newValue);
        break;
      case "projSort":
        urlParams.set(projSortParam, newValue);
        break;
      case "bookSort":
        urlParams.set(bookSortParam, newValue);
        break;
      case "hwSort":
        urlParams.set(hwSortParam, newValue);
        break;
      case "userSort":
        urlParams.set(userSortParam, newValue);
        break;
      default:
        break;
    }
    history.push({ search: urlParams.toString() });
  };

  /**
   * Subscribe to changes in the Project Results pagination options and update UI/state accordingly.
   */
  useEffect(() => {
    const newPageCount = Math.ceil(projResults.length / projectsPerPage);
    setProjTotalPages(newPageCount);
    setDisplayProjects(
      projResults.slice(
        (projActivePage - 1) * projectsPerPage,
        projActivePage * projectsPerPage
      )
    );
    if (projActivePage > newPageCount) setProjActivePage(1);
  }, [
    projResults,
    projectsPerPage,
    projActivePage,
    setProjTotalPages,
    setDisplayProjects,
    setProjActivePage,
  ]);

  /**
   * Subscribe to changes in the Book Results pagination options and update UI/state accordingly.
   */
  useEffect(() => {
    const newPageCount = Math.ceil(bookResults.length / booksPerPage);
    setBookTotalPages(newPageCount);
    setDisplayBooks(
      bookResults.slice(
        (bookActivePage - 1) * booksPerPage,
        bookActivePage * booksPerPage
      )
    );
    if (bookActivePage > newPageCount) setBookActivePage(1);
  }, [
    bookResults,
    booksPerPage,
    bookActivePage,
    setBookTotalPages,
    setDisplayBooks,
    setBookActivePage,
  ]);

  /**
   * Subscribe to changes in the Asset Results pagination options and update UI/state accordingly.
   */
  useEffect(() => {
    const newPageCount = Math.ceil(assetResults.length / assetsPerPage);
    setAssetTotalPages(newPageCount);
    setDisplayAssets(
      assetResults.slice(
        (assetActivePage - 1) * assetsPerPage,
        assetActivePage * assetsPerPage
      )
    );
    if (assetActivePage > newPageCount) setAssetActivePage(1);
  }, [
    assetResults,
    assetsPerPage,
    assetActivePage,
    setAssetTotalPages,
    setDisplayAssets,
    setAssetActivePage,
  ]);

  /**
   * Subscribe to changes in the Homework Results pagination options and update UI/state accordingly.
   */
  useEffect(() => {
    const newPageCount = Math.ceil(hwResults.length / hwPerPage);
    setHwTotalPages(newPageCount);
    setDisplayHomework(
      hwResults.slice((hwActivePage - 1) * hwPerPage, hwActivePage * hwPerPage)
    );
    if (hwActivePage > newPageCount) setHwActivePage(1);
  }, [
    hwResults,
    hwPerPage,
    hwActivePage,
    setHwTotalPages,
    setDisplayHomework,
    setHwActivePage,
  ]);

  /**
   * Subscribe to changes in the User Results pagination options and update UI/state accordingly.
   */
  useEffect(() => {
    const newPageCount = Math.ceil(userResults.length / usersPerPage);
    setUserTotalPages(newPageCount);
    setDisplayUsers(
      userResults.slice(
        (userActivePage - 1) * usersPerPage,
        userActivePage * usersPerPage
      )
    );
    if (userActivePage > newPageCount) setUserActivePage(1);
  }, [
    userResults,
    usersPerPage,
    userActivePage,
    setUserTotalPages,
    setDisplayUsers,
    setUserActivePage,
  ]);

  /**
   * Enter a Homework result into state and open the Homework View modal.
   * @param {object} hwItem - The Homework result to enter into state.
   */
  const openHwModal = (hwItem: Homework) => {
    if (typeof hwItem === "object") {
      setSelectedHW(hwItem);
      setShowHwModal(true);
    }
  };

  /**
   * Close the Homework View modal and reset associated state.
   */
  const closeHwModal = () => {
    setSelectedHW(null);
    setShowHwModal(false);
  };

  /**
   * Open the Alert Modal in 'create' mode with the current search query.
   */
  const openCreateAlertModal = () => {
    setShowAlertModal(true);
  };

  /**
   * Close the Alert Modal.
   */
  const closeCreateAlertModal = () => {
    setShowAlertModal(false);
  };

  async function handleDownloadFile(file: ProjectFileWProjectID) {
    const success = await downloadFile(file.projectID, file.fileID);
    if (!success) {
      handleGlobalError(
        "Oops, something went wrong while downloading this file."
      );
    }
  }

  return (
    <Grid className="component-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Search</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment>
            <Form>
              <Form.Group widths="equal">
                <Form.Select
                  control={Select}
                  label="Project Location"
                  options={projLocationOptions}
                  placeholder="Project Location..."
                  value={projLocationFilter}
                  onChange={(e, { value }) =>
                    handleFilterSortChange(
                      "location",
                      (value as string) ?? "global"
                    )
                  }
                />
                <Form.Select
                  label="Project Status"
                  options={projStatusOptions}
                  placeholder="Project Status..."
                  value={projStatusFilter}
                  onChange={(e, { value }) =>
                    handleFilterSortChange("status", (value as string) ?? "any")
                  }
                />
                <Form.Select
                  label="Project Visibility"
                  options={projVisibilityOptions}
                  placeholder="Project Visibility"
                  value={projVisibilityFilter}
                  onChange={(e, { value }) =>
                    handleFilterSortChange(
                      "visibility",
                      (value as string) ?? "any"
                    )
                  }
                />
              </Form.Group>
            </Form>
            <Divider />
            <div className="flex-row-div">
              <div className="left-flex">
                <Label color="blue">
                  <Icon name="search" />
                  Query
                  <Label.Detail>{searchQuery}</Label.Detail>
                </Label>
                <Label color="grey">
                  <Icon name="hashtag" />
                  Results
                  <Label.Detail>{numResults.toLocaleString()}</Label.Detail>
                </Label>
              </div>
              <div className="right-flex">
                <Button.Group>
                  <Button
                    color="blue"
                    as={Link}
                    to="/alerts"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="alarm" />
                    My Alerts
                  </Button>
                  <Button color="green" onClick={openCreateAlertModal}>
                    <Icon name="add" />
                    Create Alert
                  </Button>
                </Button.Group>
              </div>
            </div>
            {loadedData ? (
              <>
                {numResults > 0 && (
                  <>
                    <Header as="h3" dividing>
                      Projects
                    </Header>
                    <Segment basic>
                      <Segment attached="top">
                        <div className="flex-row-div">
                          <div className="left-flex">
                            <span>Displaying </span>
                            <Dropdown
                              className="search-itemsperpage-dropdown"
                              selection
                              options={catalogItemsPerPageOptions}
                              onChange={(_e, { value }) =>
                                setProjectsPerPage((value as number) ?? 12)
                              }
                              value={projectsPerPage}
                              aria-label="Number of results to display per page"
                            />
                            <span>
                              {" "}
                              items per page of{" "}
                              <strong>
                                {Number(projResults.length).toLocaleString()}
                              </strong>{" "}
                              results.
                            </span>
                          </div>
                          <div className="center-flex">
                            <ConductorPagination
                              activePage={projActivePage}
                              totalPages={projTotalPages}
                              firstItem={null}
                              lastItem={null}
                              onPageChange={(e, data) =>
                                setProjActivePage(
                                  (data.activePage as number) ?? 1
                                )
                              }
                            />
                          </div>
                          <div className="right-flex">
                            <Dropdown
                              placeholder="Sort by..."
                              floating
                              selection
                              button
                              options={projSortOptions}
                              onChange={(_e, { value }) =>
                                handleFilterSortChange(
                                  "projSort",
                                  (value as string) ?? "title"
                                )
                              }
                              value={projSort}
                              aria-label="Sort Project Results by"
                            />
                          </div>
                        </div>
                      </Segment>
                      <Table celled attached title="Project Search Results">
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell width={6}>
                              <Header sub>Title</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={4}>
                              <Header sub>Author</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={2}>
                              <Header sub>Progress (C/PR/A11Y)</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={2}>
                              <Header sub>Classification</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={2}>
                              <Header sub>Visibility</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={2}>
                              <Header sub>Lead</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={2}>
                              <Header sub>Last Updated</Header>
                            </Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {displayProjects.length > 0 &&
                            displayProjects.map((item, index) => {
                              let projectLead = "Unknown";
                              if (item.leads && Array.isArray(item.leads)) {
                                item.leads.forEach((lead, leadIdx) => {
                                  if (lead.firstName && lead.lastName) {
                                    if (leadIdx > 0)
                                      projectLead += `, ${lead.firstName} ${lead.lastName}`;
                                    else if (leadIdx === 0)
                                      projectLead = `${lead.firstName} ${lead.lastName}`;
                                  }
                                });
                              }
                              if (!item.hasOwnProperty("peerProgress"))
                                item.peerProgress = 0;
                              if (!item.hasOwnProperty("a11yProgress"))
                                item.a11yProgress = 0;
                              return (
                                <Table.Row key={index}>
                                  <Table.Cell>
                                    <p>
                                      <strong>
                                        <Link
                                          to={`/projects/${item.projectID}`}
                                        >
                                          {truncateString(item.title, 100)}
                                        </Link>
                                      </strong>
                                    </p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>{truncateString(item.author, 50)}</p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <div className="flex-row-div projectportal-progress-row">
                                      <div className="projectportal-progress-col">
                                        <span>{item.currentProgress}%</span>
                                      </div>
                                      <div className="projectportal-progresssep-col">
                                        <span className="projectportal-progresssep">
                                          /
                                        </span>
                                      </div>
                                      <div className="projectportal-progress-col">
                                        <span>{item.peerProgress}%</span>
                                      </div>
                                      <div className="projectportal-progresssep-col">
                                        <span className="projectportal-progresssep">
                                          /
                                        </span>
                                      </div>
                                      <div className="projectportal-progress-col">
                                        <span>{item.a11yProgress}%</span>
                                      </div>
                                    </div>
                                  </Table.Cell>
                                  <Table.Cell>
                                    {item.classification &&
                                    typeof item.classification === "string" ? (
                                      <p>
                                        {getClassificationText(
                                          item.classification
                                        )}
                                      </p>
                                    ) : (
                                      <p>
                                        <em>Unclassified</em>
                                      </p>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell>
                                    {typeof item.visibility === "string" &&
                                    item.visibility ? (
                                      <p>
                                        {getVisibilityText(item.visibility)}
                                      </p>
                                    ) : (
                                      <p>
                                        <em>Unknown</em>
                                      </p>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>{truncateString(projectLead, 50)}</p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    {item.updatedAt && (
                                      <p>
                                        {format(
                                          parseISO(item.updatedAt),
                                          "MM/dd/yy"
                                        )}{" "}
                                        at{" "}
                                        {format(
                                          parseISO(item.updatedAt),
                                          "h:mm aa"
                                        )}
                                      </p>
                                    )}
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })}
                          {displayProjects.length === 0 && (
                            <Table.Row>
                              <Table.Cell colSpan={6}>
                                <p className="text-center">
                                  <em>No results found.</em>
                                </p>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table>
                    </Segment>
                    <Header as="h3" dividing>
                      Books
                    </Header>
                    <Segment basic>
                      <Segment attached="top">
                        <div className="flex-row-div">
                          <div className="left-flex">
                            <span>Displaying </span>
                            <Dropdown
                              className="search-itemsperpage-dropdown"
                              selection
                              options={catalogItemsPerPageOptions}
                              onChange={(_e, { value }) =>
                                setBooksPerPage((value as number) ?? 12)
                              }
                              value={booksPerPage}
                              aria-label="Number of results to display per page"
                            />
                            <span>
                              {" "}
                              items per page of{" "}
                              <strong>
                                {Number(bookResults.length).toLocaleString()}
                              </strong>{" "}
                              results.
                            </span>
                          </div>
                          <div className="center-flex">
                            <ConductorPagination
                              activePage={bookActivePage}
                              totalPages={bookTotalPages}
                              firstItem={null}
                              lastItem={null}
                              onPageChange={(e, data) =>
                                setBookActivePage(
                                  (data.activePage as number) ?? 1
                                )
                              }
                            />
                          </div>
                          <div className="right-flex">
                            <Dropdown
                              placeholder="Sort by..."
                              floating
                              selection
                              button
                              options={bookSortOptions}
                              onChange={(_e, { value }) =>
                                handleFilterSortChange(
                                  "bookSort",
                                  (value as string) ?? "title"
                                )
                              }
                              value={bookSort}
                              aria-label="Sort Book Results by"
                            />
                          </div>
                        </div>
                      </Segment>
                      <Table celled attached title="Book Search Results">
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell scope="col">
                              <Image
                                centered
                                src={getLibGlyphURL("")}
                                className="commons-itemized-glyph"
                                alt={getLibGlyphAltText("")}
                              />
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Title</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Subject</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Author</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Affiliation</Header>
                            </Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {displayBooks.length > 0 &&
                            displayBooks.map((item, index) => {
                              return (
                                <Table.Row key={index}>
                                  <Table.Cell>
                                    <Image
                                      centered
                                      src={getLibGlyphURL(item.library)}
                                      className="commons-itemized-glyph"
                                      alt={getLibGlyphAltText(item.library)}
                                    />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>
                                      <strong>
                                        <Link
                                          to={`/book/${item.bookID}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          {item.title}
                                        </Link>
                                      </strong>
                                    </p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>{item.subject}</p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>{item.author}</p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>
                                      <em>{item.affiliation}</em>
                                    </p>
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })}
                          {displayBooks.length === 0 && (
                            <Table.Row>
                              <Table.Cell colSpan={5}>
                                <p className="text-center">
                                  <em>No results found.</em>
                                </p>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table>
                    </Segment>
                    <Header as="h3" dividing>
                      Assets
                    </Header>
                    <Segment basic>
                      <Segment attached="top">
                        <div className="flex-row-div">
                          <div className="left-flex">
                            <span>Displaying </span>
                            <Dropdown
                              className="search-itemsperpage-dropdown"
                              selection
                              options={catalogItemsPerPageOptions}
                              onChange={(_e, { value }) =>
                                setBooksPerPage((value as number) ?? 12)
                              }
                              value={booksPerPage}
                              aria-label="Number of results to display per page"
                            />
                            <span>
                              {" "}
                              items per page of{" "}
                              <strong>
                                {Number(assetResults.length).toLocaleString()}
                              </strong>{" "}
                              results.
                            </span>
                          </div>
                          <div className="center-flex">
                            <ConductorPagination
                              activePage={assetActivePage}
                              totalPages={assetTotalPages}
                              firstItem={null}
                              lastItem={null}
                              onPageChange={(e, data) =>
                                setAssetActivePage(
                                  (data.activePage as number) ?? 1
                                )
                              }
                            />
                          </div>
                          <div className="right-flex">
                            {/* <Dropdown
                              placeholder="Sort by..."
                              floating
                              selection
                              button
                              options={bookSortOptions}
                              onChange={(_e, { value }) =>
                                handleFilterSortChange(
                                  "bookSort",
                                  (value as string) ?? "title"
                                )
                              }
                              value={bookSort}
                              aria-label="Sort Book Results by"
                            /> */}
                          </div>
                        </div>
                      </Segment>
                      <Table celled attached title="Asset Search Results">
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell scope="col">
                              <Header sub>Name</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Size</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell scope="col">
                              <Header sub>Tags</Header>
                            </Table.HeaderCell>
                            {/* <Table.HeaderCell scope="col">
                              <Header sub>Download</Header>
                            </Table.HeaderCell> */}
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {displayAssets.length > 0 &&
                            displayAssets.map((item, index) => {
                              return (
                                <Table.Row key={index}>
                                  <Table.Cell>
                                    {item.storageType === "folder" ? (
                                      <Icon name="folder outline" />
                                    ) : (
                                      <FileIcon filename={item.name} />
                                    )}
                                    <a
                                      aria-label={`Download ${item.name}`}
                                      onClick={() => handleDownloadFile(item)}
                                      className="text-link"
                                    >
                                      {item.name}
                                    </a>
                                  </Table.Cell>
                                  <Table.Cell>
                                    {item.storageType === "file" &&
                                      fileSizePresentable(item.size)}
                                  </Table.Cell>
                                  {/* <Table.Cell>
                                    {item.createdDate && (
                                      <span>
                                        {getPrettyCreatedDate(item.createdDate)}
                                      </span>
                                    )}
                                    {item.uploader && (
                                      <span>
                                        by
                                        {getPrettyUploader(item.uploader)}
                                      </span>
                                    )}
                                  </Table.Cell> */}
                                  <Table.Cell>
                                    <RenderAssetTags file={item} />
                                  </Table.Cell>
                                  {/* <Table.Cell></Table.Cell> */}
                                </Table.Row>
                              );
                            })}
                          {displayAssets.length === 0 && (
                            <Table.Row>
                              <Table.Cell colSpan={5}>
                                <p className="text-center">
                                  <em>No results found.</em>
                                </p>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table>
                    </Segment>
                    <Header as="h3" dividing>
                      Homework &amp; Assessments
                    </Header>
                    <Segment basic>
                      <Segment attached="top">
                        <div className="flex-row-div">
                          <div className="left-flex">
                            <span>Displaying </span>
                            <Dropdown
                              className="search-itemsperpage-dropdown"
                              selection
                              options={catalogItemsPerPageOptions}
                              onChange={(_e, { value }) =>
                                setHwPerPage((value as number) ?? 12)
                              }
                              value={hwPerPage}
                              aria-label="Number of results to display per page"
                            />
                            <span>
                              {" "}
                              items per page of{" "}
                              <strong>
                                {Number(hwResults.length).toLocaleString()}
                              </strong>{" "}
                              results.
                            </span>
                          </div>
                          <div className="center-flex">
                            <ConductorPagination
                              activePage={hwActivePage}
                              totalPages={hwTotalPages}
                              firstItem={null}
                              lastItem={null}
                              onPageChange={(e, data) =>
                                setHwActivePage(
                                  (data.activePage as number) ?? 1
                                )
                              }
                            />
                          </div>
                          <div className="right-flex">
                            <Dropdown
                              placeholder="Sort by..."
                              floating
                              selection
                              button
                              options={hwSortOptions}
                              onChange={(_e, { value }) =>
                                handleFilterSortChange(
                                  "hwSort",
                                  (value as string) ?? "name"
                                )
                              }
                              value={hwSort}
                              aria-label="Sort Homework and Assessments Results by"
                            />
                          </div>
                        </div>
                      </Segment>
                      <Table celled title="Homework Search Results">
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell width={6} scope="col">
                              <Header sub>Name</Header>
                            </Table.HeaderCell>
                            <Table.HeaderCell width={10} scope="col">
                              <Header sub>Description</Header>
                            </Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {displayHomework.length > 0 &&
                            displayHomework.map((item, index) => {
                              return (
                                <Table.Row key={index}>
                                  <Table.Cell>
                                    <p
                                      onClick={() => openHwModal(item)}
                                      className="text-link"
                                      tabIndex={0}
                                    >
                                      <strong>{item.title}</strong>
                                    </p>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <p>
                                      {truncateString(item.description, 250)}
                                    </p>
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })}
                          {displayHomework.length === 0 && (
                            <Table.Row>
                              <Table.Cell colSpan="2">
                                <p className="text-center">
                                  <em>No results found.</em>
                                </p>
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table>
                    </Segment>
                    <Header as="h3" dividing>
                      Users
                    </Header>
                    <Segment basic>
                      <Segment attached="top">
                        <div className="flex-row-div">
                          <div className="left-flex">
                            <span>Displaying </span>
                            <Dropdown
                              className="search-itemsperpage-dropdown"
                              selection
                              options={catalogItemsPerPageOptions}
                              onChange={(_e, { value }) =>
                                setUsersPerPage((value as number) ?? 12)
                              }
                              value={usersPerPage}
                              aria-label="Number of results to display per page"
                            />
                            <span>
                              {" "}
                              items per page of{" "}
                              <strong>
                                {Number(userResults.length).toLocaleString()}
                              </strong>{" "}
                              results.
                            </span>
                          </div>
                          <div className="center-flex">
                            <ConductorPagination
                              activePage={userActivePage}
                              totalPages={userTotalPages}
                              firstItem={null}
                              lastItem={null}
                              onPageChange={(e, data) =>
                                setUserActivePage(
                                  (data.activePage as number) ?? 1
                                )
                              }
                            />
                          </div>
                          <div className="right-flex">
                            <Dropdown
                              placeholder="Sort by..."
                              floating
                              selection
                              button
                              options={userSortOptions}
                              onChange={(_e, { value }) =>
                                handleFilterSortChange(
                                  "userSort",
                                  (value as string) ?? "first"
                                )
                              }
                              value={userSort}
                              aria-label="Sort User Results by"
                            />
                          </div>
                        </div>
                      </Segment>
                      <Segment basic attached>
                        {displayUsers.length > 0 && (
                          <List divided relaxed verticalAlign="middle">
                            {displayUsers.map((item, idx) => {
                              return (
                                <List.Item key={`user-result-${idx}`}>
                                  <div className="flex-row-div">
                                    <div className="left-flex">
                                      <Image avatar src={item.avatar} />
                                      <List.Content className="ml-1p">
                                        {item.firstName} {item.lastName}
                                      </List.Content>
                                    </div>
                                    <div className="right-flex">
                                      <Popup
                                        position="left center"
                                        trigger={<Icon name="info circle" />}
                                        content="More community features coming soon!"
                                      />
                                    </div>
                                  </div>
                                </List.Item>
                              );
                            })}
                          </List>
                        )}
                        {displayUsers.length === 0 && (
                          <p className="text-center">No results found.</p>
                        )}
                      </Segment>
                    </Segment>
                  </>
                )}
                {numResults === 0 && (
                  <Message>
                    <p>No results found.</p>
                  </Message>
                )}
              </>
            ) : (
              <Segment basic loading={true}>
                <Placeholder fluid>
                  <Placeholder.Header>
                    <Placeholder.Line />
                  </Placeholder.Header>
                  <Placeholder.Paragraph>
                    <Placeholder.Line />
                    <Placeholder.Line />
                    <Placeholder.Line />
                    <Placeholder.Line />
                    <Placeholder.Line />
                  </Placeholder.Paragraph>
                </Placeholder>
              </Segment>
            )}
          </Segment>
          {/* Homework View Modal */}
          {selectedHW && (
            <PreviewHomework
              show={showHwModal}
              homework={selectedHW}
              onClose={() => closeHwModal()}
            />
          )}
          {/* Create Alert Modal */}
          <AlertModal
            open={showAlertModal}
            onClose={closeCreateAlertModal}
            mode="create"
            query={searchQuery}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default Search;
