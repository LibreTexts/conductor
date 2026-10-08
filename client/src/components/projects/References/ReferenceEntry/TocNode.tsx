import { Text, Tooltip } from "@libretexts/davis-react";
import React, { useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
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

/** 24px targets (WCAG 2.2 target size) around the 14px icons. */
const ICON_CONTROL_CLASS =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-50";

const TocNode: React.FC<TocNodeProps> = ({
  node,
  bookID,
  depth = 0,
  onAddBookPageAsReference,
}) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const [isAdding, setIsAdding] = useState(false);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const childListID = `reference-toc-${bookID}-${node.id}`;

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
        className="flex items-start gap-1 py-0.5"
        style={{ paddingLeft: `${depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={ICON_CONTROL_CLASS}
            aria-label={node.title}
            aria-expanded={expanded}
            aria-controls={expanded ? childListID : undefined}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <IconChevronDown size={14} aria-hidden="true" />
            ) : (
              <IconChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block h-6 w-6 shrink-0" aria-hidden="true" />
        )}
        <Text size="sm" className="min-w-0 break-words pt-0.5">
          {node.title}
        </Text>
        <Tooltip content="Open page in a new tab" placement="bottom">
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className={ICON_CONTROL_CLASS}
            aria-label={`Open ${node.title} (opens in a new tab)`}
          >
            <IconExternalLink size={14} aria-hidden="true" />
          </a>
        </Tooltip>
        <Tooltip content="Add as a reference" placement="bottom">
          <button
            type="button"
            className={ICON_CONTROL_CLASS}
            aria-label={`Add ${node.title} as a reference`}
            aria-busy={isAdding || undefined}
            disabled={isAdding}
            onClick={handleAddReference}
          >
            <IconPlus size={14} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {hasChildren && expanded && (
        <ul className="list-none" id={childListID}>
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
