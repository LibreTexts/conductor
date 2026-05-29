import { Button, Tooltip } from "@libretexts/davis-react";
import { IconExternalLink, IconPlus } from "@tabler/icons-react";
import { normalizeURL } from "../util/HelperFunctions";
import {
  buildCommonsUrl,
  buildLibraryPageGoURL,
  buildRemixerURL,
} from "../../utils/projectHelpers";
import { lazy, useState } from "react";
import { ProjectClassification } from "../../types";
const CreateWorkbenchModal = lazy(() => import("./CreateWorkbenchModal"));

interface ProjectLinkButtonsProps {
  libreLibrary?: string;
  libreCoverID?: string;
  projectLink?: string;
  didCreateWorkbench?: boolean;
  hasCommonsBook?: boolean;
  projectID?: string;
  projectTitle?: string;
  projectClassification?: string;
  projectVisibility?: string;
  project: object;
  isProjectMemberOrAdmin?: boolean;
  canRequestPublish?: boolean;
  didRequestPublish?: boolean;
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  libreLibrary,
  libreCoverID,
  projectLink,
  didCreateWorkbench,
  hasCommonsBook = false,
  projectID,
  projectTitle,
  projectClassification,
  projectVisibility,
  project,
  isProjectMemberOrAdmin = false,
  canRequestPublish = false,
  didRequestPublish = false,
}) => {
  const [showCreateWorkbenchModal, setShowCreateWorkbenchModal] = useState(false);
  const validWorkbench = didCreateWorkbench && libreCoverID && libreLibrary;

  if (projectClassification === ProjectClassification.MINI_REPO) return null;

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 block mb-2">
        Important Actions
      </span>
      <div className="flex flex-row flex-wrap gap-2">
        {!projectLink && !didCreateWorkbench && isProjectMemberOrAdmin && (
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            onClick={() => setShowCreateWorkbenchModal(true)}
          >
            Create Book
          </Button>
        )}
        {(projectLink || validWorkbench) && (
          <Tooltip
            content={
              validWorkbench
                ? "Takes you to the book's page in the LibreTexts libraries."
                : "Takes you to the project's linked URL."
            }
          >
            <Button
              variant="outline"
              icon={<IconExternalLink size={15} />}
              onClick={() =>
                validWorkbench
                  ? window.open(buildLibraryPageGoURL(libreLibrary!, libreCoverID!), "_blank")
                  : projectLink
                  ? window.open(normalizeURL(projectLink ?? ""), "_blank")
                  : undefined
              }
            >
              Open Project Link
            </Button>
          </Tooltip>
        )}
        {hasCommonsBook && libreCoverID && libreLibrary && (
          <Tooltip content="Takes you to the book's page on the Commons.">
            <Button
              variant="outline"
              icon={<IconExternalLink size={15} />}
              onClick={() => window.open(buildCommonsUrl(libreLibrary, libreCoverID), "_blank")}
            >
              View Textbook on Commons
            </Button>
          </Tooltip>
        )}
        {projectVisibility === "public" && (
          <Tooltip content="Takes you to the project's page on the Commons.">
            <Button
              variant="outline"
              icon={<IconExternalLink size={15} />}
              onClick={() => window.open(`/commons-project/${projectID}`, "_blank")}
            >
              View Project on Commons
            </Button>
          </Tooltip>
        )}
        {(validWorkbench || hasCommonsBook) && libreCoverID && libreLibrary && isProjectMemberOrAdmin && (
          <Tooltip content="Opens the book in the LibreTexts OER Remixer.">
            <Button
              variant="outline"
              icon={<IconExternalLink size={15} />}
              onClick={() =>
                window.open(
                  buildRemixerURL(
                    libreLibrary ?? "chem",
                    libreLibrary && libreCoverID ? buildLibraryPageGoURL(libreLibrary, libreCoverID) : ""
                  ),
                  "_blank"
                )
              }
            >
              Open OER Remixer
            </Button>
          </Tooltip>
        )}
        {canRequestPublish && projectID && (
          <Button
            as="a"
            href={`https://commons.libretexts.org/support/contact?queue=publishing&projectID=${projectID}&capturedURL=${encodeURIComponent(window.location.href)}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            disabled={didRequestPublish}
          >
            {didRequestPublish ? "Publishing Requested" : "Request to Publish"}
          </Button>
        )}
        {projectID && projectTitle && (
          <CreateWorkbenchModal
            show={showCreateWorkbenchModal}
            projectID={projectID}
            projectTitle={projectTitle}
            onClose={() => setShowCreateWorkbenchModal(false)}
            onSuccess={() => window.location.reload()}
            project={project}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectLinkButtons;
