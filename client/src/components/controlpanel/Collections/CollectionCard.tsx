import { Card, Button, Image } from "semantic-ui-react";
import { Book, Collection, CollectionResource } from "../../../types";
import { truncateString } from "../../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../../util/LibraryOptions";
import "./CollectionsManager.css";
import {
  checkIsBook,
  checkIsCollection,
  checkIsCollectionResource,
} from "../../util/TypeHelpers";
import {isBook} from "../../../utils/typeHelpers";
const CollectionCard = ({
  item,
  onClickCollCB,
  onClickBookCB,
  onDeleteCB,
}: {
  item: Collection | CollectionResource;
  onClickCollCB?: (collectionID: string, collName: string) => void;
  onClickBookCB?: (bookID: string) => void;
  onDeleteCB?: (item: CollectionResource) => void;
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

  const extractItemId = (item: Collection | CollectionResource): string => {
    if (checkIsCollection(item)) {
      return (item as Collection).collID;
    }

    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return (item.resourceData as Collection).collID;
      }
      if (checkIsBook(item.resourceData)) {
        return (item.resourceData as Book).bookID;
      }
    }
    return "unknown";
  };

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

  function GenItemCounts({
    item,
  }: {
    item: Collection | CollectionResource;
  }): JSX.Element | null {
    if (checkIsCollection(item)) {
      return (
        <>
          <Card.Meta>{item.resourceCount ?? 0} resources</Card.Meta>
        </>
      );
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        return (
          <>
            <Card.Meta>
              {item.resourceData.resources.length ?? 0} resources
            </Card.Meta>
          </>
        );
      }
    }
    return null;
  }

  function GenBookData({
    item,
  }: {
    item: Collection | CollectionResource;
  }): JSX.Element | null {
    if (checkIsBook(item)) {
      return (
        <>
          <Card.Meta>
            <Image
              src={getLibGlyphURL(item.library)}
              className="library-glyph"
            />
            {getLibraryName(item.library)}
          </Card.Meta>
          <Card.Description>
            <p className="commons-content-card-author">
              {truncateString(item.author, 30)}
            </p>
            <p className="commons-content-card-affiliation">
              <em>{truncateString(item.affiliation, 25)}</em>
            </p>
          </Card.Description>
        </>
      );
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsBook(item.resourceData)) {
        return (
          <>
            <Card.Meta>
              <Image
                src={getLibGlyphURL(item.resourceData.library)}
                className="library-glyph"
              />
              {getLibraryName(item.resourceData.library)}
            </Card.Meta>
            <Card.Description>
              <p className="commons-content-card-author">
                {truncateString(item.resourceData.author, 30)}
              </p>
              <p className="commons-content-card-affiliation">
                <em>{truncateString(item.resourceData.affiliation, 25)}</em>
              </p>
            </Card.Description>
          </>
        );
      }
    }
    return null;
  }

  function handleOnClick(item: Collection | CollectionResource) {
    if (checkIsCollection(item)) {
      if (onClickCollCB) {
        onClickCollCB(extractItemId(item), item.title);
      }
      return;
    }
    if (checkIsCollectionResource(item) && item.resourceData) {
      if (checkIsCollection(item.resourceData)) {
        if (onClickCollCB) {
          onClickCollCB(
            extractItemId(item.resourceData),
            item.resourceData.title
          );
        }
      }
      if (checkIsBook(item.resourceData)) {
        if (onClickBookCB) {
          onClickBookCB(item.resourceData.bookID);
        }
      }
    }
  }

  function handleOnDeleteResource(event: React.MouseEvent, item: CollectionResource) {
    event.stopPropagation();
    if (onDeleteCB) {
      onDeleteCB(item);
    }
    return;
  }

  return (
    <Card
      onClick={() => handleOnClick(item)}
      className="collections-manager-card"
      as="a"
      href={genURL(item)}
    >
      <div className="collections-manager-card-img-wrapper">
        <div
          className="collections-manager-card-img"
          style={{
            backgroundImage: `url(${genBackgroundURL(item)})`,
          }}
        />
      </div>
      <Card.Content className="collections-manager-card-inner-content">
        <Card.Header as="h3" className="collections-manager-card-header">
          {truncateString(extractItemTitle(item), 50)}
        </Card.Header>
        <GenBookData item={item} />
        <GenItemCounts item={item} />
        {shouldShowActions(item) && (
          <div className="collections-manager-card-actions-wrapper">
            <Button
              color="orange"
              icon="remove"
              onClick={(event) => handleOnDeleteResource(event, item as CollectionResource)}
            />
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

export default CollectionCard;
