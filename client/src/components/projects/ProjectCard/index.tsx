import { Link } from "react-router-dom";
import { Button, Card, Tooltip } from "@libretexts/davis-react";
import { format, parseISO } from "date-fns";
import { truncateString } from "../../util/HelperFunctions";
import { Project } from "../../../types";
import { IconPin } from "@tabler/icons-react";

type ProjectCardProps = {
  project: Pick<Project, "projectID" | "title" | "updatedAt">;
  showPinButton?: boolean;
  onPin?: (projectID: string) => void;
};

const ProjectCard = ({
  project,
  showPinButton = false,
  onPin = () => {},
}: ProjectCardProps) => {
  let updateDate;
  let updateTime;

  if (project.updatedAt) {
    const parsedDate = parseISO(project.updatedAt);
    updateDate = format(parsedDate, "MM/dd/yy");
    updateTime = format(parsedDate, "h:mm aa");
  }

  const handlePinClick = () => {
    if (typeof onPin === "function") {
      onPin(project.projectID);
    }
  };

  return (
    <Card variant="elevated" padding="sm" className="w-full max-h-[130px] !overflow-visible">
      <Card.Body className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Link
            className="text-lg font-semibold opacity-85 text-black hover:underline"
            to={`/projects/${project.projectID}`}
          >
            {truncateString(project.title, 75)}
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            Last updated {updateDate} at {updateTime}
          </p>
        </div>
        {showPinButton && (
          <Tooltip content="Add to your Pinned Projects" placement="top">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePinClick}
              icon={<IconPin size={16} />}
            />
          </Tooltip>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProjectCard;
