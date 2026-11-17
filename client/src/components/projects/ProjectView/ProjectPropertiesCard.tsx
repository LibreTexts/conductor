import type { ReactNode } from "react";
import { Badge, Button, Card } from "@libretexts/davis-react";
import { IconExternalLink } from "@tabler/icons-react";
import { CIDDescriptor, Project, ProjectTag } from "../../../types";
import { ProjectPermissions } from "../../../hooks/useProjectPermissions";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";
import { getLibraryName } from "../../util/LibraryOptions";
import { getClassificationText } from "../../util/ProjectHelpers";
import ProjectLinkButtons from "../ProjectLinkButtons";
import ProjectCoAuthoringToolsButtons from "../ProjectCoAuthoringToolsButtons";
import ProjectRoadmapStepper from "./ProjectRoadmapStepper";
import CardHeading from "./CardHeading";

interface ProjectPropertiesCardProps {
  project: Project;
  permissions: ProjectPermissions;
  isMiniRepo: boolean;
  onOpenReaderResources: () => void;
}

const STATUS_VARIANTS: Record<string, "success" | "primary" | "warning" | "default"> = {
  completed: "success",
  open: "primary",
  available: "warning",
};

// GET /project flattens tags to titles and C-IDs to descriptors, despite the declared types.
const tagLabel = (tag: ProjectTag | string) =>
  typeof tag === "string" ? tag : tag.title ?? "";
const cidLabel = (cid: CIDDescriptor | string) =>
  typeof cid === "string" ? cid : cid.descriptor;

const PropertyRow =({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">
      {label}
    </span>
    {children}
  </div>
);

const BadgeList = ({ label, items }: { label: string; items: string[] }) => (
  <div className="col-span-2">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 block mb-1">
      {label}
    </span>
    <div className="flex flex-wrap gap-1">
      {items.map((item, idx) => (
        <Badge key={`${item}-${idx}`} label={item} variant="default" size="sm" />
      ))}
    </div>
  </div>
);

const ProjectPropertiesCard: React.FC<ProjectPropertiesCardProps> = ({
  project,
  permissions,
  isMiniRepo,
  onOpenReaderResources,
}) => {
  const isMemberOrAdmin = permissions.isAdmin || permissions.isMember;
  const hasCoAuthoringTools =
    !isMiniRepo && isMemberOrAdmin && !!project.libreCoverID && !!project.libreLibrary;
  // ProjectCoAuthoringToolsButtons hosts the reader resources button when it renders.
  const showReaderResourcesButton =
    permissions.canViewDetails && !!project.hasCommonsBook && !hasCoAuthoringTools;

  return (
    // !overflow-visible: this Card hosts Tooltips (in ProjectLinkButtons) that need to
    // escape the card's bounds. Card's default styling clips overflow for rounded corners.
    <Card variant="outline" padding="md" className="mb-6 !overflow-visible">
      <Card.Body>
        <CardHeading>Project Properties</CardHeading>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3">
          {project.status && (
            <PropertyRow label="Status">
              <Badge
                label={
                  project.status === "open"
                    ? "Open / In Progress"
                    : capitalizeFirstLetter(project.status)
                }
                variant={STATUS_VARIANTS[project.status] ?? "default"}
              />
            </PropertyRow>
          )}
          {project.visibility && (
            <PropertyRow label="Visibility">
              <Badge
                label={capitalizeFirstLetter(project.visibility)}
                variant={project.visibility === "public" ? "success" : "default"}
              />
            </PropertyRow>
          )}
          {project.classification && (
            <PropertyRow label="Classification">
              <Badge
                label={getClassificationText(project.classification)}
                variant="primary"
                size="sm"
              />
            </PropertyRow>
          )}
          {project.libreLibrary && (
            <PropertyRow label="Library">
              <span className="text-sm">{getLibraryName(project.libreLibrary)}</span>
            </PropertyRow>
          )}
          {project.libreShelf && (
            <PropertyRow label="Bookshelf">
              <span className="text-sm">{project.libreShelf}</span>
            </PropertyRow>
          )}
          {project.libreCampus && (
            <PropertyRow label="Campus">
              <span className="text-sm">{project.libreCampus}</span>
            </PropertyRow>
          )}
          {Array.isArray(project.cidDescriptors) && project.cidDescriptors.length > 0 && (
            <BadgeList label="C-ID(s)" items={project.cidDescriptors.map(cidLabel)} />
          )}
          {Array.isArray(project.tags) && project.tags.length > 0 && (
            <BadgeList label="Tags" items={project.tags.map(tagLabel)} />
          )}
        </div>

        {project.rdmpCurrentStep && <ProjectRoadmapStepper currentStep={project.rdmpCurrentStep} />}

        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <ProjectLinkButtons
              projectID={project.projectID}
              libreCoverID={project.libreCoverID}
              libreLibrary={project.libreLibrary}
              projectLink={project.projectURL}
              projectTitle={project.title}
              didCreateWorkbench={project.didCreateWorkbench}
              hasCommonsBook={project.hasCommonsBook}
              projectClassification={project.classification}
              projectVisibility={project.visibility}
              project={project}
              isProjectMemberOrAdmin={isMemberOrAdmin}
              didRequestPublish={project.didRequestPublish}
            />
            {project.adaptCourseID && (
              <a
                href={`https://adapt.libretexts.org/instructors/courses/${project.adaptCourseID}/assignments`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                View Course on ADAPT <IconExternalLink size={13} aria-hidden="true" />
                <span className="sr-only">(opens in new tab)</span>
              </a>
            )}
            {showReaderResourcesButton && (
              <Button variant="primary" size="sm" onClick={onOpenReaderResources}>
                Manage Reader Resources
              </Button>
            )}
          </div>
          <ProjectCoAuthoringToolsButtons
            handleOpenReaderResourcesModal={onOpenReaderResources}
            hasCommonsBook={project.hasCommonsBook}
            isProjectMemberOrAdmin={isMemberOrAdmin}
            libreCoverID={project.libreCoverID}
            libreLibrary={project.libreLibrary}
            projectClassification={project.classification}
            projectID={project.projectID}
          />
        </div>
      </Card.Body>
    </Card>
  );
};

export default ProjectPropertiesCard;
