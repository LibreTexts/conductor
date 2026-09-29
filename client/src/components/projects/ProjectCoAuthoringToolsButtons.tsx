import { Button, Tooltip } from "@libretexts/davis-react";
import { IconExternalLink } from "@tabler/icons-react";
import { buildLibraryPageGoURL, buildRemixerURL } from "../../utils/projectHelpers";
import { ProjectClassification } from "../../types";

interface ProjectCoAuthoringToolsButtonsProps {
  className?: string;
  handleOpenReaderResourcesModal: () => void;
  hasCommonsBook?: boolean;
  isProjectMemberOrAdmin?: boolean;
  libreCoverID?: string;
  libreLibrary?: string;
  projectClassification?: string;
  projectID?: string;
}

const actionTooltipClass =
  "[&>[role=tooltip]]:!left-0 [&>[role=tooltip]]:!translate-x-0 [&>[role=tooltip]]:!right-auto";

const ProjectCoAuthoringToolsButtons: React.FC<ProjectCoAuthoringToolsButtonsProps> = ({
  className,
  handleOpenReaderResourcesModal,
  hasCommonsBook = false,
  isProjectMemberOrAdmin = false,
  libreCoverID,
  libreLibrary,
  projectClassification,
  projectID,
}) => {
  const validBook = libreCoverID && libreLibrary;
  if (projectClassification === ProjectClassification.MINI_REPO) return null;
  if (!validBook && !hasCommonsBook) return null;
  if (!isProjectMemberOrAdmin) return null;

  return (
    <div className={className}>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Co-Authoring Tools:
      </span>
      <div className="flex flex-row flex-wrap gap-2 mt-2">
        {(validBook || hasCommonsBook) &&
          libreCoverID &&
          libreLibrary && (<>
              <Tooltip
                placement="bottom"
                className={actionTooltipClass}
                content="This link will open the book in the LibreTexts OER Remixer."
              >
                <Button
                  as="a"
                  href={buildRemixerURL(
                    libreLibrary ?? "chem",
                    libreLibrary && libreCoverID
                      ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                      : "",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="sm"
                  icon={<IconExternalLink size={16} />}
                  iconPosition="right"
                >
                  Open OER Remixer (Legacy)
                </Button>
              </Tooltip>
              <Tooltip
                placement="bottom"
                className={actionTooltipClass}
                content="This link will open the book in the LibreTexts OER Remixer v3."
              >
                <Button
                  as="a"
                  href={`/projects/${projectID}/remixer`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="sm"
                  icon={<IconExternalLink size={16} />}
                  iconPosition="right"
                >
                  Open OER Remixer v3 (New)
                </Button>
              </Tooltip>
              <Button
                as="a"
                href={`/projects/${projectID}/accessibility`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                icon={<IconExternalLink size={16} />}
                iconPosition="right"
              >
                Accessibility Remediation
              </Button>
              <Button
                as="a"
                href={`/glossary/project/${projectID}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                icon={<IconExternalLink size={16} />}
                iconPosition="right"
              >
                Glossary Manager
              </Button>
              <Button
                as="a"
                href={`/projects/${projectID}/restacker`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                icon={<IconExternalLink size={16} />}
                iconPosition="right"
              >
                License Restacker
              </Button>
              {hasCommonsBook && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenReaderResourcesModal}
                >
                  Manage Reader Resources
                </Button>
              )}
              <Button
                as="a"
                href={`/projects/${projectID}/ai-co-author`}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
                icon={<IconExternalLink size={16} />}
                iconPosition="right"
              >
                Metadata Editor
              </Button>
            </>
          )}
      </div>
    </div>
  );
};

export default ProjectCoAuthoringToolsButtons;
