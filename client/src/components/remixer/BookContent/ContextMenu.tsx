import React from "react";
import { Icon } from "semantic-ui-react";

interface ContextMenuPosition {
  nodeId: string;
  x: number;
  y: number;
}

type ContextMenuAction =
  | "add-above"
  | "add-below"
  | "add-to"
  | "delete"
  | "modify"
  | "duplicate";

interface ContextMenuProps {
  contextMenu: ContextMenuPosition | null;
  canAddSibling: boolean;
  canDuplicate: boolean;
  addAboveLabel: string;
  addToLabel: string;
  addBelowLabel: string;
  onAction: (action: ContextMenuAction) => void;
}

const itemStyle: React.CSSProperties = {
  padding: "8px 16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  canAddSibling,
  canDuplicate,
  addAboveLabel,
  addToLabel,
  addBelowLabel,
  onAction,
}) => {
  if (!contextMenu) return null;

  return (
    <div
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
      {canAddSibling && (
        <div
          style={itemStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => onAction("add-above")}
        >
          <Icon name="arrow up" /> {addAboveLabel}
        </div>
      )}
      <div
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => onAction("add-to")}
      >
        <Icon name="add" /> {addToLabel}
      </div>
      {canAddSibling && (
        <div
          style={itemStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => onAction("add-below")}
        >
          <Icon name="arrow down" /> {addBelowLabel}
        </div>
      )}
      {canDuplicate && (
        <div
          style={itemStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => onAction("duplicate")}
        >
          <Icon name="copy" /> Duplicate
        </div>
      )}
      <div
        style={{
          height: 1,
          background: "#d4d4d5",
          margin: "4px 0",
        }}
      />
      <div
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => onAction("delete")}
      >
        <Icon name="trash alternate" /> Delete
      </div>
      <div
        style={itemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => onAction("modify")}
      >
        <Icon name="edit" /> Modify
      </div>
    </div>
  );
};

export default ContextMenu;
