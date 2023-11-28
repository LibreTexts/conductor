import { Card, CardContentProps, Image } from "semantic-ui-react";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";

interface BookCardContentProps extends CardContentProps {
  book: Book;
}

const BookCardContent: React.FC<BookCardContentProps> = ({ book, ...rest }) => {
  return (
    <>
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
    </>
  );
};

export default BookCardContent;
