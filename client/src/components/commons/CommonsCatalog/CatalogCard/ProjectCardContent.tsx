import { Card, CardContentProps, Icon, Image } from "semantic-ui-react";
import { Project, ProjectFile } from "../../../../types";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";

interface ProjectCardContentProps extends CardContentProps {
  project: Project;
}

const ProjectCardContent: React.FC<ProjectCardContentProps> = ({
  project,
  ...rest
}) => {
  return (
    <Card.Content className="commons-content-card-inner-content" {...rest}>
      {project.thumbnail ? (
        <div
          className="commons-card-img-container"
          style={{ backgroundImage: `url(${project.thumbnail})` }}
        ></div>
      ) : (
        <div className="flex justify-center">
          <Icon name="clipboard list" size="massive" color="black" />
        </div>
      )}
      <Card.Header as="h3" className="commons-content-card-header !mt-4">
        {truncateString(project.title, 50)}
      </Card.Header>
      <Card.Meta>
        <Icon name="user" color="blue" className="!mr-2" />
        {project?.principalInvestigators &&
        project?.principalInvestigators.length > 0 ? (
          project?.principalInvestigators
            ?.map((p) => `${p.firstName} ${p.lastName}`)
            .join(", ")
        ) : (
          <span className="muted-text">No principal investigators</span>
        )}
      </Card.Meta>
      <Card.Meta>
        <Icon name="user plus" color="blue" className="!mr-2" />
        {project?.coPrincipalInvestigators &&
        project?.coPrincipalInvestigators.length > 0 ? (
          project?.coPrincipalInvestigators
            ?.map((p) => `${p.firstName} ${p.lastName}`)
            .join(", ")
        ) : (
          <span className="muted-text">No co-principal investigators</span>
        )}
      </Card.Meta>
      <Card.Meta>
        <Icon name="university" color="blue" className="!mr-2" />
        {project?.associatedOrgs && project?.associatedOrgs.length > 0 ? (
          project?.associatedOrgs.join(", ")
        ) : (
          <span className="muted-text">No associated organizations</span>
        )}
      </Card.Meta>
      <Card.Meta>
        <Icon name="linkify" color="blue" />{" "}
        {project.projectURL ? (
          <a
            href={project.projectURL}
            target="_blank"
            rel="noopener noreferrer"
            className="!text-blue-500 break-all"
          >
            {truncateString(project.projectURL, 50)}
          </a>
        ) : (
          "No URL Specified"
        )}
      </Card.Meta>
      <Card.Meta>
        <Icon name="area graph" color="blue" />{" "}
        {project.contentArea
          ? capitalizeFirstLetter(project.contentArea)
          : "No Content Area Specified"}
      </Card.Meta>
      <Card.Meta>
        <Icon name="dashboard" color="blue" />{" "}
        {project.status
          ? capitalizeFirstLetter(project.status)
          : "Unknown Status"}
      </Card.Meta>
      <Card.Meta>
        <Icon name="clipboard list" color="blue" />{" "}
        {project.classification
          ? capitalizeFirstLetter(project.classification)
          : "Unknown Classification"}
      </Card.Meta>
      <Card.Meta>
        <Card.Meta>
          <Image
            src={getLibGlyphURL(project.libreLibrary)}
            className="library-glyph"
          />
          {getLibraryName(project.libreLibrary)}
        </Card.Meta>
      </Card.Meta>
      <Card.Description>
        <p className="commons-content-card-author"></p>
      </Card.Description>
    </Card.Content>
  );
};

export default ProjectCardContent;
