import { Badge, Text } from "@libretexts/davis-react";
import {
  IconAccessible,
  IconArrowsShuffle,
  IconBooks,
  IconQuote,
  IconStack2,
  IconTag,
  IconVocabulary,
} from "@tabler/icons-react";
import { buildLibraryPageGoURL, buildRemixerURL } from "../../utils/projectHelpers";
import useClientConfig from "../../hooks/useClientConfig";
import { ProjectClassification } from "../../types";
import ProjectToolTile from "./ProjectToolTile";
import SectionCard from "./ProjectView/SectionCard";

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

/**
 * Whether the Co-authoring tools card renders anything. The tiles all need a
 * linked library book, so `hasCommonsBook` alone isn't enough.
 */
export const hasCoAuthoringTools = ({
  isProjectMemberOrAdmin = false,
  libreCoverID,
  libreLibrary,
  projectClassification,
}: Omit<ProjectCoAuthoringToolsButtonsProps, "handleOpenReaderResourcesModal">) => {
  if (projectClassification === ProjectClassification.MINI_REPO) return false;
  if (!isProjectMemberOrAdmin) return false;
  return !!libreCoverID && !!libreLibrary;
};

const ProjectCoAuthoringToolsButtons: React.FC<ProjectCoAuthoringToolsButtonsProps> = (props) => {
  const {
    className,
    handleOpenReaderResourcesModal,
    hasCommonsBook = false,
    libreCoverID,
    libreLibrary,
    projectID,
  } = props;
  const { clientConfig } = useClientConfig();
  if (!hasCoAuthoringTools(props) || !libreCoverID || !libreLibrary) return null;

  return (
    <SectionCard title="Co-Authoring Tools" className={className} bodyClassName="p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ProjectToolTile
          icon={<IconArrowsShuffle size={18} />}
          label="OER Remixer v3"
          badge={<Badge label="New" variant="primary" size="sm" />}
          external
          href={`/projects/${projectID}/remixer`}
        />
        <ProjectToolTile
          icon={<IconArrowsShuffle size={18} />}
          label={
            <>
              OER Remixer{" "}
              <Text size="sm" weight="normal" color="muted">
                (Legacy)
              </Text>
            </>
          }
          muted
          external
          href={buildRemixerURL(libreLibrary, buildLibraryPageGoURL(libreLibrary, libreCoverID))}
        />
        <ProjectToolTile
          icon={<IconAccessible size={18} />}
          label="Accessibility Remediation"
          external
          href={`/projects/${projectID}/accessibility-remediation`}
        />
        <ProjectToolTile
          icon={<IconTag size={18} />}
          label="Metadata Editor"
          external
          href={`/projects/${projectID}/metadata-editor`}
        />
        <ProjectToolTile
          icon={<IconVocabulary size={18} />}
          label="Glossary Manager"
          external
          href={`/glossary/project/${projectID}`}
        />
        <ProjectToolTile
          icon={<IconStack2 size={18} />}
          label="License Restacker"
          external
          href={`/projects/${projectID}/restacker`}
        />
        {hasCommonsBook && (
          <ProjectToolTile
            icon={<IconBooks size={18} />}
            label="Manage Reader Resources"
            onClick={handleOpenReaderResourcesModal}
          />
        )}
        {clientConfig?.reference_manager_enabled && (
          <ProjectToolTile
            icon={<IconQuote size={18} />}
            label="Reference Manager"
            external
            href={`/projects/${projectID}/references`}
          />
        )}
      </div>
    </SectionCard>
  );
};

export default ProjectCoAuthoringToolsButtons;
