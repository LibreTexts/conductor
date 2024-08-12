import { Card, Image } from "semantic-ui-react";
import { Collection, CollectionResource } from "../../types";
import { Link } from "react-router-dom";
import { getLibGlyphURL, getLibraryName } from "../util/LibraryOptions";
import { isBook as checkIsBook } from "../../utils/typeHelpers";
import { getCollectionHref } from "../util/CollectionHelpers";

interface CollectionCardProps {
  item: Collection | CollectionResource;
  to?: string;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ item, to }) => {
  const getResourceData = () => {
    if ("resourceData" in item) {
      return item.resourceData;
    } else {
      return item;
    }
  };

  const resourceData = getResourceData();
  const isBook = checkIsBook(resourceData);

  return (
    <Card
      as={Link}
      to={to ? to : getCollectionHref(item)}
      className="commons-content-card"
    >
      <div
        className="commons-content-card-img"
        style={{
          backgroundImage: `url(${isBook ? resourceData.thumbnail : resourceData.coverPhoto
            })`,
        }}
      />
      <Card.Content>
        <Card.Header className="commons-content-card-header">
          {resourceData.title}
        </Card.Header>
        <Card.Meta>
          <Image
            src={getLibGlyphURL(isBook ? resourceData.library : "")}
            className="library-glyph"
          />
          {getLibraryName(isBook ? resourceData.library : "")}
        </Card.Meta>
        <Card.Description>
          <p>{isBook ? resourceData.author : ""}</p>
          <p>
            <em>{isBook ? resourceData.affiliation : ""}</em>
          </p>
        </Card.Description>
      </Card.Content>
    </Card>
  );
};

export default CollectionCard;
