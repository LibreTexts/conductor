import { Label } from "semantic-ui-react";
import { AssetTag, ProjectFile } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { SemanticCOLORSArray } from "../../utils/misc";

const RenderAssetTags: React.FC<{ file: ProjectFile }> = ({ file }) => {
  function getLabelValue(tag: AssetTag) {
    const text = tag.title + ": " + tag.value.toString();
    const truncated = truncateString(text, 20);
    return truncated;
  }

  // Get a random color from SemanticCOLORSArray
  function getLabelColor() {
    // Remove grey from the array, reserve it for the "more" truncation label
    const colors = SemanticCOLORSArray.filter((color) => color !== "grey");
    const randomElement =
      colors[
        Math.floor(Math.random() * colors.length)
      ];
    return randomElement;
  }

  return (
    <div className="asset-tag-container">
      {file.tags?.slice(0, 5).map((tag) => (
        <Label color={getLabelColor()} size="tiny" key={tag.uuid}>
          {getLabelValue(tag)}
        </Label>
      ))}
      {file.tags && file.tags?.length > 5 ? (
        <Label color="grey" size="tiny">
          +{file.tags?.length - 5} more
        </Label>
      ) : (
        <></>
      )}
    </div>
  );
};

export default RenderAssetTags;
