import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import {
  Author,
  Book,
  Project,
  ProjectFileWProjectData,
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
    | ProjectFileWProjectData<"title" | "thumbnail">
    | Project
    | Author;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, ...props }) => {
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
        className="commons-content-card"
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
      <FileCardContent file={item} />
    </Card>
  );
};

export default CatalogCard;
