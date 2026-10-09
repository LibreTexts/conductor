import React, { useEffect, useRef } from "react";
import { Icon, SemanticICONS } from "semantic-ui-react";

interface ContextMenuPosition {
  nodeId: string;
  x: number;
  y: number;
  /** Element that opened the menu (row Actions button); focus returns here on close. */
  returnFocusTo?: HTMLElement | null;
}

type ContextMenuAction =
  | "add-above"
  | "add-below"
  | "add-to"
  | "delete"
  | "restore"
  | "modify"
  | "duplicate";

interface ContextMenuProps {
  contextMenu: ContextMenuPosition | null;
  canAddSibling: boolean;
  /** False for core matter pages, which can't hold children. */
  canAddChild?: boolean;
  canDuplicate: boolean;
  /** Shown (disabled) when duplicating isn't allowed, so the option list is the same for every item. */
  duplicateUnavailableReason?: string;
  isDeleted: boolean;
  addAboveLabel: string;
  addToLabel: string;
  addBelowLabel: string;
  /** Accessible name of the menu, e.g. "Actions for Chapter 1". */
  label: string;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

const itemClass =
  "flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[#f0f0f0] focus:bg-[#f0f0f0] focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent";

/**
 * Tree item actions, opened by right-click or by a row's Actions button.
 * Follows the ARIA menu pattern: focus moves into the menu on open,
 * Up/Down/Home/End move between items, Escape and Tab close it, and focus
 * returns to the button that opened it.
 */
const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  canAddSibling,
  canAddChild = true,
  canDuplicate,
  duplicateUnavailableReason,
  isDeleted,
  addAboveLabel,
  addToLabel,
  addBelowLabel,
  label,
  onAction,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the first item whenever the menu opens (or moves to another item).
  useEffect(() => {
    if (!contextMenu) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [contextMenu]);

  if (!contextMenu) return null;

  const close = () => {
    const target = contextMenu.returnFocusTo;
    onClose();
    if (target?.isConnected) {
      requestAnimationFrame(() => target.focus());
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      ) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) =>
      items[(i + items.length) % items.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
      case "Tab":
        event.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  const item = (
    action: ContextMenuAction,
    icon: SemanticICONS,
    text: string,
    disabled = false,
  ) => (
    <button
      type="button"
      role="menuitem"
      className={itemClass}
      disabled={disabled}
      onClick={(event) => {
        // The window-level click listener would also dismiss; stop it so the
        // action runs before the menu state is cleared.
        event.stopPropagation();
        onAction(action);
        const target = contextMenu.returnFocusTo;
        if (target?.isConnected) {
          requestAnimationFrame(() => {
            // Only reclaim focus if the action didn't move it (e.g. a modal).
            if (document.activeElement === document.body) target.focus();
          });
        }
      }}
    >
      <Icon name={icon} aria-hidden="true" /> {text}
    </button>
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 1000,
        background: "#fff",
        border: "1px solid #d4d4d5",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        minWidth: 150,
        padding: "4px 0",
      }}
    >
      {canAddSibling && item("add-above", "arrow up", addAboveLabel)}
      {canAddChild && item("add-to", "add", addToLabel)}
      {canAddSibling && item("add-below", "arrow down", addBelowLabel)}
      {canDuplicate
        ? item("duplicate", "copy", "Duplicate")
        : item(
            "duplicate",
            "copy",
            `Duplicate${duplicateUnavailableReason ? ` (${duplicateUnavailableReason})` : ""}`,
            true,
          )}
      <div
        role="separator"
        style={{
          height: 1,
          background: "#d4d4d5",
          margin: "4px 0",
        }}
      />
      {isDeleted
        ? item("restore", "undo", "Restore")
        : item("delete", "trash alternate", "Delete")}
      {item("modify", "edit", "Modify")}
    </div>
  );
};

export default ContextMenu;
