import "../../../components/projects/Projects.css";

import {
  Grid,
  Header,
  Menu,
  Input,
  Segment,
  Message,
  Icon,
  Button,
  Loader,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import CreateProject from "../../../components/projects/CreateProject.js";
import useGlobalError from "../../../components/error/ErrorHooks.js";
import { useSearchParams } from "react-router-dom-v5-compat";
import { Project } from "../../../types/index.js";
import MyProjectsTable from "../../../components/projects/MyProjectsTable";

const ProjectsPortal = () => {
  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI
  const [loadedProjects, setLoadedProjects] = useState(false);
  const [searchString, setSearchString] = useState("");
  const [sortChoice, setSortChoice] = useState("title");
  const [projectCreated, setProjectCreated] = useState(false);
  const [projectDeleted, setProjectDeleted] = useState(false);

  // Projects Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);

  // Create Project
  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    if (location.pathname.includes("create")) {
      setShowCreateProject(true);
    } else {
      setShowCreateProject(false);
    }
  }, [location, setShowCreateProject]);

  /**
   * Retrieve user's projects from the server and save them to state.
   */
  const getUserProjects = useCallback(() => {
    axios
      .get("/projects/all")
      .then((res) => {
        if (!res.data.err) {
          if (res.data.projects && Array.isArray(res.data.projects)) {
            setProjects(res.data.projects);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedProjects(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedProjects(true);
      });
  }, [setProjects, setLoadedProjects, handleGlobalError]);

  /**
   * Initialize plugins and UI state, then get user's projects.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | My Projects";
    if (searchParams) {
      let createdFlag = searchParams.get("projectCreated");
      let deletedFlag = searchParams.get("projectDeleted");
      if (createdFlag === "true") setProjectCreated(true);
      if (deletedFlag === "true") setProjectDeleted(true);
    }
    getUserProjects();
  }, [location, getUserProjects, setProjectCreated, setProjectDeleted]);

  /**
   * Track changes to the number of projects loaded
   * and the selected itemsPerPage and update the
   * set of projects to display.
   */
  /*
    useEffect(() => {
        setTotalPages(Math.ceil(displayProjects.length/itemsPerPage));
        setPageProjects(displayProjects.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayProjects, activePage]);
    */

  /**
   * Filter and sort projects according to
   * current filters and sort choice.
   */
  useEffect(() => {
    let filtered = projects.filter((proj) => {
      let descripString = String(proj.title).toLowerCase();
      if (
        searchString !== "" &&
        String(descripString).indexOf(String(searchString).toLowerCase()) === -1
      ) {
        // doesn't match search string, don't include
        return false;
      }
      return proj;
    });
    if (sortChoice === "title") {
      const sorted = [...filtered].sort((a, b) => {
        let normalA = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        let normalB = String(b.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        if (normalA < normalB) return -1;
        if (normalA > normalB) return 1;
        return 0;
      });
      setDisplayProjects(sorted);
    }
  }, [projects, sortChoice, searchString, setDisplayProjects]);

  /**
   * Opens the Create Project tool.
   */
  function handleOpenCreateProject() {
    history.push("/projects/create");
  }

  /**
   * Closes the Create Project tool.
   */
  function handleCloseCreateProject() {
    history.push("/projects");
  }

  return (
    <Grid className="component-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">My Projects</Header>
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
          <Menu widths={3}>
            <Menu.Item
              as={Link}
              to="/projects/available"
              name="availableprojects"
              icon="folder open"
              content={<p>Available Projects</p>}
            />
            <Menu.Item
              as={Link}
              to="/projects/completed"
              name="completedprojects"
              icon="check"
              content={<p>Completed Projects</p>}
            />
            <Menu.Item
              as={Link}
              to="/projects/flagged"
              name="flaggedprojects"
              icon="attention"
              content={<p>Flagged Projects</p>}
            />
          </Menu>
          <Segment.Group>
            <Segment>
              <Input
                icon="search"
                iconPosition="left"
                placeholder="Search current projects..."
                onChange={(e) => {
                  setSearchString(e.target.value);
                }}
                value={searchString}
              />
              <Loader active={!loadedProjects} className="ml-2p" inline />
              <Button
                floated="right"
                color="green"
                onClick={handleOpenCreateProject}
              >
                <Button.Content>
                  <Icon name="add" />
                  Create a Project
                </Button.Content>
              </Button>
            </Segment>
            <Segment>
              <MyProjectsTable data={displayProjects} />
            </Segment>
          </Segment.Group>
          <CreateProject
            show={showCreateProject}
            onClose={handleCloseCreateProject}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default ProjectsPortal;
