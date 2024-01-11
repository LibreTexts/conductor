import { Button, Header, Icon, Popup } from "semantic-ui-react";
import { normalizeURL } from "../util/HelperFunctions";
import { buildCommonsUrl, buildWorkbenchURL } from "../../utils/projectHelpers";

interface ProjectLinkButtonsProps {
  libreLibrary?: string;
  libreCoverID?: string;
  projectLink?: string;
  didCreateWorkbench?: boolean;
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  libreLibrary,
  libreCoverID,
  projectLink,
  didCreateWorkbench,
}) => {
  const validWorkbench = didCreateWorkbench && libreCoverID && libreLibrary;
  return (
    <div>
      <Header as="span" sub>
        Important Links:{" "}
      </Header>
      <div className="flex flex-row mt-2">
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
                      buildWorkbenchURL(libreLibrary, libreCoverID),
                      "_blank"
                    )
                  : projectLink
                  ? window.open(normalizeURL(projectLink ?? ""), "_blank")
                  : ""
              }
              className={
                validWorkbench || projectLink
                  ? ""
                  : "!cursor-default opacity-45"
              }
              color={validWorkbench || projectLink ? "blue" : "grey"}
            >
              {validWorkbench ? "Textbook" : "Project/Textbook"} Link
              <Icon name="external alternate" className="!ml-2" />
            </Button>
          }
        />
        <Popup
          content={
            libreCoverID && libreLibrary
              ? "This link will take you to the book's page on the Commons."
              : "This project does not have a Commons page."
          }
          trigger={
            <Button
              onClick={
                libreCoverID && libreLibrary
                  ? () =>
                      window.open(
                        buildCommonsUrl(libreLibrary, libreCoverID),
                        "_blank"
                      )
                  : () => {}
              }
              className={
                libreCoverID && libreLibrary ? "" : "!cursor-default opacity-45"
              }
              color={libreCoverID && libreLibrary ? "blue" : "grey"}
            >
              Commons Page
              <Icon name="external alternate" className="!ml-2" />
            </Button>
          }
        />
      </div>
    </div>
  );
};

export default ProjectLinkButtons;
