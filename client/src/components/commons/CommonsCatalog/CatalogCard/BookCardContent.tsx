import { Card, CardContentProps, Icon, Image } from "semantic-ui-react";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";

interface BookCardContentProps extends CardContentProps {
  book: Book;
}

const BookCardContent: React.FC<BookCardContentProps> = ({ book, ...rest }) => {

  const buildAssetString = () => {
    let assetString = "";
    if(book.publicAssets) {
      assetString += `${book.publicAssets} public asset${book.publicAssets > 1 ? "s" : ""}`;
    }
    if(book.instructorAssets) {
      assetString += `${book.publicAssets ? ", " : ""}${book.instructorAssets} instructor asset${book.instructorAssets > 1 ? "s" : ""}`;
    }
    return assetString;
  }

  const assetString = buildAssetString();

  return (
    <Card.Content className="commons-content-card-inner-content" {...rest}>
      <div
        className="commons-card-img-container !bg-cover"
        style={{ backgroundImage: `url(${book.thumbnail})` }}
      ></div>
      <Card.Header as="h3" className="commons-content-card-header !mt-4">
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
        {assetString ? (
          <p className="commons-content-card-affiliation !mt-3">
            <Icon name="file alternate outline" />
            {assetString}
          </p>
        ) : null}
      </Card.Description>
    </Card.Content>
  );
};

export default BookCardContent;
