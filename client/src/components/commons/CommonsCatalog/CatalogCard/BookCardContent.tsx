import { Link } from "react-router-dom";
import { Book } from "../../../../types";
import { truncateString } from "../../../util/HelperFunctions";
import { getLibGlyphAltText, getLibGlyphURL } from "../../../util/LibraryOptions";
import { Heading, Card, Text, Stack } from "@libretexts/davis-react";
import PausableImage from "../../../util/PausableImage";
import { IconFileDescription, IconSchoolFilled } from "@tabler/icons-react";

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
  const publicAssets = book.publicAssets || 0;
  const instructorAssets = book.instructorAssets || 0;

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
          {(publicAssets > 0 || instructorAssets > 0) ? (
            <Stack direction="vertical" gap="xs">
              {
                instructorAssets > 0 && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconSchoolFilled size={16} className="text-primary" />
                    <Text>
                      {instructorAssets} instructor asset{instructorAssets > 1 ? "s" : ""}
                    </Text>
                  </Stack>
                )}
              {
                publicAssets > 0 && (
                  <Stack direction="horizontal" gap="sm" align="center">
                    <IconFileDescription size={16} />
                    <Text>
                      {publicAssets} public asset{publicAssets > 1 ? "s" : ""}
                    </Text>
                  </Stack>
                )}
            </Stack>
          ) : null}
        </Stack>
      </Card.Body>
    </>
  );
};

export default BookCardContent;
