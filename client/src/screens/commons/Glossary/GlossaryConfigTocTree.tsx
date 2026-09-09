import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { TableOfContents } from "../../../types/Book";
import { collectSubtreeIds } from "./glossaryConfigDefaults";

interface GlossaryConfigTocTreeProps {
  items: TableOfContents[];
  onNodeClick?: (pageId: string) => void;
  /** Pages already assigned to some group — shown with a small marker. */
  assignedPageIds?: Set<string>;
}

interface TocNodeProps {
  item: TableOfContents;
  depth: number;
  onNodeClick?: (pageId: string) => void;
  assignedPageIds?: Set<string>;
}

const TocNode: React.FC<TocNodeProps> = ({
  item,
  depth,
  onNodeClick,
  assignedPageIds,
}) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = item.children.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `toc-${item.id}`,
    // Dragging a chapter/section brings its whole subtree along, so
    // merging several chapters into one group is a single drag.
    data: { pageIds: collectSubtreeIds(item) },
  });
  const assigned = assignedPageIds?.has(item.id);

  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => onNodeClick?.(item.id)}
        role={onNodeClick ? "button" : undefined}
        tabIndex={onNodeClick ? 0 : undefined}
        style={{ paddingLeft: `${depth * 0.9}rem` }}
        className={`flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-neutral-100 ${
          isDragging ? "opacity-40" : ""
        } ${onNodeClick ? "cursor-pointer" : ""}`}
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
        {assigned && (
          <span
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
            title="Assigned to a group"
            aria-hidden
          />
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
              assignedPageIds={assignedPageIds}
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
  assignedPageIds,
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
          assignedPageIds={assignedPageIds}
        />
      ))}
    </ul>
  );
};

export default GlossaryConfigTocTree;
