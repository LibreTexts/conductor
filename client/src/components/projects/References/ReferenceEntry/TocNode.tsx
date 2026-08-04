import { Text, Tooltip } from "@libretexts/davis-react";
import React, { useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconLink,
  IconPlus,
} from "@tabler/icons-react";
import { TableOfContents } from "../../../../types";

type TocNodeProps = {
  node: TableOfContents;
  bookID: string;
  depth?: number;
  onAddBookPageAsReference: (data: {
    bookID: string;
    pageID: string;
  }) => Promise<boolean>;
};

const TocNode: React.FC<TocNodeProps> = ({
  node,
  bookID,
  depth = 0,
  onAddBookPageAsReference,
}) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const [isAdding, setIsAdding] = useState(false);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const handleAddReference = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await onAddBookPageAsReference({
        bookID,
        pageID: node.id,
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <li>
      <div
        className="flex items-start gap-1 py-1"
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 text-neutral-500 hover:text-neutral-800"
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="mt-0.5 inline-block w-3.5 shrink-0" />
        )}
        <Text size="sm" className="min-w-0 break-words">
          {node.title}
        </Text>
        <Tooltip content="Open in new tab" placement="bottom">
          <button
            type="button"
            className="mt-0.5 shrink-0 text-neutral-500 hover:text-neutral-800"
            aria-label="Open in new tab"
            onClick={() => window.open(node.url, "_blank")}
          >
            <IconLink size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Add reference" placement="bottom">
          <button
            type="button"
            className="mt-0.5 shrink-0 text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
            aria-label="Add reference"
            disabled={isAdding}
            onClick={handleAddReference}
          >
            <IconPlus size={14} />
          </button>
        </Tooltip>
      </div>
      {hasChildren && expanded && (
        <ul className="list-none">
          {node.children.map((child) => (
            <TocNode
              key={child.id}
              node={child}
              bookID={bookID}
              depth={depth + 1}
              onAddBookPageAsReference={onAddBookPageAsReference}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default TocNode;
