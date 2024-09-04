import { Label, Popup } from "semantic-ui-react";
import { AssetTag, ProjectFile } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import { useMemo } from "react";

type LiteTag = {
  hex: string;
  text: string;
};

const isLiteTag = (value: any): value is LiteTag => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  return "hex" in value && "text" in value;
};

const RenderAssetTags: React.FC<{
  file: ProjectFile;
  max?:  number | 'none';
  showNoTagsMessage?: boolean;
  size?: "small" | "large";
  basic?: boolean;
  popupDisabled?: boolean;
  spreadArray?: boolean;
}> = ({
  file,
  max = 5,
  showNoTagsMessage = true,
  size = "large",
  basic = false,
  popupDisabled = false,
  spreadArray = false,
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

  function getLabelColor(tag: AssetTag | LiteTag, basic = false) {
    if (basic) return "";
    if (typeof tag === "object" && isLiteTag(tag)) {
      return tag.hex;
    }
    if (tag?.key && isAssetTagKeyObject(tag.key)) {
      return tag.key.hex;
    }
    return "grey";
  }

  function getRemainingCount(tags: string[] | AssetTag[] | LiteTag[], maxLen: number) {
    if (!tags) return 0;
    return tags?.length && tags?.length > maxLen ? tags?.length - maxLen : 0;
  }

  const _flattenTags = (tags: AssetTag[]) => {
    return tags.reduce((acc, tag) => {
      if (!tag.value || tag.value === "Unknown") return acc;
      if (Array.isArray(tag.value)) {
        if (tag.value.length === 0) return acc;
        return [
          ...acc,
          ...tag.value.map((v) => ({
            hex: isAssetTagKeyObject(tag.key) ? tag.key.hex : "grey",
            text: v.toString(),
          })),
        ];
      }
      return [
        ...acc,
        {
          hex: isAssetTagKeyObject(tag.key) ? tag.key.hex : "grey",
          text: tag.value.toString() ?? "Unknown",
        },
      ];
    }, [] as LiteTag[]);
  };

  const flattenedTags = useMemo(
    () => _flattenTags(sortedTags ?? []),
    [sortedTags]
  );

  const RenderTag = ({
    color,
    size,
    value,
    blackText,
  }: {
    color: string;
    size: "small" | "large";
    value: string;
    blackText: boolean;
  }) => {
    return (
      <Label
        style={{
          backgroundColor: color,
          borderColor: color,
          color: blackText ? "black" : "white",
          marginBottom: "0.5rem",
        }}
        size={size === "small" ? "mini" : "tiny"}
        key={crypto.randomUUID()}
      >
        {value}
      </Label>
    );
  };

  const RenderRemainingLabel = (
    tags: string[] | AssetTag[] | LiteTag[],
    maxLen: number
  ) => {
    const remaining = getRemainingCount(tags, maxLen);
    if (remaining === 0) return;
    return (
      <Label color="grey" size={size === "small" ? "mini" : "tiny"}>
        +{remaining} more
      </Label>
    );
  };

  return (
    <Popup
      disabled={popupDisabled}
      trigger={
        <div className="asset-tags-container">
          {!sortedTags ||
            (sortedTags.length === 0 && showNoTagsMessage && (
              <span className="muted-text italic">No associated tags</span>
            ))}
          {sortedTags &&
            spreadArray &&
            flattenedTags.slice(0, max === 'none' ? flattenedTags.length : max).map((t, index) => {
              const color = getLabelColor(
                flattenedTags[index],
                basic
              ).toString();
              return (
                <RenderTag
                  color={color}
                  key={index}
                  size={size}
                  value={t.text}
                  blackText={basic}
                />
              );
            })}
          {sortedTags &&
            !spreadArray &&
            sortedTags?.slice(0, max === 'none' ? flattenedTags.length : max).map((tag) => {
              const val = getLabelValue(tag, !basic);
              if (!val || val === "Unknown") return <></>;
              const color = getLabelColor(tag, basic).toString();
              return (
                <RenderTag
                  key={tag.uuid}
                  color={color}
                  size={size}
                  value={val}
                  blackText={false}
                />
              );
            })}
          {sortedTags &&
            RenderRemainingLabel(spreadArray ? flattenedTags : sortedTags, max === 'none' ? spreadArray ? flattenedTags.length : sortedTags.length : max)}
        </div>
      }
      content={sortedTags?.map((tag) => {
        const title = getLabelTitle(tag);
        const text = getLabelText(tag);
        const color = getLabelColor(tag).toString();
        return (
          <div key={crypto.randomUUID()} className="">
            <span className="font-semibold">{title}</span>:{" "}
            {text &&
              spreadArray &&
              _flattenTags([tag]).map((t) => {
                return (
                  <RenderTag
                    color={color}
                    size="small"
                    value={t.text}
                    blackText={false}
                    key={crypto.randomUUID()}
                  />
                );
              })}
            {text && !spreadArray && (
              <RenderTag
                color={color}
                size="small"
                value={text}
                blackText={false}
                key={crypto.randomUUID()}
              />
            )}
            {!text && "No value provided"}
          </div>
        );
      })}
    />
  );
};

export default RenderAssetTags;
