import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import {
  Book,
  ConductorSearchResponseAuthor,
  ConductorSearchResponseFile,
  Project,
} from "../../../../types";
import { isAuthor, isBook, isProject } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";
import "../../Commons.css";
import ProjectCardContent from "./ProjectCardContent";
import AuthorCardContent from "./AuthorCardContent";

interface CatalogCardProps extends CardProps {
  item:
    | Book
    | ConductorSearchResponseFile
    | Project
    | ConductorSearchResponseAuthor;
  onDetailClick?: () => void;
}

const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  onDetailClick,
  ...props
}) => {
  if (isAuthor(item)) {
    return (
      <Card
        className="commons-author-card shadow-md transform transition-transform duration-300 hover:-translate-y-1"
        {...props}
      >
        <AuthorCardContent author={item} />
      </Card>
    );
  }

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
        to={`/commons-project/${item.projectID}`}
        className="commons-project-card shadow-md transform transition-transform duration-300 hover:-translate-y-1"
        {...props}
      >
        <ProjectCardContent project={item} />
      </Card>
    );
  }

  return (
    <Card
      className="commons-asset-card shadow-md transform transition-transform duration-300 hover:-translate-y-1"
      {...props}
    >
      <FileCardContent file={item} onDetailClick={onDetailClick} />
    </Card>
  );
};

export default CatalogCard;
