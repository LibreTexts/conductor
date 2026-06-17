import React, { useState, useEffect } from "react";
import { Icon, List } from "semantic-ui-react";
import { IconPlus } from "@tabler/icons-react";
import { TableOfContents } from "../../../types/Book";

interface TOCTreeViewProps {
  items: TableOfContents[];
  expandAll?: boolean;
  onNodeClick: (nodeId: string) => void;
}

interface TOC {
  item: TableOfContents;
  parentKey: number;
  expandAll?: boolean;
  onNodeClick: (nodeId: string) => void;
}

const TOCTreeNode: React.FC<TOC> = ({ item, parentKey, expandAll, onNodeClick }) => {
  const [expanded, setExpanded] = useState(expandAll ?? false);

  useEffect(() => {
    if (typeof expandAll === "boolean") {
      setExpanded(expandAll);
    }
  }, [expandAll]);

  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  return (
    <List.Item>
      <Icon
        name={
          hasChildren ? (expanded ? "caret down" : "caret right") : "circle"
        }
        size={hasChildren ? undefined : "tiny"}
        onClick={() => setExpanded((e) => !e)}
        className={hasChildren ? "cursor-pointer" : "!align-middle"}
      />
      <List.Content
        onDoubleClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          window.open(item.url, "_blank");
        }}
        
      >
        <List.Header onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onNodeClick(item.id);
        }}>
          <span className="group/node inline-flex items-center gap-1 cursor-pointer hover:underline">
            {item.title}
            <IconPlus
              size={20}
              className="opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 text-info-500"
              aria-hidden
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
                expandAll={expandAll}
                onNodeClick={onNodeClick}
              />
            ))}
          </List.List>
        )}
      </List.Content>
    </List.Item>
  );
};

const TOCTreeView: React.FC<TOCTreeViewProps> = ({ items, expandAll, onNodeClick }) => {
  if (!Array.isArray(items) || items.length === 0) return <List relaxed />;

  return (
    <div className="glossary-tree-view">
      <List relaxed>
        {items.map((item, idx) => (
          <TOCTreeNode
            key={`glossary-node-${idx}`}
            parentKey={idx}
            item={item}
            expandAll={expandAll}
            onNodeClick={onNodeClick}
          />
        ))}
      </List>
    </div>
  );
};

export default TOCTreeView;
