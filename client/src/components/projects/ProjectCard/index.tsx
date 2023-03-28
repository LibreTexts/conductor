import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Card, Popup, Icon, Button } from "semantic-ui-react";
import { format, parseISO } from "date-fns";
import { truncateString } from "../../util/HelperFunctions";
import ProjectProgressBar from "../ProjectProgressBar";
import "./ProjectCard.css";
import { Project } from "../../../types";

type ProjectCardProps = {
  project: Project;
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
    <Card raised {...props}>
      <div className="flex-col-div project-card-content">
        <div className="flex-row-div">
          <div className="flex-col-div project-card-title-column">
            <Link
              className="project-card-title"
              to={`/projects/${project.projectID}`}
            >
              {truncateString(project.title, 100)}
            </Link>
            <span className="muted-text project-card-lastupdate">
              Last updated {updateDate} at {updateTime}
            </span>
          </div>
          <div className="flex-col-div">
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
        <div className="flex-row-div">
          <div className="project-card-progress-container">
            <ProjectProgressBar
              progress={project.currentProgress || 0}
              type="progress"
              showPercent={false}
            />
          </div>
          <div className="project-card-progress-container">
            <ProjectProgressBar
              progress={project.peerProgress || 0}
              type="peer"
              showPercent={false}
            />
          </div>
          <div className="project-card-progress-container">
            <ProjectProgressBar
              progress={project.a11yProgress || 0}
              type="a11y"
              showPercent={false}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProjectCard;
