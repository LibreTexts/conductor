import "../../../components/projects/Projects.css";

import { Alert, Button, Heading, Input, Spinner, Stack, Tabs } from "@libretexts/davis-react";
import { IconFolderOpen, IconCheck, IconFlag, IconPlus } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useLocation, useHistory } from "react-router-dom";
import axios from "axios";
import CreateProject from "../../../components/projects/CreateProject.js";
import useGlobalError from "../../../components/error/ErrorHooks.js";
import { useSearchParams } from "react-router-dom-v5-compat";
import { Project } from "../../../types/index.js";
import MyProjectsTable from "../../../components/projects/MyProjectsTable";

const ProjectsPortal = () => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [loadedProjects, setLoadedProjects] = useState(false);
  const [searchString, setSearchString] = useState("");
  const [sortChoice] = useState("title");
  const [projectCreated, setProjectCreated] = useState(false);
  const [projectDeleted, setProjectDeleted] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);

  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    if (location.pathname.includes("create")) {
      setShowCreateProject(true);
    } else {
      setShowCreateProject(false);
    }
  }, [location]);

  const getUserProjects = useCallback(() => {
    setLoadedProjects(false);
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

  useEffect(() => {
    document.title = "LibreTexts Conductor | My Projects";
    if (searchParams) {
      if (searchParams.get("projectCreated") === "true") setProjectCreated(true);
      if (searchParams.get("projectDeleted") === "true") setProjectDeleted(true);
    }
    getUserProjects();
  }, [location, getUserProjects]);

  useEffect(() => {
    let filtered = projects.filter((proj) => {
      const descripString = String(proj.title).toLowerCase();
      if (
        searchString !== "" &&
        descripString.indexOf(String(searchString).toLowerCase()) === -1
      ) {
        return false;
      }
      return true;
    });
    if (sortChoice === "title") {
      const sorted = [...filtered].sort((a, b) => {
        const normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
        const normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
        if (normalA < normalB) return -1;
        if (normalA > normalB) return 1;
        return 0;
      });
      setDisplayProjects(sorted);
    }
  }, [projects, sortChoice, searchString]);

  function handleOpenCreateProject() {
    history.push("/projects/create");
  }

  function handleCloseCreateProject() {
    history.push("/projects");
  }

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="row" className="justify-between items-center mb-6">
        <Heading level={2}>My Projects</Heading>
        <Button
          variant="primary"
          icon={<IconPlus size={16} />}
          onClick={handleOpenCreateProject}
        >
          Create a Project
        </Button>
      </Stack>

      {projectCreated && (
        <Alert variant="success" className="mb-4">
          Project successfully created!
        </Alert>
      )}
      {projectDeleted && (
        <Alert variant="info" className="mb-4">
          Project successfully deleted.
        </Alert>
      )}

      {(() => {
        const tabRoutes = ["/projects/available", "/projects/completed", "/projects/flagged"];
        const activeIdx = tabRoutes.findIndex((r) => location.pathname.startsWith(r));
        return (
          <Tabs
            variant="pills"
            color="white"
            selectedIndex={activeIdx >= 0 ? activeIdx : 0}
            onChange={(idx) => history.push(tabRoutes[idx])}
            className="mb-4 max-w-lg"
          >
            <Tabs.List>
              <Tabs.Tab>
                <span className="flex items-center gap-1.5">
                  <IconFolderOpen size={15} />
                  Available Projects
                </span>
              </Tabs.Tab>
              <Tabs.Tab>
                <span className="flex items-center gap-1.5">
                  <IconCheck size={15} />
                  Completed Projects
                </span>
              </Tabs.Tab>
              <Tabs.Tab>
                <span className="flex items-center gap-1.5">
                  <IconFlag size={15} />
                  Flagged Projects
                </span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        );
      })()}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gray-50">
          <Input
            placeholder="Search current projects..."
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
            className="w-80"
          />
          {!loadedProjects && <Spinner size="sm" />}
        </div>
        <MyProjectsTable data={displayProjects} loading={!loadedProjects} />
      </div>

      <CreateProject show={showCreateProject} onClose={handleCloseCreateProject} />
    </div>
  );
};

export default ProjectsPortal;
