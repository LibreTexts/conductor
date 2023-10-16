import { Link } from "react-router-dom";
import { Card, CardProps, Image } from "semantic-ui-react";
import { truncateString } from "../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../util/LibraryOptions";
import { Book } from "../../../types";

interface CatalogCardProps extends CardProps {
  book: Book;
}

const CatalogCard: React.FC<CatalogCardProps> = ({ book, ...props }) => {
  return (
    <Card
      as={Link}
      to={`/book/${book.bookID}`}
      className="commons-content-card"
      {...props}
    >
      <div className="commons-content-card-img-wrapper">
        <div
          className="commons-content-card-img"
          style={{ backgroundImage: `url(${book.thumbnail})` }}
        />
      </div>
      <Card.Content className="commons-content-card-inner-content">
        <Card.Header as="h3" className="commons-content-card-header">
          {truncateString(book.title, 50)}
        </Card.Header>
        <Card.Meta>
          <Image src={getLibGlyphURL(book.library)} className="library-glyph" />
          {getLibraryName(book.library)}
        </Card.Meta>
        <Card.Description>
          <p className="commons-content-card-author">
            {truncateString(book.author, 50)}
          </p>
          <p className="commons-content-card-affiliation">
            <em>{truncateString(book.affiliation, 30)}</em>
          </p>
        </Card.Description>
      </Card.Content>
    </Card>
  );
};

export default CatalogCard;
