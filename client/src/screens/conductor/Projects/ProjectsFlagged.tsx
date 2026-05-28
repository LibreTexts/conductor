import {
  Heading,
  IconButton,
  Input,
  Select,
  Stack,
  Tabs,
} from "@libretexts/davis-react";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useHistory, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

import useGlobalError from "../../../components/error/ErrorHooks";
import { Project } from "../../../types";
import MyProjectsTable from "../../../components/projects/MyProjectsTable";

const ITEMS_OPTIONS = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

const ProjectsFlagged = () => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  const [loadedProjects, setLoadedProjects] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchString, setSearchString] = useState("");
  const [sortChoice] = useState("title");

  const [projects, setProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [pageProjects, setPageProjects] = useState<Project[]>([]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | My Projects | Flagged";
    getFlaggedProjects();
  }, []);

  useEffect(() => {
    setTotalPages(Math.ceil(displayProjects.length / itemsPerPage));
    setPageProjects(
      displayProjects.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [itemsPerPage, displayProjects, activePage]);

  useEffect(() => {
    filterAndSortProjs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchString, sortChoice]);

  const filterAndSortProjs = () => {
    setLoadedProjects(false);
    const filtered = projects.filter((proj) => {
      const descripString = String(proj.title).toLowerCase();
      return (
        searchString === "" ||
        descripString.indexOf(String(searchString).toLowerCase()) !== -1
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
      const normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
      if (normalA < normalB) return -1;
      if (normalA > normalB) return 1;
      return 0;
    });
    setDisplayProjects(sorted);
    setLoadedProjects(true);
  };

  const getFlaggedProjects = () => {
    setLoadedProjects(false);
    axios
      .get("/projects/flagged")
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
  };

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="row" className="justify-between items-center mb-6">
        <Heading level={2}>Flagged Projects</Heading>
      </Stack>

      {(() => {
        const tabRoutes = ["/projects/available", "/projects/completed", "/projects/flagged"];
        const activeIdx = tabRoutes.findIndex((r) => location.pathname.startsWith(r));
        return (
          <Tabs
            variant="pills"
            color="white"
            selectedIndex={activeIdx >= 0 ? activeIdx : 2}
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
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <Input
            placeholder="Search flagged projects..."
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
            className="w-80"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Displaying</span>
            <Select
              options={ITEMS_OPTIONS}
              value={String(itemsPerPage)}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setActivePage(1);
              }}
            />
            <span className="text-sm text-gray-600">
              items per page of{" "}
              <strong>{Number(projects.length).toLocaleString()}</strong> results.
            </span>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<IconChevronLeft size={16} />}
              aria-label="Previous page"
              variant="ghost"
              onClick={() => setActivePage((p) => p - 1)}
              disabled={activePage <= 1}
            />
            <span className="text-sm text-gray-600 px-2">
              {activePage} / {totalPages || 1}
            </span>
            <IconButton
              icon={<IconChevronRight size={16} />}
              aria-label="Next page"
              variant="ghost"
              onClick={() => setActivePage((p) => p + 1)}
              disabled={activePage >= totalPages}
            />
          </div>
        </div>

        <MyProjectsTable data={pageProjects} loading={!loadedProjects} />

        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Displaying</span>
            <Select
              options={ITEMS_OPTIONS}
              value={String(itemsPerPage)}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setActivePage(1);
              }}
            />
            <span className="text-sm text-gray-600">
              items per page of{" "}
              <strong>{Number(projects.length).toLocaleString()}</strong> results.
            </span>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={<IconChevronLeft size={16} />}
              aria-label="Previous page"
              variant="ghost"
              onClick={() => setActivePage((p) => p - 1)}
              disabled={activePage <= 1}
            />
            <span className="text-sm text-gray-600 px-2">
              {activePage} / {totalPages || 1}
            </span>
            <IconButton
              icon={<IconChevronRight size={16} />}
              aria-label="Next page"
              variant="ghost"
              onClick={() => setActivePage((p) => p + 1)}
              disabled={activePage >= totalPages}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsFlagged;
