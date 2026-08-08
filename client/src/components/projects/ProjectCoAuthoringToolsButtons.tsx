import { Button, Header, Icon, Popup } from "semantic-ui-react";
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
      <Header as="span" sub>
        Co-Authoring Tools:{" "}
      </Header>
      <div className="flex flex-row flex-wrap gap-2 mt-2">
        {(validBook || hasCommonsBook) &&
          libreCoverID &&
          libreLibrary && (<>
              <Popup
                content="This link will open the book in the LibreTexts OER Remixer."
                trigger={
                  <Button
                    onClick={() =>
                      window.open(
                        buildRemixerURL(
                          libreLibrary ?? "chem",
                          libreLibrary && libreCoverID
                            ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                            : "",
                        ),
                        "_blank",
                      )
                    }
                    color="blue"
                    size="small"
                  >
                    Open OER Remixer (Legacy)
                    <Icon name="external alternate" className="!ml-2" />
                  </Button>
                }
              />
              <Popup
                content="This link will open the book in the LibreTexts OER Remixer v3."
                trigger={
                  <Button
                    onClick={() => window.open(`/projects/${projectID}/remixer`, "_blank")}
                    color="blue"
                    size="small"
                  >
                    Open OER Remixer v3 (New)
                    <Icon name="external alternate" className="!ml-2" />
                  </Button>
                }
              />
              <Button
                onClick={() =>
                  window.open(`/projects/${projectID}/restacker`, "_blank")
                }
                color="blue"
                size="small"
              >
                License Restacker
                <Icon name="external alternate" className="!ml-2" />
              </Button>
              <Button
                onClick={() =>
                  window.open(`/glossary/project/${projectID}`, "_blank")
                }
                color="blue"
                size="small"
              >
                Glossary Manager
                <Icon name="external alternate" className="!ml-2" />
              </Button>
              <Button
                onClick={handleOpenReaderResourcesModal}
                color="blue"
                size="small"
              >
                Manage Reader Resources
              </Button>
            </>
          )}
      </div>
    </div>
  );
};

export default ProjectCoAuthoringToolsButtons;
