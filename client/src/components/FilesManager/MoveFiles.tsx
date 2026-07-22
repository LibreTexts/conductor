import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { Button, Modal } from "@libretexts/davis-react";
import { IconFile, IconFolder } from "@tabler/icons-react";
import FileTree from "../FileTree";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { _MoveFile, _MoveFileWithChildren } from "../../types";
import LoadingSpinner from "../LoadingSpinner";


interface MoveFilesProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
  files: _MoveFile[];
  currentDirectory?: string;
  onFinishedMove: () => void;
}

/**
 * Modal tool to move Project Files between folders in the set.
 */
const MoveFiles: React.FC<MoveFilesProps> = ({
  show,
  onClose,
  projectID,
  files,
  currentDirectory,
  onFinishedMove,
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locations, setLocations] = useState<_MoveFileWithChildren[]>([]);

  /**
   * Retrieve the list of Files for the server, determine which are valid new locations
   * for the provided Files, and save the hierarchy to state.
   */
  const getMoveLocations = useCallback(async () => {
    try {
      setLoadingLocs(true);
      const locsRes = await api.getProjectFiles(projectID, currentDirectory);
      if (locsRes.data.err) {
        throw locsRes.data.errMsg;
      }

      const foundLocs = locsRes.data.files;
      if (!Array.isArray(foundLocs)) {
        throw new Error("Invalid response from server.");
      }
      const selectedIDs = files.map((obj) => obj.fileID);

      const filterRecursive = (arr: (_MoveFile | _MoveFileWithChildren)[]) => {
        let passes: _MoveFileWithChildren[] = [];
        arr.forEach((obj) => {
          if (
            obj.storageType === "folder" &&
            !selectedIDs.includes(obj.fileID)
          ) {
            let _children: _MoveFileWithChildren[] = [];
            if ("children" in obj && Array.isArray(obj.children)) {
              _children = filterRecursive(obj.children);
            }
            passes.push({
              ...obj,
              disabled: obj.fileID === currentDirectory,
              children: _children,
            });
          }
        });
        return passes;
      };

      const enabledFolders: _MoveFileWithChildren[] = [
        {
          fileID: "",
          name: "Root",
          storageType: "folder",
          description: "",
          children: filterRecursive(foundLocs),
          disabled: currentDirectory === "",
        },
      ];

      setLocations(enabledFolders);
      setLoadingLocs(false);
    } catch (e) {
      setLoadingLocs(false);
      handleGlobalError(e);
    }
  }, [
    files,
    currentDirectory,
    projectID,
    setLoadingLocs,
    setLocations,
    handleGlobalError,
  ]);

  /**
   * Load potential locations on open.
   */
  useEffect(() => {
    if (show) {
      getMoveLocations();
    }
  }, [show, getMoveLocations]);

  /**
   * Submit the move request(s) to the server, then call the provided completion handler.
   */
  async function handleMove(targetID: string) {
    setLoading(true);
    try {
      for (let i = 0, n = files.length; i < n; i += 1) {
        const currFile = files[i];
        const moveRes = await axios.put(
          `/project/${projectID}/files/${currFile.fileID}/move`,
          { newParent: targetID }
        );
        if (moveRes.data.err) {
          throw new Error(moveRes.data.errMsg);
        }
      }
      setLoading(false);
      onFinishedMove();
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal open={show} onClose={() => onClose()} size="xl">
      <Modal.Header>
        <Modal.Title>Move Files</Modal.Title>
      </Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-y-auto">
        {!loading ? (
          <>
            <p>Select a new location for the following files:</p>
            <ul className="my-8 space-y-2">
              {files.map((obj) => (
                <li key={obj.fileID} className="flex items-center gap-2">
                  {obj.storageType === "folder" ? (
                    <IconFolder size={20} aria-hidden="true" />
                  ) : (
                    <IconFile size={20} aria-hidden="true" />
                  )}
                  <span>{obj.name}</span>
                </li>
              ))}
            </ul>
            <hr className="my-6 border-gray-200" />
            {!loadingLocs ? (
              <FileTree
                items={locations}
                onFolderActionClick={handleMove}
                folderAction={
                  <Button variant="primary" size="sm" className="ml-2">
                    Move here
                  </Button>
                }
              />
            ) : (
              <LoadingSpinner />
            )}
          </>
        ) : (
          <LoadingSpinner />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MoveFiles;
