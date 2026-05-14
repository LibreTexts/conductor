import React, { DragEvent } from "react";
import { Icon, List } from "semantic-ui-react";
import { RemixerSubPage } from "../model";

interface StatusPalette {
  info: string;
  infoBg: string;
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
}

/** Pixels added per tree level. Nested wrappers stack this once per depth (no compounding). */
export const TREE_LEVEL_INDENT_PX = 12;

interface TreeNodeContainerProps {
  page: RemixerSubPage;
  isFolder: boolean;
  isExpanded: boolean;
  isDeleted: boolean;
  isImported: boolean;
  isRenamed: boolean;
  isPlacementChanged: boolean;
  isSelected: boolean;
  isBookTree: boolean;
  isInteractionLocked?: boolean;
  isVisualLocked?: boolean;
  itemLink?: string;
  displayTitle: string;
  isDropInside: boolean;
  isDropBefore: boolean;
  isDropAfter: boolean;
  palette: StatusPalette;
  onToggleFolder: (page: RemixerSubPage) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  children?: React.ReactNode;
}

const TreeNodeContainer: React.FC<TreeNodeContainerProps> = ({
  page,
  isFolder,
  isExpanded,
  isDeleted,
  isImported,
  isRenamed,
  isPlacementChanged,
  isSelected,
  isBookTree,
  isInteractionLocked = false,
  isVisualLocked = false,
  itemLink,
  displayTitle,
  isDropInside,
  isDropBefore,
  isDropAfter,
  palette,
  onToggleFolder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
  onDoubleClick,
  onContextMenu,
  children,
}) => {
  return (
    <div key={page["@id"]} data-node-id={page["@id"]} style={{ marginLeft: TREE_LEVEL_INDENT_PX }}>
      <List.Item
        draggable={!isInteractionLocked}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 0",
          opacity: isVisualLocked ? 0.6 : 1,
          background: isDropInside
            ? palette.infoBg
            : isDeleted
              ? palette.errorBg
              : isImported
                ? palette.successBg
                : isRenamed || isPlacementChanged || page.movedItem === true
                  ? palette.warningBg
                  : "transparent",
          borderTop: isDropBefore
            ? `2px solid ${palette.info}`
            : "2px solid transparent",
          borderBottom: isDropAfter
            ? `2px solid ${palette.info}`
            : "2px solid transparent",
          borderRadius: 4,
          outline: isSelected ? `2px solid ${palette.info}` : "none",
          cursor: isVisualLocked ? "not-allowed" : "pointer",
          textDecoration: isDeleted ? "line-through" : "none",
        }}
      >
        {isFolder ? (
          <span
            style={{ cursor: "pointer", width: 12 }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFolder(page);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <Icon name={isExpanded ? "caret down" : "caret right"} />
          </span>
        ) : (
          <span style={{ width: 12 }} />
        )}

        <Icon name={isFolder ? "folder" : "file alternate"} color="grey" />

        <span
          style={{
            whiteSpace: "nowrap",
            fontStyle: isVisualLocked ? "italic" : "normal",
            color: isVisualLocked ? "#6b7280" : "inherit",
          }}
        >
          {displayTitle}
          {isDeleted && (
            <Icon
              name="trash"
              color="grey"
              style={{ marginLeft: 6,  size: "small" }}
              title="Deleted"
            />
          )}
          {(isRenamed ||
            isPlacementChanged ||
            page.movedItem) && (
              <Icon
                name="sync"
                color="grey"
                style={{
                  marginLeft: 6,
                  // verticalAlign: "middle",
                  size: "small",
                }}
                title="Modified, moved, renamed"
              />
            )}
          {isImported && (
            <Icon
              name="add circle"
              color="grey"
              style={{ marginLeft: 6,  size: "small" }}
              title="Imported, added"
            />
          )}
        </span>
        {!isBookTree && itemLink ? (
          <a
            href={itemLink}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 8, color: "#1e70bf" }}
            onClick={(event) => event.stopPropagation()}
          >
            <Icon name="linkify" />
          </a>
        ) : null}
      </List.Item>
      {children}
    </div>
  );
};

export default TreeNodeContainer;
