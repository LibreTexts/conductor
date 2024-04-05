import { Card, CardContentProps, Icon } from "semantic-ui-react";
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
  file: ProjectFileWProjectData<"title" | "thumbnail">;
}

function handleOpenProject(projectID: string) {
  window.open(`/projects/${projectID}`, "_blank");
}

const FileCardContent: React.FC<FileCardContentProps> = ({ file, ...rest }) => {
  const [loading, setLoading] = useState(false);

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
        className="commons-content-card-header !mt-1 !mb-1 text-left hover:underline cursor-pointer hover:!text-blue-500"
        onClick={() => handleFileDownload(file)}
      >
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>
        <Icon name="user" color="blue" />{" "}
        {getPrettyAuthorsList(file.primaryAuthor, file.authors)}
      </Card.Meta>
      <Card.Meta>
        <Icon name="clipboard list" color="blue" />
        {file.projectInfo.title ? (
          <span
            onClick={() => handleOpenProject(file.projectID)}
            className="underline"
          >
            {truncateString(file.projectInfo.title, 30)}
          </span>
        ) : (
          "Unknown Project"
        )}
      </Card.Meta>
      <Card.Meta>
        <Icon name="legal" color="blue" />{" "}
        {file.license?.name ? file.license.name : "Unknown License"}{" "}
        {file.license?.version ? `(${file.license.version})` : ""}
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
