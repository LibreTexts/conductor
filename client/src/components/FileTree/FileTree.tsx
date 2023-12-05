import React from "react";
import FileTreeNode from "./FileTreeNode";
import styles from "./FileTree.module.css";
import { _MoveFileWithChildren } from "../../types";

interface FileTreeProps {
  items: _MoveFileWithChildren[];
  onFileNameClick?: (id: string) => void;
  onFileActionClick?: (id: string) => void;
  onFolderActionClick?: (id: string) => void;
  fileAction?: React.ReactNode;
  folderAction?: React.ReactNode;
  fileDisabledAction?: React.ReactNode;
  folderDisabledAction?: React.ReactNode;
}

/**
 * A visual representation of a file system hierarchy, with folders, files, and nested hierarchies.
 */
const FileTree: React.FC<FileTreeProps> = ({
  items,
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
          key={entry.fileID}
          item={entry}
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

export default FileTree;
