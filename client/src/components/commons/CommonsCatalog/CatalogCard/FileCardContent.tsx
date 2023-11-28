import { Card, CardContentProps, Icon, Image } from "semantic-ui-react";
import { ProjectFile } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";

interface FileCardContentProps extends CardContentProps {
  file: ProjectFile;
}

const FileCardContent: React.FC<FileCardContentProps> = ({ file, ...rest }) => {
  return (
    <Card.Content className="commons-content-card-inner-content">
      <div className="flex justify-center">
        <Icon name="file alternate outline" size="massive" color="black" />
      </div>
      <Card.Header as="h3" className="commons-content-card-header !mt-4">
        {truncateString(file.name, 50)}
      </Card.Header>
      <Card.Meta>
        <Icon name="user" color="blue" />{" "}
        {file.author ? file.author.name : "Unknown Author"}</Card.Meta>
      <Card.Meta>
        <Icon name="legal" color="blue" />{" "}
        {file.license ? file.license.name : "Unknown License"}</Card.Meta>
      <Card.Description>
        <p className="commons-content-card-author">
          {truncateString(file.description, 100) ? truncateString(file.description, 100) : "No description provided"}
        </p>
      </Card.Description>
    </Card.Content>
  );
};

export default FileCardContent;
