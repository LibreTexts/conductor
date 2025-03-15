import { Button, Header, Icon, Popup } from "semantic-ui-react";
import { normalizeURL } from "../util/HelperFunctions";
import {
  buildCommonsUrl,
  buildLibraryPageGoURL,
  buildRemixerURL,
} from "../../utils/projectHelpers";
import { lazy, useState } from "react";
const CreateWorkbenchModal = lazy(() => import("./CreateWorkbenchModal"));

interface ProjectLinkButtonsProps {
  libreLibrary?: string;
  libreCoverID?: string;
  projectLink?: string;
  didCreateWorkbench?: boolean;
  hasCommonsBook?: boolean;
  projectID?: string;
  projectTitle?: string;
  projectVisibility?: string;
  project: object;
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  libreLibrary,
  libreCoverID,
  projectLink,
  didCreateWorkbench,
  hasCommonsBook = false,
  projectID,
  projectTitle,
  projectVisibility,
  project
}) => {
  const [showCreateWorkbenchModal, setShowCreateWorkbenchModal] =
    useState(false);
  const validWorkbench = didCreateWorkbench && libreCoverID && libreLibrary;

  return (
    <div>
      <Header as="span" sub>
        Important Actions:{" "}
      </Header>
      <div className="flex flex-row flex-wrap gap-2">
        {!projectLink && !didCreateWorkbench && (
          <Button
            color="green"
            onClick={() => setShowCreateWorkbenchModal(true)}
          >
            <Icon name="plus" />
            Create Book
          </Button>
        )}
        {(projectLink || validWorkbench) && (
          <Popup
            content={
              validWorkbench
                ? "This link will take you to the book's page in the LibreTexts libraries."
                : projectLink
                ? "This link will take you to the project's linked URL. This may be a book in the LibreTexts library or a third-party resource."
                : "This project does not have a linked URL."
            }
            trigger={
              <Button
                onClick={() =>
                  validWorkbench
                    ? window.open(
                        buildLibraryPageGoURL(libreLibrary, libreCoverID),
                        "_blank"
                      )
                    : projectLink
                    ? window.open(normalizeURL(projectLink ?? ""), "_blank")
                    : ""
                }
                color="blue"
                size="small"
              >
                Open Project Link
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {hasCommonsBook && libreCoverID && libreLibrary && (
          <Popup
            content="This link will take you to the book's page on the Commons."
            trigger={
              <Button
                onClick={() =>
                  window.open(
                    buildCommonsUrl(libreLibrary, libreCoverID),
                    "_blank"
                  )
                }
                color="blue"
                size="small"
              >
                View Textbook on Commons
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {projectVisibility === "public" && (
          <Popup
            content="This link will take you to the project's page on the Commons."
            trigger={
              <Button
                onClick={() =>
                  window.open(`/commons-project/${projectID}`, "_blank")
                }
                color="blue"
                size="small"
              >
                View Project on Commons
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {(validWorkbench || hasCommonsBook) && libreCoverID && libreLibrary && (
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
                        : ""
                    ),
                    "_blank"
                  )
                }
                color="blue"
                size="small"
              >
                Open OER Remixer
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {projectID && projectTitle && (
          <CreateWorkbenchModal
            show={showCreateWorkbenchModal}
            projectID={projectID}
            projectTitle={projectTitle}
            onClose={() => setShowCreateWorkbenchModal(false)}
            onSuccess={() => window.location.reload()}
          />
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
