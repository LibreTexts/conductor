import { useHistory } from "react-router-dom";
import { Card } from "@libretexts/davis-react";
import {
  Book,
  Author,
  ConductorSearchResponseFile,
  Project,
} from "../../../../types";
import { isAuthor, isBook, isProject } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";
import "../../Commons.css";
import ProjectCardContent from "./ProjectCardContent";
import AuthorCardContent from "./AuthorCardContent";

interface CatalogCardProps {
  item: Book | ConductorSearchResponseFile | Project | Author;
  onDetailClick?: () => void;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, onDetailClick }) => {
  const history = useHistory();

  if (isAuthor(item)) {
    return (
      <Card
        padding="none"
        className="commons-author-card shadow-md transform transition-transform duration-300 hover:-translate-y-1"
      >
        <AuthorCardContent author={item} />
      </Card>
    );
  }

  if (isBook(item)) {
    return (
      <Card
        padding="none"
        className="commons-content-card"
        onClick={() => history.push(`/book/${item.bookID}`)}
      >
        <BookCardContent book={item} />
      </Card>
    );
  }

  if (isProject(item)) {
    return (
      <Card
        padding="none"
        className="commons-project-card shadow-md transform transition-transform duration-300 hover:-translate-y-1"
        onClick={() => history.push(`/commons-project/${item.projectID}`)}
      >
        <ProjectCardContent project={item} />
      </Card>
    );
  }

  return (
    <Card
      padding="none"
      className="commons-asset-card shadow-md transform transition-transform duration-300 hover:-translate-y-1 relative"
    >
      <FileCardContent file={item} onDetailClick={onDetailClick} />
    </Card>
  );
};

export default CatalogCard;
