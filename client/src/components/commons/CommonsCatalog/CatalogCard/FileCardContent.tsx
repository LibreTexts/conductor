import { Card, CardContentProps, Image } from "semantic-ui-react";
import { ProjectFile } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";

interface FileCardContentProps extends CardContentProps {
  file: ProjectFile;
}

const FileCardContent: React.FC<FileCardContentProps> = ({ file, ...rest }) => {
  return (
    <Card.Content className="commons-content-card-inner-content">
      <Card.Header as="h3" className="commons-content-card-header">
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>{file.author ? file.author.name : "Unknown"}</Card.Meta>
      <Card.Meta>{file.author ? file.author.name : "Unknown"}</Card.Meta>
      <Card.Description>
        <p className="commons-content-card-author">
          {truncateString(file.description, 50)}
        </p>
      </Card.Description>
    </Card.Content>
  );
};

export default FileCardContent;
