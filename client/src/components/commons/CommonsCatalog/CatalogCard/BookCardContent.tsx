import { Icon } from "semantic-ui-react";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphAltText, getLibGlyphURL } from "../../../util/LibraryOptions";
import { Heading, Card, Text, Stack } from "@libretexts/davis-react";

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
    <>
      <div className="relative">
        <Card.Header
          image={{
            src: book.thumbnail,
            alt: "", // The thumbnails are purely decorative, so leave alt text as empty string to be ignored by screen readers
          }}
        />
        <div className="library-glyph-header">
          <img
            src={getLibGlyphURL(book.library)}
            className="library-glyph !w-7 !h-7 !mr-0"
            alt={getLibGlyphAltText(book.library)}
          />
        </div>
      </div>
      <Card.Body>
        <Stack direction="vertical" gap="sm" className="py-4">
          <Heading level={2} className="line-clamp-2 !text-2xl">
            {book.title}
          </Heading>
          <Text size="base" className="line-clamp-2">
            {book.author}
          </Text>
          <Text >
            <em>{truncateString(book.affiliation, 30)}</em>
          </Text>
          {assetString ? (
            <Text className="commons-content-card-affiliation !mt-3">
              <Icon name="file alternate outline" />
              {assetString}
            </Text>
          ) : null}
        </Stack>
      </Card.Body>
    </>
  );
};

export default BookCardContent;
