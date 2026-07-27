import { Link } from "react-router-dom";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphAltText, getLibGlyphURL } from "../../../util/LibraryOptions";
import { Heading, Card, Text, Stack } from "@libretexts/davis-react";
import PausableImage from "../../../util/PausableImage";
import { IconFile, IconFileDescription } from "@tabler/icons-react";

interface BookCardContentProps {
  book: Book;
  linkTo: string;
  headingLevel?: 2 | 3;
}

const BookCardContent: React.FC<BookCardContentProps> = ({
  book,
  linkTo,
  headingLevel = 2,
}) => {
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
        <Card.Header>
          {/* Negative margins cancel headerContent padding so the image stays full-bleed (matches Card.Header image prop layout) */}
          <div className="-mx-6 -my-4">
            <PausableImage
              src={book.thumbnail}
              alt="" // Thumbnails are purely decorative
              className="w-full h-48 object-cover block"
              isAnimated={book.thumbnailIsAnimated}
            />
          </div>
        </Card.Header>
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
          <Heading level={headingLevel} className="line-clamp-3 !text-lg">
            <Link to={linkTo} className="commons-card-title-link">
              {book.title}
            </Link>
          </Heading>
          <Text size="base" className="line-clamp-2">
            {book.author}
          </Text>
          <Text >
            <em>{truncateString(book.affiliation, 30)}</em>
          </Text>
          {assetString ? (
            <Stack direction="horizontal" gap="xs" align="center">
              <IconFileDescription className="!mr-1" size={16} />
              <Text>
                {assetString}
              </Text>
            </Stack>
          ) : null}
        </Stack>
      </Card.Body>
    </>
  );
};

export default BookCardContent;
