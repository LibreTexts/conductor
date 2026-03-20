import { Icon } from "semantic-ui-react";
import { Project } from "../../../../types";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";
import { useTypedSelector } from "../../../../state/hooks";
import CardMetaWIcon from "../../../util/CardMetaWIcon";

interface ProjectCardContentProps {
  project: Project;
}

const ProjectCardContent: React.FC<ProjectCardContentProps> = ({ project }) => {
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
    <div className="h-full overflow-hidden">
      {project.thumbnail ? (
        <div
          className="commons-card-img-container"
          style={{ backgroundImage: `url(${project.thumbnail})` }}
        />
      ) : (
        <div className="flex justify-center h-[35%] items-center">
          <Icon name="clipboard list" size="massive" color="black" />
        </div>
      )}
      <div className="px-4 pt-3 pb-2">
        <h3 className="commons-content-card-header">
          <div className="line-clamp-2">{project.title}</div>
        </h3>
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
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <img
                  src={getLibGlyphURL(project.libreLibrary)}
                  className="library-glyph"
                  alt=""
                />
                {getLibraryName(project.libreLibrary)}
              </div>
            )}
          </>
        )}
        {assetString ? (
          <p className="commons-content-card-affiliation !mt-3">
            <Icon name="file alternate outline" />
            {assetString}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ProjectCardContent;
