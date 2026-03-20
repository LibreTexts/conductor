import { Icon } from "semantic-ui-react";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";

interface BookCardContentProps {
  book: Book;
}

const BookCardContent: React.FC<BookCardContentProps> = ({ book }) => {
  const buildAssetString = () => {
    let assetString = "";
    if (book.publicAssets) {
      assetString += `${book.publicAssets} public asset${book.publicAssets > 1 ? "s" : ""}`;
    }
    if (book.instructorAssets) {
      assetString += `${book.publicAssets ? ", " : ""}${book.instructorAssets} instructor asset${book.instructorAssets > 1 ? "s" : ""}`;
    }
    return assetString;
  };

  const assetString = buildAssetString();

  return (
    <div className="h-full">
      <div
        className="commons-card-img-container !bg-cover"
        style={{ backgroundImage: `url(${book.thumbnail})` }}
      />
      <div className="px-4 pt-3 pb-2">
        <h3 className="commons-content-card-header">
          {truncateString(book.title, 50)}
        </h3>
        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
          <img src={getLibGlyphURL(book.library)} className="library-glyph" alt="" />
          {getLibraryName(book.library)}
        </div>
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
      </div>
    </div>
  );
};

export default BookCardContent;
