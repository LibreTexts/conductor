import { Link } from "react-router-dom";
import { Collection } from "../../../../types";
import { getCollectionHref } from "../../../util/CollectionHelpers";
import { Card, Heading, Stack } from "@libretexts/davis-react";
import { COVER_PLACEHOLDER, handleCoverError } from "./cardImageFallback";

interface CollectionCardContentProps {
  collection: Collection;
  /**
   * Overrides the default target. A collection nested inside another links
   * relative to the current pathname rather than to /collections/<title>.
   */
  linkTo?: string;
  headingLevel?: 2 | 3;
}

const CollectionCardContent: React.FC<CollectionCardContentProps> = ({
  collection,
  linkTo,
  headingLevel = 2,
}) => (
  <>
    <div className="relative">
      <Card.Header>
        {/* Negative margins cancel headerContent padding so the image stays
            full-bleed (matches the Card.Header image prop layout). The image
            is rendered here rather than through that prop because the prop
            hardcodes object-cover. */}
        <div className="-mx-6 -my-4">
          {/* Collection covers are campus logos and wordmarks, so they are
              contained and centered rather than cropped to fill the band. */}
          <div className="aspect-3/2 w-full flex items-center justify-center bg-white p-6">
            <img
              src={collection.coverPhoto || COVER_PLACEHOLDER}
              alt="" // Covers are purely decorative
              className="max-h-full max-w-full object-contain block"
              onError={handleCoverError}
            />
          </div>
        </div>
      </Card.Header>
    </div>
    <Card.Body>
      <Stack direction="vertical" gap="xs" className="py-1!">
        <Heading
          level={headingLevel}
          className="line-clamp-3 !text-[1.125rem] !leading-7 !mb-1"
        >
          <Link
            to={linkTo || getCollectionHref(collection)}
            className="commons-card-title-link"
          >
            {collection.title}
          </Link>
        </Heading>
      </Stack>
    </Card.Body>
  </>
);

export default CollectionCardContent;
