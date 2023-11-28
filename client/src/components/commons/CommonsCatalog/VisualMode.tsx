import { RefObject } from "react";
import { Book, ProjectFileWProjectID } from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";

const VisualMode = ({ items }: { items: (Book | ProjectFileWProjectID)[] }) => {
  return (
    <div className="commons-content-card-grid">
      {items.map((item, index) => (
        <CatalogCard item={item} key={index} />
      ))}
    </div>
  );
};

export default VisualMode;
