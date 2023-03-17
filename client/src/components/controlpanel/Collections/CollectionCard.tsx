import { Card } from "semantic-ui-react";
import { Collection } from "../../../types";
import { truncateString } from "../../util/HelperFunctions";
import { Link } from "react-router-dom";
import "./CollectionsManager.css";
import { displayCollectionCounts } from "../../util/CollectionHelpers";

const CollectionCard = ({
  item,
  onClickCB
}: {
  item: Collection;
  onClickCB: (collectionID: string) => void;
}) => {
  /*const { resourcesCount, nestedCollectionsCount } = displayCollectionCounts(
    item.resources
  );*/
  return (
    <Card
      key={`card-${item.collID}`}
      onClick={() => onClickCB(item.collID)}
      className="collections-manager-card"
    >
      <div className="collections-manager-card-img-wrapper">
        <div
          className="collections-manager-card-img"
          style={{
            backgroundImage: `url(${
              !item.coverPhoto || item.coverPhoto === ""
                ? "/mini_logo.png"
                : item.coverPhoto
            })`,
          }}
        />
      </div>
      <Card.Content className="collections-manager-card-inner-content">
        <Card.Header as="h3" className="collections-manager-card-header">
          {item.title}
        </Card.Header>
        <Card.Meta> resources</Card.Meta>
        <Card.Meta> collections</Card.Meta>
      </Card.Content>
    </Card>
  );
};

export default CollectionCard;
