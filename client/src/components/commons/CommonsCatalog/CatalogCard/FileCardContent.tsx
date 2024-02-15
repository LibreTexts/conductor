import { Card, CardContentProps, Icon, SemanticICONS } from "semantic-ui-react";
import {
  ProjectFile, ProjectFileWCustomData, ProjectFileWProjectData
} from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";
import { getPrettyAuthorsList } from "../../../../utils/assetHelpers";

interface FileCardContentProps extends CardContentProps {
  file: ProjectFileWProjectData<'title' | 'thumbnail'>;
}

const getFileTypeIcon = (file: ProjectFile): SemanticICONS => {
  if (file.storageType === "folder") return "folder outline";
  if (file.isURL) return "linkify";

  if (file.name.split(".").length > 1) {
    const extension = file.name.split(".").pop() as string;
    if (extension.includes("xls")) {
      return "file excel outline";
    }
    if (extension.includes("doc")) {
      return "file word outline";
    }
    if (extension.includes("ppt")) {
      return "file powerpoint outline";
    }
    if (extension.includes("pdf")) {
      return "file pdf outline";
    }
    if (["png", "jpg", "jpeg", "gif", "svg"].includes(extension)) {
      return "file image outline";
    }
    if (["zip", "rar", "7z"].includes(extension)) {
      return "file archive outline";
    }
    if (["mp3", "wav", "ogg"].includes(extension)) {
      return "file audio outline";
    }
  }

  return "file alternate outline";
};

const FileCardContent: React.FC<FileCardContentProps> = ({ file, ...rest }) => {
  return (
    <Card.Content className="commons-content-card-inner-content" {...rest}>
      {file.projectInfo.thumbnail ? (
        <div
          className="commons-card-img-container"
          style={{
            backgroundImage: `url(${file.projectInfo.thumbnail})`,
          }}
        >
          <div className="app-item-icon-overlay">
            <Icon name={getFileTypeIcon(file)} size="big" color="black" />
          </div>
        </div>
      ) : (
        <div className="commons-asset-card-img-wrapper flex justify-center items-center">
          <Icon name={getFileTypeIcon(file)} size="massive" color="black" />
        </div>
      )}
      <Card.Header as="h3" className="commons-content-card-header !mt-1 !mb-1">
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>
        <Icon name="user" color="blue" />{" "}
        {getPrettyAuthorsList(file.authors)}
      </Card.Meta>
      <Card.Meta>
        <Icon name="clipboard list" color="blue" />
        {file.projectInfo.title
          ? <a href={`projects/${file.projectID}`} target="_blank" className="underline">{truncateString(file.projectInfo.title, 30)}</a>
          : "Unknown Project"}
      </Card.Meta>
      <Card.Meta>
        <Icon name="legal" color="blue" />{" "}
        {file.license?.name ? file.license.name : "Unknown License"}{" "}
        {file.license?.version ? `(${file.license.version})` : ""}
      </Card.Meta>
      {!file.isURL && file.storageType === "file" && (
        <Card.Meta>
          <Icon name="file alternate outline" color="blue" />{" "}
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
            max={3}
            showNoTagsMessage={false}
            size="small"
            basic={true}
          />
        </div>
      </Card.Description>
    </Card.Content>
  );
};

export default FileCardContent;
