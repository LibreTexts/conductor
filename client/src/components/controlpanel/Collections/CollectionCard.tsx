import { Card, Heading, Text, Stack, IconButton } from "@libretexts/davis-react";
import { IconX } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Book, Collection, CollectionResource } from "../../../types";
import { truncateString } from "../../util/HelperFunctions";
import {
  getLibGlyphURL,
  getLibGlyphAltText,
  getLibraryName,
} from "../../util/LibraryOptions";
import {
  checkIsBook,
  checkIsCollection,
  checkIsCollectionResource,
} from "../../util/TypeHelpers";
import classNames from "classnames";
import "../../commons/Commons.css";

const CollectionCard = ({
  item,
  onClickCollCB,
  onClickBookCB,
  onDeleteCB,
  asLink,
  linkTo,
  className,
}: {
  item: Collection | CollectionResource;
  onClickCollCB?: (collectionID: string, collName: string) => void;
  onClickBookCB?: (bookID: string) => void;
  onDeleteCB?: (item: CollectionResource) => void;
  asLink?: boolean;
  // Overrides the default `/collection/:id` target when the card is rendered
  // asLink (e.g. root Collections Manager links to the routed detail page).
  linkTo?: string;
  className?: string;
}) => {
  function genBackgroundURL(item: Collection | CollectionResource): string {
    if (checkIsCollection(item)) {
      return (item as Collection).coverPhoto;
    }

    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return (item.resourceData as Collection).coverPhoto;
      }
      if (checkIsBook(item.resourceData)) {
        return (item.resourceData as Book).thumbnail;
      }
    }

    return "/mini.logo.png";
  }

  function genURL(item: Collection | CollectionResource): string {
    return `/collection/${checkIsBook(item) ? item.bookID : checkIsCollectionResource(item) ? item.resourceID : item.collID}`;
  }

  const extractItemTitle = (item: Collection | CollectionResource): string => {
    if (checkIsCollection(item)) {
      return (item as Collection).title;
    }

    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return (item.resourceData as Collection).title;
      }
      if (checkIsBook(item.resourceData)) {
        return (item.resourceData as Book).title;
      }
    }
    return "unknown";
  };

  const shouldShowActions = (
    item: Collection | CollectionResource
  ): boolean => {
    if (!onDeleteCB) {
      return false;
    }
    if (checkIsCollection(item)) {
      return false;
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return false;
      }
      if (checkIsBook(item.resourceData)) {
        return true;
      }
    }
    return false;
  };

  // Resolve the underlying entity (a resource wraps a Book or a Collection).
  const resourceData = checkIsCollectionResource(item)
    ? item.resourceData
    : item;
  const isBookItem = resourceData ? checkIsBook(resourceData) : false;
  const book = isBookItem ? (resourceData as Book) : undefined;

  function GenItemCounts(): JSX.Element | null {
    if (checkIsCollection(item)) {
      return <Text color="muted">{item.resourceCount ?? 0} resources</Text>;
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return (
          <Text color="muted">
            {item.resourceData.resources.length ?? 0} resources
          </Text>
        );
      }
    }
    return null;
  }

  function handleOnClick(item: Collection | CollectionResource) {
    if (checkIsCollection(item)) {
      if (onClickCollCB) {
        onClickCollCB(item.collID, item.title);
      }
      return;
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        if (onClickCollCB) {
          onClickCollCB(item.resourceData.collID, item.resourceData.title);
        }
      }
      if (checkIsBook(item.resourceData)) {
        if (onClickBookCB) {
          onClickBookCB(item.resourceData.bookID);
        }
      }
    }
  }

  function handleOnDeleteResource(
    event: React.MouseEvent,
    item: CollectionResource
  ) {
    event.stopPropagation();
    if (onDeleteCB) {
      onDeleteCB(item);
    }
  }

  const title = truncateString(extractItemTitle(item), 50);

  return (
    <Card
      variant="elevated"
      // `relative` anchors the title link's stretched ::after overlay so the
      // whole card is clickable via a single control; h-full keeps grid rows
      // equal-height.
      className={classNames(
        "relative h-full hover:border-secondary hover:border-2",
        className
      )}
    >
      <div className="relative">
        <Card.Header
          image={{
            src: genBackgroundURL(item),
            alt: "",
          }}
        />
        {book && (
          <div className="library-glyph-header">
            <img
              src={getLibGlyphURL(book.library)}
              className="library-glyph !w-7 !h-7 !mr-0"
              alt={getLibGlyphAltText(book.library)}
            />
          </div>
        )}
      </div>
      <Card.Body>
        <Stack direction="vertical" gap="sm" className="py-4">
          <Heading level={3} className="line-clamp-2 !text-2xl">
            {asLink ? (
              <Link to={linkTo ?? genURL(item)} className="commons-card-title-link">
                {title}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleOnClick(item)}
                className="commons-card-title-link"
              >
                {title}
              </button>
            )}
          </Heading>
          {book && (
            <>
              <Text className="line-clamp-1">{getLibraryName(book.library)}</Text>
              <Text size="base" className="line-clamp-2">
                {truncateString(book.author, 30)}
              </Text>
              <Text className="line-clamp-1">
                <em>{truncateString(book.affiliation, 25)}</em>
              </Text>
            </>
          )}
          <GenItemCounts />
        </Stack>
      </Card.Body>
      {shouldShowActions(item) && (
        // Sits above the title link's ::after overlay so the delete action
        // stays independently clickable.
        <div className="absolute top-2 right-2 z-10">
          <IconButton
            icon={<IconX size={16} />}
            aria-label="Remove resource from collection"
            variant="destructive"
            size="sm"
            onClick={(event) =>
              handleOnDeleteResource(event, item as CollectionResource)
            }
          />
        </div>
      )}
    </Card>
  );
};

export default CollectionCard;
