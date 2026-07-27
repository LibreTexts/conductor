import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon, List } from "semantic-ui-react";
import { IconDownload, IconExternalLink, IconPlus } from "@tabler/icons-react";
import { TableOfContents } from "../../../types/Book";

interface TOCTreeViewProps {
  items: TableOfContents[];
  expandAll?: boolean;
  storageKey?: string;
  onNodeClick: (nodeId: string) => void;
  bookId?: string;
  onImportGlossary?: (auxGlossaryID: string, augGlossaryParentID?: string) => void;
  importingGlossary?: boolean;
}

interface TOC {
  item: TableOfContents;
  parentKey: number;
  parentId?: string;
  expandedIds: Set<string>;
  onToggle: (nodeId: string) => void;
  onNodeClick: (nodeId: string) => void;
  onImportGlossary?: (auxGlossaryID: string, augGlossaryParentID?: string) => void;
  importingGlossary?: boolean;
}

function collectIdsWithChildren(items: TableOfContents[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: TableOfContents[]) => {
    for (const node of nodes) {
      if (Array.isArray(node.children) && node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(items);
  return ids;
}

function readExpandedIds(storageKey?: string): Set<string> {
  if (!storageKey || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeExpandedIds(storageKey: string | undefined, ids: Set<string>) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // Ignore quota / private-mode failures
  }
}

const TOCTreeNode: React.FC<TOC> = ({
  item,
  parentKey,
  expandedIds,
  onToggle,
  onNodeClick,
  parentId,
  onImportGlossary,
  importingGlossary,
}) => {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const expanded = hasChildren && expandedIds.has(item.id);

  return (
    <List.Item>
      <Icon
        name={
          hasChildren ? (expanded ? "caret down" : "caret right") : "circle"
        }
        size={hasChildren ? undefined : "tiny"}
        onClick={() => {
          if (hasChildren) onToggle(item.id);
        }}
        className={hasChildren ? "cursor-pointer" : "!align-middle"}
      />
      <List.Content
        onDoubleClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          window.open(item.url, "_blank");
        }}
      >
        <List.Header
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onNodeClick(item.id);
          }}
        >
          <span className="group/node inline-flex items-center gap-1 cursor-pointer hover:underline">
            {item.title}
            <IconPlus
              size={20}
              className="opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 text-info-500"
              aria-hidden
            />
            <IconExternalLink
              size={20}
              className="opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 text-info-500"
              aria-hidden
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                window.open(item.url, "_blank");
              }}
            />
            <IconDownload
              size={20}
              className={`opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 text-info-500 ${
                importingGlossary ? "pointer-events-none opacity-40" : ""
              }`}
              aria-hidden
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onImportGlossary?.(item.id, parentId);
              }}
            />
          </span>
        </List.Header>
        {hasChildren && expanded && (
          <List.List>
            {item.children.map((child, idx) => (
              <TOCTreeNode
                key={`glossary-node-${parentKey}-${idx}`}
                parentKey={idx}
                item={child}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onNodeClick={onNodeClick}
                parentId={item.id}
                onImportGlossary={onImportGlossary}
                importingGlossary={importingGlossary}
              />
            ))}
          </List.List>
        )}
      </List.Content>
    </List.Item>
  );
};

const TOCTreeView: React.FC<TOCTreeViewProps> = ({
  items,
  expandAll,
  storageKey,
  onNodeClick,
  bookId,
  onImportGlossary,
  importingGlossary,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    readExpandedIds(storageKey),
  );

  // Re-hydrate when the storage key changes (e.g. navigating between books)
  useEffect(() => {
    setExpandedIds(readExpandedIds(storageKey));
  }, [storageKey]);

  // Expand/collapse all only when the parent control actually changes
  const prevExpandAll = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (typeof expandAll !== "boolean") return;
    if (prevExpandAll.current === undefined) {
      prevExpandAll.current = expandAll;
      return;
    }
    if (prevExpandAll.current === expandAll) return;
    prevExpandAll.current = expandAll;

    const next = expandAll
      ? new Set(collectIdsWithChildren(items))
      : new Set<string>();
    writeExpandedIds(storageKey, next);
    setExpandedIds(next);
  }, [expandAll, items, storageKey]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        writeExpandedIds(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  if (!Array.isArray(items) || items.length === 0) return <List relaxed />;

  return (
    <div className="glossary-tree-view">
      <List relaxed>
        {items.map((item, idx) => (
          <TOCTreeNode
            key={`glossary-node-${idx}`}
            parentKey={idx}
            item={item}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onNodeClick={onNodeClick}
            parentId={bookId}
            onImportGlossary={onImportGlossary}
            importingGlossary={importingGlossary}
          />
        ))}
      </List>
    </div>
  );
};

export default TOCTreeView;
