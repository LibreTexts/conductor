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

  const buildAssetString = () => {
    let assetString = "";
    if (project?.publicAssets) {
      assetString += `${project?.publicAssets} public asset${
        project?.publicAssets > 1 ? "s" : ""
      }`;
    }
    if (project?.instructorAssets) {
      assetString += `${project?.publicAssets ? ", " : ""}${
        project?.instructorAssets
      } instructor asset${project?.instructorAssets > 1 ? "s" : ""}`;
    }
    return assetString;
  };

  const assetString = buildAssetString();

  return (
    <Card.Content className="commons-content-card-inner-content" {...rest}>
      {project.thumbnail ? (
        <div
          className="commons-card-img-container"
          style={{ backgroundImage: `url(${project.thumbnail})` }}
        ></div>
      ) : (
        <div className="flex justify-center h-[35%] items-center">
          <Icon name="clipboard list" size="massive" color="black" />
        </div>
      )}
      <Card.Header as="h3" className="commons-content-card-header !mt-4">
        <div className="line-clamp-2">{project.title}</div>
      </Card.Header>
      {project?.description && (
        <div className="line-clamp-5 mb-1">
          <p className="text-black">
            <strong>Description: </strong>
            {project?.description
              ? project.description
              : "No description available."}
          </p>
        </div>
      )}
      {project.projectURL && (
        <CardMetaWIcon icon="linkify">
          <div className="line-clamp-2">
            {project.projectURL ? (
              <a
                href={project.projectURL}
                target="_blank"
                rel="noopener noreferrer"
                className="!text-blue-500 break-all"
              >
                {project.projectURL}
              </a>
            ) : (
              "No URL Specified"
            )}
          </div>
        </CardMetaWIcon>
      )}
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
          {project?.classification !== "minirepo" && (
            <Card.Meta>
              <Image
                src={getLibGlyphURL(project.libreLibrary)}
                className="library-glyph"
              />
              {getLibraryName(project.libreLibrary)}
            </Card.Meta>
          )}
        </>
      )}
      {assetString ? (
        <p className="commons-content-card-affiliation !mt-3">
          <Icon name="file alternate outline" />
          {assetString}
        </p>
      ) : null}
    </Card.Content>
  );
};

export default ProjectCardContent;
