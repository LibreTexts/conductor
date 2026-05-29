import { Badge, Tooltip } from "@libretexts/davis-react";
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
    size,
    value,
  }: {
    size: "small" | "large";
    value: string;
  }) => {
    return (
      <Badge
        label={value}
        variant={basic ? "default" : "primary"}
        size={size === "small" ? "sm" : "md"}
        className="mb-2"
      />
    );
  };

  const RenderRemainingLabel = (
    tags: string[] | AssetTag[] | LiteTag[],
    maxLen: number
  ) => {
    const remaining = getRemainingCount(tags, maxLen);
    if (remaining === 0) return;
    return (
      <Badge
        label={`+${remaining} more`}
        variant="default"
        size={size === "small" ? "sm" : "md"}
        className="mb-2"
      />
    );
  };

  const trigger = (
    <div className="asset-tags-container flex flex-wrap gap-2">
      {!sortedTags ||
        (sortedTags.length === 0 && showNoTagsMessage && (
          <span className="muted-text italic">No associated tags</span>
        ))}
      {sortedTags &&
        spreadArray &&
        flattenedTags.slice(0, max === 'none' ? flattenedTags.length : max).map((t, index) => {
          return (
            <RenderTag
              key={`${t.text}-${index}`}
              size={size}
              value={t.text}
            />
          );
        })}
      {sortedTags &&
        !spreadArray &&
        sortedTags?.slice(0, max === 'none' ? flattenedTags.length : max).map((tag) => {
          const val = getLabelValue(tag, !basic);
          if (!val || val === "Unknown") return <></>;
          return (
            <RenderTag
              key={tag.uuid}
              size={size}
              value={val}
            />
          );
        })}
      {sortedTags &&
        RenderRemainingLabel(spreadArray ? flattenedTags : sortedTags, max === 'none' ? spreadArray ? flattenedTags.length : sortedTags.length : max)}
    </div>
  );

  const tooltipContent = sortedTags?.map((tag) => {
    const title = getLabelTitle(tag);
    const text = getLabelText(tag);
    return (
      <div key={tag.uuid} className="mb-2 last:mb-0">
        <span className="font-semibold">{title}</span>:{" "}
        {text &&
          spreadArray &&
          _flattenTags([tag]).map((t, index) => {
            return (
              <RenderTag
                size="small"
                value={t.text}
                key={`${tag.uuid}-${t.text}-${index}`}
              />
            );
          })}
        {text && !spreadArray && (
          <RenderTag
            size="small"
            value={text}
            key={tag.uuid}
          />
        )}
        {!text && "No value provided"}
      </div>
    );
  });

  if (popupDisabled) {
    return trigger;
  }

  return (
    <Tooltip content={tooltipContent} disabled={popupDisabled}>
      {trigger}
    </Tooltip>
  );
};

export default RenderAssetTags;
