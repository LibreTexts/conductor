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
  const thumbnail = isBook ? resourceData.thumbnail : resourceData.coverPhoto;

  return (
    <Card
      variant="elevated"
      // h-full lets the card fill its <li> grid cell so rows stay equal-height.
      className="relative h-full hover:border-secondary hover:border-2"
    >
      <div className="relative">
        <Card.Header
          image={{
            src: thumbnail,
            alt: "",
          }}
        />
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
