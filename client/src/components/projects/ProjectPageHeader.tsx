import type { ReactNode } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Breadcrumb, Button, Heading, Tabs } from "@libretexts/davis-react";
import { IconChartBar, IconClipboardList, IconClock, IconPin } from "@tabler/icons-react";
import { useModals } from "../../context/ModalContext";
import { Project, ProjectClassification } from "../../types";
import { useIsProjectPinned, useUnpinProjectMutation } from "../Home/PinnedProjects/hooks";
import AddPinnedProjectModal from "../Home/PinnedProjects/AddPinnedProjectModal";

interface ProjectPageHeaderProps {
  projectID: string;
  project?: Project;
  /** Show the Flagged Projects crumb for flagged projects (reviewer entry point). */
  reviewerMode?: boolean;
  /** Rendered to the left of the navigation tabs. */
  actions?: ReactNode;
}

const PIN_MODAL_ID = "project-page-pin";

/**
 * Title, breadcrumb, pin control, and section tabs shared by the /projects/:id pages.
 */
const ProjectPageHeader: React.FC<ProjectPageHeaderProps> = ({
  projectID,
  project,
  reviewerMode = false,
  actions,
}) => {
  const history = useHistory();
  const location = useLocation();
  const { openModal, closeModal } = useModals();
  const isPinned = useIsProjectPinned(projectID);
  const unpinProject = useUnpinProjectMutation();

  const title = project?.title || "Loading...";
  const showFlaggedCrumb = !!project?.flag && reviewerMode;
  const basePath = `/projects/${projectID}`;

  const navTabs = [
    { label: "Project", icon: null, path: basePath },
    { label: "Timeline", icon: <IconClock size={14} />, path: `${basePath}/timeline` },
    ...(project?.classification !== ProjectClassification.MINI_REPO
      ? [{ label: "Peer Review", icon: <IconClipboardList size={14} />, path: `${basePath}/peerreview` }]
      : []),
    ...(project?.hasTrafficAnalyticsConfigured
      ? [{ label: "Analytics", icon: <IconChartBar size={14} />, path: `${basePath}/analytics` }]
      : []),
  ];
  const activeIdx = navTabs.findIndex((tab, i) =>
    i === 0 ? location.pathname === tab.path : location.pathname.startsWith(tab.path)
  );

  const handlePinToggle = () => {
    if (!project?.projectID) return;
    if (isPinned) {
      unpinProject.mutate(project.projectID);
      return;
    }
    openModal(
      <AddPinnedProjectModal
        show
        projectID={project.projectID}
        onClose={() => closeModal(PIN_MODAL_ID)}
      />,
      PIN_MODAL_ID
    );
  };

  return (
    <>
      <div className="flex items-start justify-between mb-2">
        <Heading level={1} className="text-3xl font-bold">
          Project: <em>{title}</em>
        </Heading>
      </div>

      <div className="flex items-center justify-between mb-5">
        <Breadcrumb>
          <Breadcrumb.Item>
            <Link to="/projects">Projects</Link>
          </Breadcrumb.Item>
          {showFlaggedCrumb && (
            <Breadcrumb.Item>
              <Link to="/projects/flagged">Flagged Projects</Link>
            </Breadcrumb.Item>
          )}
          {!showFlaggedCrumb && project?.status === "available" && (
            <Breadcrumb.Item>
              <Link to="/projects/available">Available Projects</Link>
            </Breadcrumb.Item>
          )}
          {!showFlaggedCrumb && project?.status === "completed" && (
            <Breadcrumb.Item>
              <Link to="/projects/completed">Completed Projects</Link>
            </Breadcrumb.Item>
          )}
          <Breadcrumb.Item isCurrent>{title}</Breadcrumb.Item>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">ID: {project?.projectID || "Loading..."}</span>
          <Button
            variant={isPinned ? "outline" : "primary"}
            icon={<IconPin size={15} />}
            onClick={handlePinToggle}
          >
            {isPinned ? "Unpin" : "Pin"} Project
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 overflow-x-auto min-w-0">
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        <Tabs
          variant="pills"
          color="white"
          selectedIndex={activeIdx >= 0 ? activeIdx : 0}
          onChange={(idx) => history.push(navTabs[idx].path)}
        >
          <Tabs.List>
            {navTabs.map((tab) => (
              <Tabs.Tab key={tab.label}>
                <span className="flex items-center gap-1.5">
                  {tab.icon}
                  {tab.label}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </div>
    </>
  );
};

export default ProjectPageHeader;
