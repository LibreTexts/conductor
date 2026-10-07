import { Collection, CollectionResource } from "../../types";
import { Link } from "react-router-dom";
import { getLibGlyphAltText, getLibGlyphURL } from "../util/LibraryOptions";
import { isBook as checkIsBook } from "../../utils/typeHelpers";
import { getCollectionHref } from "../util/CollectionHelpers";
import { Card, Heading, Text, Stack } from "@libretexts/davis-react";
import "../commons/Commons.css";

interface CollectionCardProps {
  item: Collection | CollectionResource;
  to?: string;
}

/** Shown when a collection has no cover set or its cover fails to load. */
const COVER_PLACEHOLDER = "/mini.logo.png";

const CollectionCard: React.FC<CollectionCardProps> = ({ item, to }) => {
  const getResourceData = () => {
    if ("resourceData" in item) {
      return item.resourceData;
    }
    return item;
  };

  const resourceData = getResourceData();

  // A CollectionResource whose parent record was deleted, made private, or
  // filtered out by the server arrives with no resourceData. Dereferencing it
  // below threw "Cannot read properties of undefined (reading 'thumbnail')"
  // and took the whole collections grid down with it.
  if (!resourceData) {
    console.warn("CollectionCard: item has no resource data, skipping.", item);
    return null;
  }

  const isBook = checkIsBook(resourceData);
  const thumbnail =
    (isBook ? resourceData.thumbnail : resourceData.coverPhoto) ||
    COVER_PLACEHOLDER;

  // A collection with a stale cover URL would otherwise paint the browser's
  // broken-image glyph. The guard stops a missing placeholder from looping.
  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER)) return;
    event.currentTarget.src = COVER_PLACEHOLDER;
  }

  return (
    <Card
      variant="elevated"
      // h-full lets the card fill its <li> grid cell so rows stay equal-height.
      className="relative h-full hover:border-secondary hover:border-2"
    >
      <div className="relative">
        <Card.Header>
          {/* Negative margins cancel headerContent padding so the image stays
              full-bleed (matches the Card.Header image prop layout). The image
              is rendered here rather than through that prop because the prop
              hardcodes object-cover. */}
          <div className="-mx-6 -my-4">
            {isBook ? (
              <img
                src={thumbnail}
                alt="" // Thumbnails are purely decorative
                className="w-full h-48 object-cover block"
                onError={handleImageError}
              />
            ) : (
              // Collection covers are campus logos and wordmarks, so they are
              // contained and centered rather than cropped to fill the band.
              <div className="h-48 w-full flex items-center justify-center bg-white p-6">
                <img
                  src={thumbnail}
                  alt="" // Covers are purely decorative
                  className="max-h-full max-w-full object-contain block"
                  onError={handleImageError}
                />
              </div>
            )}
          </div>
        </Card.Header>
        {isBook && (
          <div className="library-glyph-header">
            <img
              src={getLibGlyphURL(resourceData.library)}
              className="library-glyph !w-7 !h-7 !mr-0"
              alt={getLibGlyphAltText(resourceData.library)}
            />
          </div>
        )}
      </div>
      <Card.Body>
        <Stack direction="vertical" gap="sm" className="py-4">
          <Heading level={2} className="line-clamp-2 !text-2xl">
            <Link
              to={to || getCollectionHref(item)}
              className="commons-card-title-link"
            >
              {resourceData.title}
            </Link>
          </Heading>
          {isBook && (
            <>
              <Text size="base" className="line-clamp-2">
                {resourceData.author}
              </Text>
              <Text>
                <em>{resourceData.affiliation}</em>
              </Text>
            </>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default CollectionCard;
