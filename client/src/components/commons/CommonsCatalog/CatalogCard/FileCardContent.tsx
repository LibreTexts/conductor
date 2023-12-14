import { Card, CardContentProps, Icon, SemanticICONS } from "semantic-ui-react";
import { ProjectFile } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";

interface FileCardContentProps extends CardContentProps {
  file: ProjectFile;
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
      <div className="flex justify-center my-2">
        <Icon name={getFileTypeIcon(file)} size="huge" color="black" />
      </div>
      <Card.Header as="h3" className="commons-content-card-header !mt-4">
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>
        <Icon name="user" color="blue" />{" "}
        {file.author ? file.author.name : "Unknown Author"}
      </Card.Meta>
      <Card.Meta>
        <Icon name="legal" color="blue" />{" "}
        {file.license?.name ? file.license.name : "Unknown License"}{" "}
        {file.license?.version ? `(${file.license.version})` : ""}
      </Card.Meta>
      {!file.isURL && file.storageType === "file" && (
        <Card.Meta>
          <Icon name="file alternate outline" color="blue" /> {truncateString(file.mimeType ?? '', 30)}
        </Card.Meta>
      )}
      <Card.Description className="overflow-hidden">
        <p className="commons-content-card-author">
          {file.description
            ? truncateString(file.description, 75)
            : "No description provided"}
        </p>
        <div className="max-h-14 overflow-hidden">
          <RenderAssetTags
            file={file}
            max={3}
            showNoTagsMessage={false}
            size="small"
          />
        </div>
      </Card.Description>
    </Card.Content>
  );
};

export default FileCardContent;
