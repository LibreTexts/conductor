import { RefObject } from "react";
import { Book, Project, ProjectFileWProjectID } from "../../../types";
import CatalogCard from "./CatalogCard";
import "../Commons.css";

const VisualMode = ({ items }: { items: (Book | ProjectFileWProjectID | Project)[] }) => {
  console.log(items)
  return (
    <div className="commons-content-card-grid">
      {items.map((item, index) => (
        <CatalogCard item={item} key={index} />
      ))}
    </div>
  );
};

export default VisualMode;
