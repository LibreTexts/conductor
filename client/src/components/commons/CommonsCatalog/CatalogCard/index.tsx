import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import { Book, Project, ProjectFileWProjectData } from "../../../../types";
import { isBook, isProject } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";
import "../../Commons.css";
import ProjectCardContent from "./ProjectCardContent";

interface CatalogCardProps extends CardProps {
  item: Book | ProjectFileWProjectData<"title" | "thumbnail"> | Project;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, ...props }) => {
  if (isBook(item)) {
    return (
      <Card
        as={Link}
        to={`/book/${item.bookID}`}
        className="commons-content-card"
        {...props}
      >
        <BookCardContent book={item} />
      </Card>
    );
  }

  if (isProject(item)) {
    return (
      <Card
        as={Link}
        to={`/projects/${item.projectID}`}
        className="commons-content-card"
        {...props}
      >
        <ProjectCardContent project={item} />
      </Card>
    );
  }

  return (
    <Card className="commons-asset-card hover:shadow-lg" {...props}>
      <FileCardContent file={item} />
    </Card>
  );
};

export default CatalogCard;
