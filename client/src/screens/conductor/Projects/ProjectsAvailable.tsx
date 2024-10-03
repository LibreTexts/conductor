import "../../../components/projects/Projects.css";

import {
  Grid,
  Header,
  Input,
  Segment,
  Message,
  Icon,
  Dropdown,
  Pagination,
  Breadcrumb,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

import { itemsPerPageOptions } from "../../../components/util/PaginationOptions.js";
import useGlobalError from "../../../components/error/ErrorHooks.js";
import { useSearchParams } from "react-router-dom-v5-compat";
import { Project } from "../../../types";
import MyProjectsTable from "../../../components/projects/MyProjectsTable";

const ProjectsAvailable = () => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI
  const [loadedProjects, setLoadedProjects] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchString, setSearchString] = useState("");
  const [sortChoice, setSortChoice] = useState("title");

  const [projectCreated, setProjectCreated] = useState(false);
  const [projectDeleted, setProjectDeleted] = useState(false);

  // Projects Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [pageProjects, setPageProjects] = useState<Project[]>([]);

  useEffect(() => {
    getAvailableProjects();
  }, []);

  useEffect(() => {
    document.title = "LibreTexts Conductor | My Projects | Available";
    if (searchParams.has("projectCreated")) {
      setProjectCreated(true);
    }
    if (searchParams.has("projectDeleted")) {
      setProjectDeleted(true);
    }
  }, [searchParams]);

  /**
   * Track changes to the number of projects loaded
   * and the selected itemsPerPage and update the
   * set of projects to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(displayProjects.length / itemsPerPage));
    setPageProjects(
      displayProjects.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, displayProjects, activePage]);

  /**
   * Filter and sort projects according to
   * user's choices, then update the list.
   */
  useEffect(() => {
    filterAndSortProjs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchString, sortChoice]);

  /**
   * Filter and sort projects according to
   * current filters and sort choice.
   */
  const filterAndSortProjs = () => {
    setLoadedProjects(false);
    let filtered = projects.filter((proj) => {
      var include = true;
      var descripString = String(proj.title).toLowerCase();
      if (
        searchString !== "" &&
        String(descripString).indexOf(String(searchString).toLowerCase()) === -1
      ) {
        include = false;
      }
      if (include) {
        return proj;
      } else {
        return false;
      }
    });
    if (sortChoice === "title") {
      const sorted = [...filtered].sort((a, b) => {
        var normalA = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        var normalB = String(b.title)
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
      setDisplayProjects(sorted);
    }
    setLoadedProjects(true);
  };

  const getAvailableProjects = () => {
    setLoadedProjects(false);
    axios
      .get("/projects/available")
      .then((res) => {
        if (!res.data.err) {
          if (res.data.projects && Array.isArray(res.data.projects)) {
            setProjects(res.data.projects);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedProjects(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedProjects(false);
      });
  };

  return (
    <Grid className="component-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Available Projects</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          {projectCreated && (
            <Message floating icon success>
              <Icon name="check" />
              <Message.Content>
                <Message.Header>Project successfully created!</Message.Header>
              </Message.Content>
            </Message>
          )}
          {projectDeleted && (
            <Message floating icon info>
              <Icon name="delete" />
              <Message.Content>
                <Message.Header>Project successfully deleted.</Message.Header>
              </Message.Content>
            </Message>
          )}
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/projects">
                  My Projects
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Available Projects
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <Input
                icon="search"
                iconPosition="left"
                placeholder="Search available projects..."
                onChange={(e) => {
                  setSearchString(e.target.value);
                }}
                value={searchString}
              />
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
                      setItemsPerPage(value as number);
                    }}
                    value={itemsPerPage}
                  />
                  <span>
                    {" "}
                    items per page of{" "}
                    <strong>
                      {Number(projects.length).toLocaleString()}
                    </strong>{" "}
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
                      setActivePage(data.activePage as number);
                    }}
                  />
                </div>
              </div>
            </Segment>
            <Segment loading={!loadedProjects}>
              <MyProjectsTable data={pageProjects} />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default ProjectsAvailable;
