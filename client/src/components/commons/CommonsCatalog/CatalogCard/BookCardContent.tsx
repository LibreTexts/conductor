import { Icon } from "semantic-ui-react";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../../util/LibraryOptions";
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
      <Card.Header
        image={{
          src: book.thumbnail,
          alt: `${book.title} thumbnail`,
        }}
      />
      <Card.Body>
        <Stack direction="vertical" gap="sm">
          <Heading level={6} className="line-clamp-2">
            {book.title}
          </Heading>
          <div className="flex items-center gap-1">
            <img src={getLibGlyphURL(book.library)} className="library-glyph" alt="" />
            <Text>{getLibraryName(book.library)}</Text>
          </div>
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
