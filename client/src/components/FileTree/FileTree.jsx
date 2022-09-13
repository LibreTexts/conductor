import React from 'react';
import PropTypes from 'prop-types';
import FileTreeNode from './FileTreeNode';
import styles from './FileTree.module.css';

/**
 * A visual representation of a file system hierarchy, with folders, files, and nested hierarchies.
 */
const FileTree = ({
  items,
  nodeIdentifierKey,
  nodeTypeKey,
  onFileNameClick,
  onFileActionClick,
  onFolderActionClick,
  fileAction,
  folderAction,
  fileDisabledAction,
  folderDisabledAction,
  ...props
}) => {
  return (
    <ul className={styles.filetree} role="tree" {...props}>
      {items.map((entry) => (
        <FileTreeNode
          key={entry[nodeIdentifierKey]}
          item={entry}
          identifierKey={nodeIdentifierKey}
          typeKey={nodeTypeKey}
          onFileNameClick={onFileNameClick}
          onFileActionClick={onFileActionClick}
          onFolderActionClick={onFolderActionClick}
          disabled={entry.disabled}
          fileAction={fileAction}
          folderAction={folderAction}
          fileDisabledAction={fileDisabledAction}
          folderDisabledAction={folderDisabledAction}
        />
      ))}
    </ul>
  );
};

FileTree.propTypes = {
  /**
   * Files and folders in the tree.
   */
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  /**
   * Object key that returns a tree node's unique identifier.
   */
  nodeIdentifierKey: PropTypes.string.isRequired,
  /**
   * Object key that returns the node's type ("file" or "folder").
   */
  nodeTypeKey: PropTypes.string.isRequired,
  /**
   * Handler to activate when a file-type node's name is clicked.
   * Passes the node's identifier value as the first argument.
   */
  onFileNameClick: PropTypes.func,
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

FileTree.propTypes = {
  onFileNameClick: () => { },
  onFileActionClick: () => { },
  onFolderActionClick: () => { },
  // don't provide null default props for node actions - prop type checking throws error
};

export default FileTree;
