import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Button, Icon, Divider, Loader } from 'semantic-ui-react';
import FileIcon from '../FileIcon';
import FileTree from '../FileTree';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to move Project Files between folders in the set.
 */
const MoveFiles = ({ show, onClose, projectID, files, currentDirectory, onFinishedMove }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locations, setLocations] = useState([]);

  /**
   * Retrieve the list of Files for the server, determine which are valid new locations
   * for the provided Files, and save the hierarchy to state.
   */
  const getMoveLocations = useCallback(async () => {
    try {
      setLoadingLocs(true);
      const locsRes = await axios.get(`/project/${projectID}/files`);
      if (!locsRes.data.err) {
        const foundLocs = locsRes.data.files;
        if (Array.isArray(foundLocs)) {
          const selectedIDs = files.map((obj) => obj.fileID);
          const filterRecursive = (arr) => {
            let passes = [];
            arr.forEach((obj) => {
              if (obj.storageType === 'folder' && !selectedIDs.includes(obj.fileID)) {
                let children = [];
                if (Array.isArray(obj.children)) {
                  children = filterRecursive(obj.children);
                }
                passes.push({
                  ...obj,
                  disabled: obj.fileID === currentDirectory,
                  children,
                });
              }
            });
            return passes;
          };
          const enabledFolders = [{
            fileID: '',
            name: 'Root',
            storageType: 'folder',
            children: filterRecursive(foundLocs),
            disabled: currentDirectory === '',
          }];
          setLocations(enabledFolders);
        }
        setLoadingLocs(false);
      } else {
        throw (new Error(locsRes.data.errMsg));
      }
    } catch (e) {
      setLoadingLocs(false);
      handleGlobalError(e);
    }
  }, [files, currentDirectory, projectID, setLoadingLocs, setLocations, handleGlobalError]);

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
  async function handleMove(targetID) {
    setLoading(true);
    try {
      for (let i = 0, n = files.length; i < n; i += 1) {
        const currFile = files[i];
        const moveRes = await axios.put(
          `/project/${projectID}/files/${currFile.fileID}/move`,
          { newParent: targetID },
        );
        if (moveRes.data.err) {
          throw (new Error(moveRes.data.errMsg));
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
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Move Files</Modal.Header>
      <Modal.Content scrolling>
        {!loading ? (
          <>
            <p>Select a new location for the following files:</p>
            <ul>
              {files.map((obj) => (
                <li key={obj.fileID}>
                  {obj.storageType === 'folder' ? (
                    <Icon name="folder outline" />
                  ) : (
                    <FileIcon filename={obj.name} />
                  )}
                  {obj.name}
                </li>
              ))}
            </ul>
            <Divider className="mb-2r" />
            {!loadingLocs ? (
              <FileTree
                items={locations}
                nodeIdentifierKey="fileID"
                nodeTypeKey="storageType"
                onFolderActionClick={handleMove}
                folderAction={(
                  <Button color="green" size="small" compact className="ml-1e">
                    Move here
                  </Button>
                )}
              />
            ) : (
              <Loader active inline="centered" className="mt-2r mb-2r" />
            )}
          </>
        ) : (
          <Loader active inline="centered" className="mt-2r mb-2r" />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
      </Modal.Actions>
    </Modal>
  )
};

MoveFiles.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the project files belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Array of files to be deleted.
   */
  files: PropTypes.arrayOf(PropTypes.shape({
    fileID: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    storageType: PropTypes.string.isRequired,
  })).isRequired,
  /**
   * Identifier of the directory the modal was opened in the context of.
   */
  currentDirectory: PropTypes.string,
  /**
   * Handler to activate when the given files(s) have been moved.
   */
  onFinishedMove: PropTypes.func,
};

MoveFiles.defaultProps = {
  onClose: () => { },
  currentDirectory: '',
  onFinishedMove: () => { },
};

export default MoveFiles;
