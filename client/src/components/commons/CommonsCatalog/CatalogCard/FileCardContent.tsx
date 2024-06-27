import { Card, CardContentProps, Icon, Popup } from "semantic-ui-react";
import { ConductorSearchResponseFile } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";
import {
  downloadFile,
  getFileTypeIcon,
  getPrettyAuthorsList,
} from "../../../../utils/assetHelpers";
import { useState } from "react";
import CardMetaWIcon from "../../../util/CardMetaWIcon";

interface FileCardContentProps extends CardContentProps {
  file: ConductorSearchResponseFile;
  onDetailClick?: () => void;
}

const FileCardContent: React.FC<FileCardContentProps> = ({
  file,
  onDetailClick,
  ...rest
}) => {
  const [loading, setLoading] = useState(false);

  const prettyAuthors = getPrettyAuthorsList(file.primaryAuthor, file.authors);

  const allAuthors =
    [file.primaryAuthor, ...(file.authors ?? [])]
      .filter((a) => a && !!a.firstName && !!a.lastName)
      .map((a) => `${a?.firstName} ${a?.lastName}`)
      .join(", ") || "Unknown";

  async function handleFileDownload(file: ConductorSearchResponseFile) {
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
          onClick={() => window.open(`/commons-project/${file.projectID}`)}
          className="commons-card-img-container !bg-contain !cursor-pointer"
          style={{
            backgroundImage: `url(${file.projectInfo.thumbnail})`,
          }}
        ></div>
      ) : (
        <div className="commons-asset-card-img-wrapper flex justify-center items-center">
          <Icon name={getFileTypeIcon(file)} size="massive" color="black" />
        </div>
      )}
      <Card.Header
        as="button"
        className="commons-content-card-header !my-2 text-left hover:underline cursor-pointer !text-blue-500 break-words hyphens-auto"
        onClick={() => onDetailClick && onDetailClick()}
      >
        <div className="line-clamp-2">{file.name}</div>
      </Card.Header>
      <Card.Description className="overflow-hidden !my-1">
        <div className="line-clamp-3">
          <p className="commons-content-card-author !mb-0">
            {file.description ? file.description : "No description provided"}
          </p>
        </div>
      </Card.Description>
      <CardMetaWIcon icon="user">
        <Popup
          disabled={!prettyAuthors || prettyAuthors === "Unknown"} // Disable popup if no authors
          trigger={<div>{truncateString(prettyAuthors, 50)}</div>}
          content={
            <div className="line-clamp-2">
              <p>{allAuthors}</p>
            </div>
          }
          position="top center"
        />
      </CardMetaWIcon>
      {/* <CardMetaWIcon icon="phone">
        <Popup
          disabled={!prettyContactPerson || prettyContactPerson === "Unknown"} // Disable popup if no authors
          trigger={
            <div>
              {file.correspondingAuthor?.email ? (
                <a href={`/author/${file.correspondingAuthor._id}`}>
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
      </CardMetaWIcon> */}
      {/* <CardMetaWIcon icon="clipboard list">
        <Popup
          trigger={
            <div className="line-clamp-1">
              {file.projectInfo.title ? (
                <a href={`/commons-project/${file.projectID}`} target="_blank">
                  {file.projectInfo.title}
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
      </CardMetaWIcon> */}
      {/* <CardMetaWIcon icon="legal">
        {file.license?.name ? file.license.name : "Unknown License"}{" "}
        {file.license?.version ? `${file.license.version}` : ""}
      </CardMetaWIcon> */}
      {!file.isURL && file.storageType === "file" && (
        <CardMetaWIcon icon={getFileTypeIcon(file)}>
          <div className="line-clamp-1">{file.mimeType ?? ""}</div>
        </CardMetaWIcon>
      )}
      {/* <div className="max-h-20 overflow-hidden mt-1">
        <RenderAssetTags
          file={file}
          max={4}
          showNoTagsMessage={false}
          size="small"
          basic={true}
          spreadArray
        />
      </div> */}
      <div className="w-full absolute bottom-4 left-0 text-center">
        <a
          className="text-lg font-semibold text-blue-500 text-center"
          onClick={() => onDetailClick && onDetailClick()}
        >
          DETAILS
        </a>
      </div>
      <div className="absolute bottom-0 right-0 pb-3 pr-2">
        {loading && <Icon loading name="spinner" size="large" />}
      </div>
    </Card.Content>
  );
};

export default FileCardContent;
