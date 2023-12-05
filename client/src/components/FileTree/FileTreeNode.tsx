import React, { useState } from "react";
import PropTypes from "prop-types";
import { Icon, Popup } from "semantic-ui-react";
import FileIcon from "../FileIcon";
import styles from "./FileTree.module.css";
import { _MoveFileWithChildren } from "../../types";

interface FileTreeNodeProps {
  item: _MoveFileWithChildren;
  onFileNameClick?: (id: string) => void;
  onFileActionClick?: (id: string) => void;
  onFolderActionClick?: (id: string) => void;
  disabled: boolean;
  fileAction?: React.ReactNode;
  folderAction?: React.ReactNode;
  fileDisabledAction?: React.ReactNode;
  folderDisabledAction?: React.ReactNode;
}

/**
 * Represents an item in a file system structure. Nodes can have
 * parent nodes and/or have child nodes.
 */
const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  item,
  onFileNameClick,
  onFileActionClick,
  onFolderActionClick,
  disabled,
  fileAction,
  folderAction,
  fileDisabledAction,
  folderDisabledAction,
  ...props
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isFolder = item.storageType === "folder" || hasChildren;

  /**
   * Toggles the child list show/hide state.
   */
  function handleToggleExpand() {
    setExpanded(!expanded);
  }

  const liProps = {
    key: item.fileID,
    role: "treeitem",
    ...(hasChildren && {
      "aria-expanded": expanded,
    }),
    ...props,
  };

  const description = item.description ? (
    <Popup
      trigger={
        <Icon
          name="info"
          color="grey"
          className={`cursor-pointer ${styles.file_info_icon}`}
          size="small"
        />
      }
      position="top center"
      content={<p className="text-center">{item.description}</p>}
    />
  ) : null;

  if (isFolder) {
    return (
      <li {...liProps}>
        <span>
          {hasChildren && (
            <Icon
              name={expanded ? "caret down" : "caret right"}
              onClick={handleToggleExpand}
              className={styles.folder_expand_icon}
            />
          )}
          <Icon name="folder outline" />
          <span>{item.name}</span>
          {description}
          {!disabled ? (
            <div
              onClick={() =>
                onFolderActionClick ? onFolderActionClick(item.fileID) : null
              }
              className={styles.node_action_wrapper}
            >
              {folderAction}
            </div>
          ) : (
            <div className={styles.node_action_wrapper}>
              {folderDisabledAction}
            </div>
          )}
        </span>
        <ul className={!expanded ? styles.hidden_files : ""} role="group">
          {item.children?.map((child) => (
            <FileTreeNode
              key={child.fileID}
              item={child}
              onFileNameClick={onFileNameClick}
              onFileActionClick={onFileActionClick}
              onFolderActionClick={onFolderActionClick}
              disabled={child.disabled}
              fileAction={fileAction}
              folderAction={folderAction}
              fileDisabledAction={fileDisabledAction}
              folderDisabledAction={folderDisabledAction}
            />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li {...liProps}>
      <FileIcon filename={item.name} />
      {!disabled ? (
        <>
          {onFileNameClick ? (
            <button
              onClick={() =>
                onFileNameClick ? onFileNameClick(item.fileID) : null
              }
              title={`Download ${item.name} (opens in new tab)`}
              className="button-text-link"
            >
              {item.name}
            </button>
          ) : (
            <span>{item.name}</span>
          )}
          {description}
          <div
            onClick={() =>
              onFileActionClick ? onFileActionClick(item.fileID) : null
            }
            className={styles.node_action_wrapper}
          >
            {fileAction}
          </div>
        </>
      ) : (
        <>
          <span>{item.name}</span>
          {description}
          <div className={styles.node_action_wrapper}>{fileDisabledAction}</div>
        </>
      )}
    </li>
  );
};

export default FileTreeNode;
