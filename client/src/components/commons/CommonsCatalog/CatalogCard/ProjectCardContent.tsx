import { Project } from "../../../../types";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";
import { useTypedSelector } from "../../../../state/hooks";
import CardMetaWIcon from "../../../util/CardMetaWIcon";
import { Card, Heading, Link, Stack } from "@libretexts/davis-react";
import { Icon } from "semantic-ui-react";

interface ProjectCardContentProps {
  project: Project;
}

const ProjectCardContent: React.FC<ProjectCardContentProps> = ({ project }) => {
  const org = useTypedSelector((state) => state.org);

  const buildAssetString = () => {
    let assetString = "";
    if (project?.publicAssets) {
      assetString += `${project?.publicAssets} public asset${project?.publicAssets > 1 ? "s" : ""
        }`;
    }
    if (project?.instructorAssets) {
      assetString += `${project?.publicAssets ? ", " : ""}${project?.instructorAssets
        } instructor asset${project?.instructorAssets > 1 ? "s" : ""}`;
    }
    return assetString;
  };

  const assetString = buildAssetString();

  return (
    <>
      <Card.Header
        className={!project.thumbnail ? "" : ""}
        image={{
          src: project.thumbnail || '/public/project_icon_2.svg',
          alt: "", // The thumbnails are purely decorative, so leave alt text as empty string to be ignored by screen readers
        }}
      />
      <Card.Body>
        <Stack direction="vertical" gap="sm">
          <Heading level={6} className="line-clamp-2">
            {project.title}
          </Heading>
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
                  <Link
                    href={project.projectURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all"
                    external
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncateString(project.projectURL, 35)}
                  </Link>
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
          {assetString ? (
            <p className="commons-content-card-affiliation !mt-3">
              <Icon name="file alternate outline" />
              {assetString}
            </p>
          ) : null}
        </Stack>
      </Card.Body>
    </>
  );
};

export default ProjectCardContent;
