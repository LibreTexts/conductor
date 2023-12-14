import { Label } from "semantic-ui-react";
import { AssetTag, ProjectFile } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";

const RenderAssetTags: React.FC<{
  file: ProjectFile;
  max?: number;
  showNoTagsMessage?: boolean;
  size?: "small" | "large";
}> = ({ file, max = 5, showNoTagsMessage = true, size = "large" }) => {
  const sortedTags = file.tags?.sort((a, b) => {
    if (isAssetTagKeyObject(a.key) && isAssetTagKeyObject(b.key)) {
      return a.key.title.localeCompare(b.key.title);
    }
    return 0;
  });

  function getLabelValue(tag: AssetTag) {
    const title = isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key;
    const text = tag.value
      ? title + ": " + tag.value.toString()
      : title + ": " + "Unknown";
    const truncated = truncateString(text, 20);
    return truncated;
  }

  function getLabelColor(tag: AssetTag) {
    if (tag.key && isAssetTagKeyObject(tag.key)) {
      return tag.key.hex;
    }
    return "grey";
  }

  return (
    <div className="asset-tag-container">
      {!sortedTags ||
        (sortedTags.length === 0 && showNoTagsMessage && (
          <span className="muted-text italic">No associated tags</span>
        ))}
      {sortedTags?.slice(0, max).map((tag) => (
        <Label
          style={{
            backgroundColor: getLabelColor(tag).toString(),
            borderColor: getLabelColor(tag).toString(),
            color: "white",
          }}
          size={size === "small" ? "mini" : "tiny"}
          key={tag.uuid}
        >
          {getLabelValue(tag)}
        </Label>
      ))}
      {sortedTags && sortedTags?.length > max ? (
        <Label color="grey" size={size === "small" ? "mini" : "tiny"}>
          +{sortedTags?.length - max} more
        </Label>
      ) : (
        <></>
      )}
    </div>
  );
};

export default RenderAssetTags;
