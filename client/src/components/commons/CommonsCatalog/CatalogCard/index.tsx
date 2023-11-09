import { Link } from "react-router-dom";
import { Card, CardProps } from "semantic-ui-react";
import { Book, ProjectFile } from "../../../../types";
import { isBook, isProjectFile } from "../../../../utils/typeHelpers";
import BookCardContent from "./BookCardContent";
import FileCardContent from "./FileCardContent";

interface CatalogCardProps extends CardProps {
  item: Book | ProjectFile;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ item, ...props }) => {
  const getItemURL = (item: Book | ProjectFile) => {
    if (isBook(item)) {
      return `/book/${item.bookID}`;
    }
    if (isProjectFile(item)) {
      return `/file/${item.fileID}`;
    }
    return "";
  };

  return (
    <Card
      as={Link}
      to={getItemURL(item)}
      className="commons-content-card"
      {...props}
    >
      {isBook(item) ? (
        <BookCardContent book={item} />
      ) : (
        <FileCardContent file={item} />
      )}
    </Card>
  );
};

export default CatalogCard;
