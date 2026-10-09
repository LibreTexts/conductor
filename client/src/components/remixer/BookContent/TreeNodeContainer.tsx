import React, { DragEvent } from "react";
import { Tooltip } from "@libretexts/davis-react";
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

/**
 * Change-status icon with an accessible name. The Semantic `Icon` renders
 * `aria-hidden`, so a `title` on it was never announced; the wrapper carries
 * the name instead.
 */
const StatusIcon: React.FC<{
  icon: "trash" | "sync" | "add circle";
  label: string;
}> = ({ icon, label }) => (
  <span role="img" aria-label={label} style={{ marginLeft: 6 }}>
    <Icon name={icon} color="grey" aria-hidden="true" style={{ margin: 0 }} />
  </span>
);

/** Keyboard-focusable route to the row's context menu. */
export const RowActionsButton: React.FC<{
  title: string;
  onOpen: (trigger: HTMLElement) => void;
}> = ({ title, onOpen }) => (
  <button
    type="button"
    aria-haspopup="menu"
    aria-label={`Actions for ${title}`}
    className="ml-1 inline-flex shrink-0 items-center justify-center rounded text-gray-700 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    style={{ width: 24, height: 24, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
    onClick={(event) => {
      event.stopPropagation();
      onOpen(event.currentTarget);
    }}
    onDoubleClick={(event) => event.stopPropagation()}
  >
    <Icon name="ellipsis vertical" aria-hidden="true" style={{ margin: 0 }} />
  </button>
);

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
  /** When set, the trash icon on a deleted row becomes a Restore button. */
  onRestore?: (page: RemixerSubPage) => void;
  /**
   * When set, the row shows an "Actions for …" button that opens the same
   * menu as right-click, so the actions are reachable from the keyboard.
   */
  onOpenActions?: (page: RemixerSubPage, trigger: HTMLElement) => void;
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
  onRestore,
  onOpenActions,
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
        }}
      >
        {isFolder && !hideExpandIcon ? (
          // A real button so expand/collapse works from the keyboard.
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${displayTitle}`}
            className="inline-flex shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            style={{
              width: 16,
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
            }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFolder(page);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <Icon
              name={isExpanded ? "caret down" : "caret right"}
              style={{ margin: 0 }}
              aria-hidden="true"
            />
          </button>
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
                  aria-hidden="true"
                  style={{ marginLeft: 8, color: "#1e70bf" }}
                />
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            );
          }

          // Icon-only link: it needs its own accessible name.
          return (
            <>
              <span className="text-base" style={titleStyle}>
                {displayTitle}
              </span>
              <a
                href={itemLink}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${displayTitle} (opens in new tab)`}
                onClick={(event) => event.stopPropagation()}
              >
                <Icon
                  name="linkify"
                  aria-hidden="true"
                  style={{ marginLeft: 8, color: "#1e70bf" }}
                />
              </a>
            </>
          );
        })()}
        {isDeleted &&
          (onRestore ? (
            <Tooltip
              content="Marked for deletion. Click to restore this item and everything under it."
              placement="left"
            >
              <button
                type="button"
                aria-label={`Restore ${displayTitle}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRestore(page);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                style={{
                  marginLeft: 6,
                  padding: "1px 8px",
                  border: `1px solid ${palette.error}`,
                  borderRadius: 4,
                  background: "#ffffff",
                  color: palette.error,
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: "18px",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="undo" style={{ margin: 0 }} aria-hidden="true" />
                Restore
              </button>
            </Tooltip>
          ) : (
            <StatusIcon icon="trash" label="Deleted" />
          ))}
        {!isDeleted &&
          (isRenamed ||
          isPlacementChanged ||
          page.movedItem) && (
            <StatusIcon icon="sync" label="Modified (moved or renamed)" />
          )}
        {isImported && <StatusIcon icon="add circle" label="Added" />}
        {onOpenActions && (
          <RowActionsButton
            title={displayTitle}
            onOpen={(trigger) => onOpenActions(page, trigger)}
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
