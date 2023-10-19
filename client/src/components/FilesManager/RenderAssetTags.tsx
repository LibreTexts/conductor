import { Label } from "semantic-ui-react";
import { AssetTag, ProjectFile } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";

const RenderAssetTags: React.FC<{ file: ProjectFile }> = ({ file }) => {
  const sortedTags = file.tags?.sort((a, b) => {
    if (isAssetTagKeyObject(a.key) && isAssetTagKeyObject(b.key)) {
      return a.key.title.localeCompare(b.key.title);
    }
    return 0;
  });

  function getLabelValue(tag: AssetTag) {
    const title = isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key;
    const text = title + ": " + tag.value.toString();
    const truncated = truncateString(text, 20);
    return truncated;
  }

  function getLabelColor(tag: AssetTag) {
    if(tag.key && isAssetTagKeyObject(tag.key)) {
      return tag.key.hex;
    }
    return "grey";
  }

  return (
    <div className="asset-tag-container">
      {!sortedTags ||
        (sortedTags.length === 0 && (
          <span className="muted-text italic">No associated tags</span>
        ))}
      {sortedTags?.slice(0, 5).map((tag) => (
        <Label style={
          {
            backgroundColor: getLabelColor(tag).toString(),
            borderColor: getLabelColor(tag).toString(),
            color: "white"
          }
        } size="tiny" key={tag.uuid}>
          {getLabelValue(tag)}
        </Label>
      ))}
      {sortedTags && sortedTags?.length > 5 ? (
        <Label color="grey" size="tiny">
          +{sortedTags?.length - 5} more
        </Label>
      ) : (
        <></>
      )}
    </div>
  );
};

export default RenderAssetTags;
