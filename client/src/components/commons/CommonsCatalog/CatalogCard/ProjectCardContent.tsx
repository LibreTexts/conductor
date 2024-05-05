import { Card, CardContentProps, Icon, Image } from "semantic-ui-react";
import { Project } from "../../../../types";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";
import { useTypedSelector } from "../../../../state/hooks";
import { useMemo } from "react";
import CardMetaWIcon from "../../../util/CardMetaWIcon";

interface ProjectCardContentProps extends CardContentProps {
  project: Project;
}

const ProjectCardContent: React.FC<ProjectCardContentProps> = ({
  project,
  ...rest
}) => {
  const org = useTypedSelector((state) => state.org);

  const libGlyphImage = useMemo(() => {
    return (
      <Image
        src={getLibGlyphURL(project.libreLibrary)}
        className="library-glyph"
      />
    );
  }, [project.libreLibrary]);

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
      <p className="text-black">
        <strong>Description: </strong>
        {project?.description
          ? truncateString(project.description, 200)
          : "No description available."}
      </p>
      <CardMetaWIcon icon="user">
        {project?.principalInvestigators &&
        project?.principalInvestigators.length > 0 ? (
          project?.principalInvestigators
            ?.map((p) => `${p.firstName} ${p.lastName}`)
            .join(", ")
        ) : (
          "No principal investigators"
        )}
      </CardMetaWIcon>
      <CardMetaWIcon icon="user plus">
        {project?.coPrincipalInvestigators &&
        project?.coPrincipalInvestigators.length > 0 ? (
          project?.coPrincipalInvestigators
            ?.map((p) => `${p.firstName} ${p.lastName}`)
            .join(", ")
        ) : (
          "No co-principal investigators"
        )}
      </CardMetaWIcon>
      <CardMetaWIcon icon="university">
        {project?.associatedOrgs && project?.associatedOrgs.length > 0 ? (
          project?.associatedOrgs.join(", ")
        ) : (
          "No associated organizations"
        )}
      </CardMetaWIcon>
      <CardMetaWIcon icon="linkify">
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
      </CardMetaWIcon>
      {project.contentArea && org.orgID == "calearninglab" && (
        <CardMetaWIcon icon="content">
          {capitalizeFirstLetter(project.contentArea)}
        </CardMetaWIcon>
      )}
      {org.orgID !== "calearninglab" && (
        <>
          <CardMetaWIcon icon="dashboard">
            {project.status
              ? capitalizeFirstLetter(project.status)
              : "Unknown Status"}
          </CardMetaWIcon>
          <CardMetaWIcon icon="clipboard list">
            {project.classification
              ? capitalizeFirstLetter(project.classification)
              : "Unknown Classification"}
          </CardMetaWIcon>
          <Card.Meta>
            {libGlyphImage}
            {getLibraryName(project.libreLibrary)}
          </Card.Meta>
        </>
      )}
    </Card.Content>
  );
};

export default ProjectCardContent;
