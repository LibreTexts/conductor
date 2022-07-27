import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Icon } from 'semantic-ui-react';
import FileIcon from '../FileIcon';
import styles from './FileTree.module.css';

/**
 * Represents an item in a file system structure. Nodes can have
 * parent nodes and/or have child nodes.
 */
const FileTreeNode = ({
  item,
  identifierKey,
  typeKey,
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
  const isFolder = (item[typeKey] === "folder" || hasChildren);

  /**
   * Toggles the child list show/hide state.
   */
  function handleToggleExpand() {
    setExpanded(!expanded);
  };

  const liProps = {
    key: item[identifierKey],
    role: "treeitem",
    ...(hasChildren && {
      'aria-expanded': expanded,
    }),
    ...props,
  };

  if (isFolder) {
    return (
      <li {...liProps}>
        <span>
          {hasChildren && (
            <Icon
              name={expanded ? 'caret down' : 'caret right'}
              onClick={handleToggleExpand}
              className={styles.folder_expand_icon}
            />
          )}
          <Icon name="folder outline" />
          {item.name}
          {!disabled ? (
            <div
              onClick={() => onFolderActionClick(item[identifierKey])}
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
        <ul className={!expanded ? styles.hidden_files : ''} role="group">
          {item.children?.map((child) => (
            <FileTreeNode
              key={child[identifierKey]}
              item={child}
              identifierKey={identifierKey}
              typeKey={typeKey}
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
      <span>{item.name}</span>
      {!disabled ? (
        <div
          onClick={() => onFileActionClick(item[identifierKey])}
          className={styles.node_action_wrapper}
        >
          {fileAction}
        </div>
      ) : (
        <div className={styles.node_action_wrapper}>
          {fileDisabledAction}
        </div>
      )}
    </li>
  );
};

FileTreeNode.propTypes = {
  /**
   * The file or folder to represent with the node.
   */
  item: PropTypes.object.isRequired,
  /**
   * Object key that returns the node's unique identifier.
   */
  identifierKey: PropTypes.string.isRequired,
  /**
   * Object key that returns the node's type ("file" or "folder").
   */
  typeKey: PropTypes.string.isRequired,
  /**
   * Handler to activate when a file-type node's action is clicked.
   * Passes the node's identifier value as the first argument.
   */
  onFileActionClick: PropTypes.func,
  /**
   * Handler to activate when a folder-type node's action is clicked.
   * Passes the node's identifier value as the first argument.
   */
  onFolderActionClick: PropTypes.func,
  /**
   * Indicates the user should not be able to open/download the file.
   */
  disabled: PropTypes.bool,
  /**
   * Element(s) to render next to a file name (if file is enabled).
   */
  fileAction: PropTypes.node,
  /**
   * Element(s) to render next to a folder name (if folder is enabled).
   */
  folderAction: PropTypes.node,
  /**
   * Element(s) to render next to a file name (if folder is disabled).
   */
  fileDisabledAction: PropTypes.node,
  /**
   * Element(s) to render next to a folder name (if folder is disabled).
   */
  folderDisabledAction: PropTypes.node,
};

FileTreeNode.defaultProps = {
  onFileActionClick: () => { },
  onFolderActionClick: () => { },
  // don't provide null default props for node actions - prop type checking throws error
};

export default FileTreeNode;
