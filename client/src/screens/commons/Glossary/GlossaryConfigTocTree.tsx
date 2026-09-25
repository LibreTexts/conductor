import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { TableOfContents } from "../../../types/Book";
import { collectSubtreeIds } from "./glossaryConfigDefaults";
import GroupShape from "./GlossaryGroupShape";

export type PageGroupInfo = { color: string; index: number };

interface GlossaryConfigTocTreeProps {
  items: TableOfContents[];
  onNodeClick?: (pageId: string) => void;
  /** Maps a page id to its group's color + ordinal, for assigned pages. */
  pageGroupInfo?: Map<string, PageGroupInfo>;
}

interface TocNodeProps {
  item: TableOfContents;
  depth: number;
  onNodeClick?: (pageId: string) => void;
  pageGroupInfo?: Map<string, PageGroupInfo>;
}

const TocNode: React.FC<TocNodeProps> = ({
  item,
  depth,
  onNodeClick,
  pageGroupInfo,
}) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = item.children.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `toc-${item.id}`,
    // Dragging a chapter/section brings its whole subtree along, so
    // merging several chapters into one group is a single drag.
    data: { pageIds: collectSubtreeIds(item) },
  });
  const groupInfo = pageGroupInfo?.get(item.id);

  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => onNodeClick?.(item.id)}
        role={onNodeClick ? "button" : undefined}
        tabIndex={onNodeClick ? 0 : undefined}
        style={{
          paddingLeft: `${depth * 0.9}rem`,
          borderLeft: `3px solid ${groupInfo?.color ?? "transparent"}`,
          backgroundColor: groupInfo ? `${groupInfo.color}14` : undefined,
        }}
        className={`flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-sm ${
          groupInfo ? "" : "hover:bg-neutral-100"
        } ${isDragging ? "opacity-40" : ""} ${
          onNodeClick ? "cursor-pointer" : ""
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="shrink-0 rounded p-0.5 hover:bg-neutral-200"
          >
            {expanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="inline-block w-[18px] shrink-0" />
        )}
        <span className="truncate">{item.title}</span>
        {groupInfo && (
          // Color alone doesn't identify a group for a colorblind viewer
          // (and colors repeat past 8 groups) — the shape is the actual
          // identifier, matched 1:1 with the badge on each group card.
          <span
            className="ml-auto flex shrink-0 items-center"
            aria-label={`Group ${groupInfo.index + 1}`}
          >
            <GroupShape index={groupInfo.index} color={groupInfo.color} />
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul>
          {item.children.map((child) => (
            <TocNode
              key={child.id}
              item={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              pageGroupInfo={pageGroupInfo}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const GlossaryConfigTocTree: React.FC<GlossaryConfigTocTreeProps> = ({
  items,
  onNodeClick,
  pageGroupInfo,
}) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        <em>Table of contents unavailable.</em>
      </p>
    );
  }
  return (
    <ul aria-label="Table of contents" className="space-y-0.5">
      {items.map((item) => (
        <TocNode
          key={item.id}
          item={item}
          depth={0}
          onNodeClick={onNodeClick}
          pageGroupInfo={pageGroupInfo}
        />
      ))}
    </ul>
  );
};

export default GlossaryConfigTocTree;
