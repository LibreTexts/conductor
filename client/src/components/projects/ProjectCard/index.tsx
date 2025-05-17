import { Link } from "react-router-dom";
import { Card, Popup, Icon, Button } from "semantic-ui-react";
import { format, parseISO } from "date-fns";
import { truncateString } from "../../util/HelperFunctions";
import { Project } from "../../../types";

type ProjectCardProps = {
  project: Pick<Project, "projectID" | "title" | "updatedAt">;
  showPinButton?: boolean;
  onPin?: (projectID: string) => void;
};
/**
 * A UI component representing a Project and displaying its basic information and status.
 */
const ProjectCard = ({
  project,
  showPinButton = false,
  onPin = () => {},
  ...props
}: ProjectCardProps) => {
  let updateDate;
  let updateTime;

  if (project.updatedAt) {
    const parsedDate = parseISO(project.updatedAt);
    updateDate = format(parsedDate, "MM/dd/yy");
    updateTime = format(parsedDate, "h:mm aa");
  }

  /**
   * Activates the provided callback (if valid) when the user clicks the "Pin" button.
   */
  const handlePinClick = () => {
    if (typeof onPin === "function") {
      onPin(project.projectID);
    }
  };

  return (
    <Card raised {...props} className="!max-h-[130px]">
      <div className="flex flex-col flex-grow p-4">
        <div className="flex">
          <div className="flex flex-col flex-1">
            <Link
              className="text-lg font-semibold opacity-85 text-black"
              to={`/projects/${project.projectID}`}
            >
              {truncateString(project.title, 75)}
            </Link>
            <span className="muted-text text-sm my-1">
              Last updated {updateDate} at {updateTime}
            </span>
          </div>
          <div className="flex flex-col">
            {showPinButton && (
              <Popup
                content={<span>Add to your Pinned Projects</span>}
                trigger={
                  <Button
                    color="blue"
                    onClick={handlePinClick}
                    icon
                    circular
                    size="small"
                  >
                    <Icon name="pin" />
                  </Button>
                }
                position="top center"
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProjectCard;
