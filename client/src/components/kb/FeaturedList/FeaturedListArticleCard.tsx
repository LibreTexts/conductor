import { Image } from "semantic-ui-react";
import "./FeaturedList.css";

const FeaturedListArticleCard = () => {
  return (
    <div className="app-item-container">
      <div className="app-item-icon-container">
        <Image width="90" height="90" />
        <div className="app-item-icon-overlay"></div>
      </div>
      <div className="app-item-text-container">
        <p className="app-item-header">Text</p>
        <p className="app-item-descrip">Text</p>
      </div>
    </div>
  );
};

export default FeaturedListArticleCard;
