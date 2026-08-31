import React, { DragEvent } from "react";
import { Icon, List } from "semantic-ui-react";
import { RemixerSubPage } from "../model";
import { CATALOG_NODE_HIGHLIGHT_STYLE } from "../style";

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
  /** Catalog-opened book in the library tree — highlight wraps the node until another book is selected. */
  isCatalogHighlighted?: boolean;
  isBookTree: boolean;
  /** Direct child of the book cover — always shown with a folder icon in the book tree. */
  isBookRootChild?: boolean;
  isInteractionLocked?: boolean;
  isVisualLocked?: boolean;
  itemLink?: string;
  displayTitle: string;
  isDropInside: boolean;
  isDropBefore: boolean;
  isDropAfter: boolean;
  palette: StatusPalette;
  // Handlers receive the row's `page` so a single stable handler can serve
  // every row (keeps this memoized component's props referentially stable).
  onToggleFolder: (page: RemixerSubPage) => void;
  onDragStart: (page: RemixerSubPage, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (page: RemixerSubPage, event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (page: RemixerSubPage) => void;
  onDrop: (page: RemixerSubPage, event: DragEvent<HTMLDivElement>) => void;
  onSelect: (page: RemixerSubPage) => void;
  onDoubleClick?: (page: RemixerSubPage) => void;
  onContextMenu?: (page: RemixerSubPage, event: React.MouseEvent) => void;
  hideExpandIcon?: boolean;
  children?: React.ReactNode;
}

const TreeNodeContainerComponent: React.FC<TreeNodeContainerProps> = ({
  page,
  isFolder,
  isExpanded,
  isDeleted,
  isImported,
  isRenamed,
  isPlacementChanged,
  isSelected,
  isCatalogHighlighted = false,
  isBookTree,
  isBookRootChild = false,
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
  hideExpandIcon = false,
  children,
}) => {
  return (
    <div
      key={page["@id"]}
      data-node-id={page["@id"]}
      style={{
        marginLeft: TREE_LEVEL_INDENT_PX,
        ...(isCatalogHighlighted ? CATALOG_NODE_HIGHLIGHT_STYLE : {}),
      }}
    >
      <List.Item
        draggable={!isInteractionLocked}
        onDragStart={(event: DragEvent<HTMLDivElement>) => onDragStart(page, event)}
        onDragEnd={onDragEnd}
        onDragOver={(event: DragEvent<HTMLDivElement>) => onDragOver(page, event)}
        onDragLeave={() => onDragLeave(page)}
        onDrop={(event: DragEvent<HTMLDivElement>) => onDrop(page, event)}
        onClick={() => onSelect(page)}
        onDoubleClick={onDoubleClick ? () => onDoubleClick(page) : undefined}
        onContextMenu={
          onContextMenu
            ? (event: React.MouseEvent) => onContextMenu(page, event)
            : undefined
        }
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
          cursor: isVisualLocked ? "default" : "pointer",
          textDecoration: isDeleted ? "line-through" : "none",
        }}
      >
        {isFolder && !hideExpandIcon ? (
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

        <Icon
          name={isFolder || (isBookTree && isBookRootChild) ? "folder" : "file alternate"}
          color="grey"
        />

        {(() => {
          const showLink =
            Boolean(itemLink) &&
            itemLink !== "#" &&
            (!isBookTree || !isImported);
          const titleStyle: React.CSSProperties = {
            whiteSpace: "nowrap",
            fontStyle: isVisualLocked ? "italic" : "normal",
            color: isVisualLocked ? "#6b7280" : "inherit",
            textDecoration: isDeleted ? "line-through" : "none",
          };

          if (!showLink) {
            return (
              <span className="text-base" style={titleStyle}>
                {displayTitle}
              </span>
            );
          }

          // Library tree: title is the link. Book tree: only the icon links.
          if (!isBookTree) {
            return (
              <a
                href={itemLink}
                target="_blank"
                rel="noreferrer"
                className="text-base"
                style={{
                  ...titleStyle,
                  color: undefined,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {displayTitle}
                <Icon
                  name="linkify"
                  style={{ marginLeft: 8, color: "#1e70bf" }}
                />
              </a>
            );
          }

          return (
            <>
              <span className="text-base" style={titleStyle}>
                {displayTitle}
              </span>
           
            </>
          );
        })()}
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
      </List.Item>
      {children}
    </div>
  );
};

// Memoized: rows only re-render when their own props change (e.g. this row
// becomes the drop target or the selection). Without this, every drag-hover
// state change in the parent tree re-rendered the entire node list.
const TreeNodeContainer = React.memo(TreeNodeContainerComponent);

export default TreeNodeContainer;
