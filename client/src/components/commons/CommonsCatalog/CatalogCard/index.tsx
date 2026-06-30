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
  headingLevel?: 2 | 3;
}

// `relative` anchors the title's stretched-link overlay to the card, so the
// whole card stays clickable while the accessible control is a real heading
// link/button rather than a clickable container wrapping a heading (SC 1.3.1).
const CARD_CLASSNAME = "relative hover:border-secondary hover:border-2";

const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  onDetailClick,
  headingLevel = 2,
}) => {
  if (isAuthor(item)) {
    return (
      <Card variant="elevated" className={CARD_CLASSNAME}>
        <AuthorCardContent
          author={item}
          linkTo={`/author/${item._id}`}
          headingLevel={headingLevel}
        />
      </Card>
    );
  }

  if (isBook(item)) {
    return (
      <Card variant="elevated" className={CARD_CLASSNAME}>
        <BookCardContent
          book={item}
          linkTo={`/book/${item.bookID}`}
          headingLevel={headingLevel}
        />
      </Card>
    );
  }

  if (isProject(item)) {
    return (
      <Card variant="elevated" className={CARD_CLASSNAME}>
        <ProjectCardContent
          project={item}
          linkTo={`/commons-project/${item.projectID}`}
          headingLevel={headingLevel}
        />
      </Card>
    );
  }

  return (
    <Card variant="elevated" className={CARD_CLASSNAME}>
      <FileCardContent
        file={item}
        onDetailClick={onDetailClick}
        headingLevel={headingLevel}
      />
    </Card>
  );
};

export default CatalogCard;
