import { Label, Popup } from "semantic-ui-react";
import { AssetTag, ProjectFile } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";

const RenderAssetTags: React.FC<{
  file: ProjectFile;
  max?: number;
  showNoTagsMessage?: boolean;
  size?: "small" | "large";
  basic?: boolean;
  popupDisabled?: boolean;
}> = ({
  file,
  max = 5,
  showNoTagsMessage = true,
  size = "large",
  basic = false,
  popupDisabled = false,
}) => {
  const sortedTags = file.tags?.sort((a, b) => {
    if (isAssetTagKeyObject(a.key) && isAssetTagKeyObject(b.key)) {
      return a.key.title.localeCompare(b.key.title);
    }
    return 0;
  });

  function getLabelText(tag: AssetTag) {
    const text = tag.value
      ? Array.isArray(tag.value)
        ? tag.value.join(", ")
        : tag.value
      : "Unknown";
    return text.toString();
  }

  function getLabelTitle(tag: AssetTag) {
    if (isAssetTagKeyObject(tag.key)) {
      return tag.key.title;
    }
    return "Unknown";
  }

  function getLabelValue(tag: AssetTag, showTitle = true, truncate = true) {
    const text = getLabelText(tag);
    const truncated = truncate ? truncateString(text, 40) : text;
    return showTitle ? `${getLabelTitle(tag)}: ${truncated}` : truncated;
  }

  function getLabelColor(tag: AssetTag, basic = false) {
    if (basic) return "";
    if (tag.key && isAssetTagKeyObject(tag.key)) {
      return tag.key.hex;
    }
    return "grey";
  }

  return (
    <Popup
      disabled={popupDisabled}
      trigger={
        <div className="asset-tags-container">
          {!sortedTags ||
            (sortedTags.length === 0 && showNoTagsMessage && (
              <span className="muted-text italic">No associated tags</span>
            ))}
          {sortedTags?.slice(0, max).map((tag) => {
            const val = getLabelValue(tag, !basic);
            if (!val || val === "Unknown") return <></>;
            const color = getLabelColor(tag, basic).toString();
            return (
              <Label
                style={{
                  backgroundColor: color,
                  borderColor: color,
                  color: basic ? "black" : "white",
                }}
                size={size === "small" ? "mini" : "tiny"}
                key={tag.uuid}
              >
                {val}
              </Label>
            );
          })}
          {sortedTags && sortedTags?.length > max ? (
            <Label color="grey" size={size === "small" ? "mini" : "tiny"}>
              +{sortedTags?.length - max} more
            </Label>
          ) : (
            <></>
          )}
        </div>
      }
      content={sortedTags?.map((tag) => {
        const title = getLabelTitle(tag);
        const text = getLabelText(tag);
        const color = getLabelColor(tag).toString();
        return (
          <div key={tag.uuid} className="">
            <span className="font-semibold">{title}</span>:{" "}
            {text ? (
              <Label
                style={{
                  backgroundColor: color,
                  borderColor: color,
                  color: "white",
                }}
                size="mini"
              >
                {text}
              </Label>
            ) : (
              "No value provided"
            )}
          </div>
        );
      })}
    />
  );
};

export default RenderAssetTags;
