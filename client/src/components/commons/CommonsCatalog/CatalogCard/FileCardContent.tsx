import { Card, CardContentProps, Icon, Popup } from "semantic-ui-react";
import { ProjectFileWProjectData } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";
import {
  downloadFile,
  getFileTypeIcon,
  getPrettyAuthorsList,
} from "../../../../utils/assetHelpers";
import { useState } from "react";

interface FileCardContentProps extends CardContentProps {
  file: ProjectFileWProjectData<
    "title" | "thumbnail" | "description" | "projectURL"
  >;
}

const FileCardContent: React.FC<FileCardContentProps> = ({ file, ...rest }) => {
  const [loading, setLoading] = useState(false);

  const prettyAuthors = getPrettyAuthorsList(file.primaryAuthor, file.authors);

  const prettyContactPerson = file.correspondingAuthor
    ? `${file.correspondingAuthor.firstName} ${file.correspondingAuthor.lastName}`
    : `Unknown`;

  const allAuthors =
    [file.primaryAuthor, ...(file.authors ?? [])]
      .filter((a) => a && !!a.firstName && !!a.lastName)
      .map((a) => `${a?.firstName} ${a?.lastName}`)
      .join(", ") || "Unknown";

  async function handleFileDownload(
    file: ProjectFileWProjectData<"title" | "thumbnail">
  ) {
    let success = false;
    try {
      setLoading(true);
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
        //handleGlobalError("Unable to download file. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card.Content className="commons-content-card-inner-content" {...rest}>
      {file.projectInfo.thumbnail ? (
        <div
          className="commons-card-img-container"
          style={{
            backgroundImage: `url(${file.projectInfo.thumbnail})`,
          }}
        >
          {/* <div className="app-item-icon-overlay">
            <Icon name={getFileTypeIcon(file)} size="big" color="black" />
          </div> */}
        </div>
      ) : (
        <div className="commons-asset-card-img-wrapper flex justify-center items-center">
          <Icon name={getFileTypeIcon(file)} size="massive" color="black" />
        </div>
      )}
      <Card.Header
        as="button"
        className="commons-content-card-header !mt-1 !mb-1 text-left hover:underline cursor-pointer hover:!text-blue-500 break-all"
        onClick={() => handleFileDownload(file)}
      >
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>
        <Popup
          disabled={!prettyAuthors || prettyAuthors === "Unknown"} // Disable popup if no authors
          trigger={
            <div>
              <Icon name="user" color="blue" /> {prettyAuthors}
            </div>
          }
          content={
            <div>
              <p>{allAuthors}</p>
            </div>
          }
          position="top center"
        />
      </Card.Meta>
      <Card.Meta>
        <Popup
          disabled={!prettyContactPerson || prettyContactPerson === "Unknown"} // Disable popup if no authors
          trigger={
            <div>
              <Icon name="phone" color="blue" />
              {file.correspondingAuthor?.email ? (
                <a href={`mailto:${file.correspondingAuthor?.email}`}>
                  {prettyContactPerson}
                </a>
              ) : (
                <span>{prettyContactPerson}</span>
              )}
            </div>
          }
          content={
            <div>
              <p>
                <span className="font-semibold">Contact Person:</span>{" "}
                {prettyContactPerson}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Email:</span>{" "}
                {file.correspondingAuthor?.email
                  ? file.correspondingAuthor?.email
                  : "Unknown"}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Org:</span>{" "}
                {file.correspondingAuthor?.primaryInstitution
                  ? file.correspondingAuthor?.primaryInstitution
                  : "Unknown"}
              </p>
            </div>
          }
          position="top center"
        />
      </Card.Meta>
      <Card.Meta>
        <Popup
          trigger={
            <div>
              <Icon name="clipboard list" color="blue" />
              {file.projectInfo.title ? (
                <a
                  href={
                    file.projectInfo.projectURL
                      ? file.projectInfo.projectURL
                      : `/commons-project/${file.projectID}`
                  }
                  target="_blank"
                >
                  {truncateString(file.projectInfo.title, 30)}
                </a>
              ) : (
                "Unknown Project"
              )}
            </div>
          }
          content={
            <div>
              <p>
                <span className="font-semibold">Project Description:</span>{" "}
                {file.projectInfo.description}
              </p>
            </div>
          }
          position="top center"
        />
      </Card.Meta>
      <Card.Meta>
        <Icon name="legal" color="blue" />{" "}
        {file.license?.name ? file.license.name : "Unknown License"}{" "}
        {file.license?.version ? `${file.license.version}` : ""}
      </Card.Meta>
      {!file.isURL && file.storageType === "file" && (
        <Card.Meta>
          <Icon name={getFileTypeIcon(file)} color="blue" />{" "}
          {truncateString(file.mimeType ?? "", 30)}
        </Card.Meta>
      )}
      <Card.Description className="overflow-hidden !mt-1">
        <p className="commons-content-card-author !mb-0">
          {file.description
            ? truncateString(file.description, 50)
            : "No description provided"}
        </p>
        <div className="max-h-14 overflow-hidden mt-1">
          <RenderAssetTags
            file={file}
            max={4}
            showNoTagsMessage={false}
            size="small"
            basic={true}
            spreadArray
          />
        </div>
        <div className="absolute bottom-0 right-0 pb-3 pr-2">
          {loading && <Icon loading name="spinner" size="large" />}
        </div>
      </Card.Description>
    </Card.Content>
  );
};

export default FileCardContent;
