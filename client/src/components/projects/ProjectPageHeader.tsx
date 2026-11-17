import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb, Heading, Text } from "@libretexts/davis-react";
import { Project } from "../../types";
import CopyValueButton from "../util/CopyValueButton";
import PinProjectButton from "./ProjectView/PinProjectButton";
import { ProjectStatusBadge, ProjectVisibilityBadge } from "./ProjectView/projectDisplay";

interface ProjectPageHeaderProps {
  projectID: string;
  project: Project;
  /** Show the Flagged Projects crumb for flagged projects (reviewer entry point). */
  reviewerMode?: boolean;
  /** Main action buttons, under the title and breadcrumb. */
  actions?: ReactNode;
}

/**
 * Title with status badges, project ID and pin control, breadcrumb, and main actions
 * for the /projects/:id page.
 */
const ProjectPageHeader: React.FC<ProjectPageHeaderProps> = ({
  projectID,
  project,
  reviewerMode = false,
  actions,
}) => {
  const showFlaggedCrumb = !!project.flag && reviewerMode;
  const parentCrumb = showFlaggedCrumb
    ? { to: "/projects/flagged", label: "Flagged projects" }
    : project.status === "available"
      ? { to: "/projects/available", label: "Available projects" }
      : project.status === "completed"
        ? { to: "/projects/completed", label: "Completed projects" }
        : null;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <Heading level={1} className="m-0!">
              {project.title}
            </Heading>
            <div className="flex flex-wrap items-center gap-2">
              {project.status && <ProjectStatusBadge status={project.status} />}
              {project.visibility && <ProjectVisibilityBadge visibility={project.visibility} />}
              <span className="inline-flex items-center gap-1 sm:hidden">
                <Text size="sm" color="muted">ID {project.projectID}</Text>
                <CopyValueButton value={project.projectID} label="Copy Project ID" tooltipPosition="bottom" />
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 max-sm:hidden">
            <span className="inline-flex items-center gap-1">
              <Text size="sm" color="muted">
                Project ID{" "}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5">{project.projectID}</code>
              </Text>
              <CopyValueButton value={project.projectID} label="Copy Project ID" tooltipPosition="bottom" />
            </span>
            <PinProjectButton projectID={projectID} />
          </div>
        </div>
        <Breadcrumb className="pl-0.5 max-sm:hidden">
          <Breadcrumb.Item>
            <Link to="/projects">Projects</Link>
          </Breadcrumb.Item>
          {parentCrumb && (
            <Breadcrumb.Item>
              <Link to={parentCrumb.to}>{parentCrumb.label}</Link>
            </Breadcrumb.Item>
          )}
          <Breadcrumb.Item isCurrent>{project.title}</Breadcrumb.Item>
        </Breadcrumb>
      </div>
      {actions}
    </header>
  );
};

export default ProjectPageHeader;
