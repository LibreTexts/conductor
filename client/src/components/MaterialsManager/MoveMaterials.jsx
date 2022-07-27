import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Button, Icon, Divider, Loader } from 'semantic-ui-react';
import FileIcon from '../FileIcon';
import FileTree from '../FileTree';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to move Ancillary Materials between folders in the set.
 */
const MoveMaterials = ({ show, onClose, projectID, materials, currentDirectory, onFinishedMove }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locations, setLocations] = useState([]);

  /**
   * Retrieve the list of Materials for the server, determine which are valid new locations
   * for the provided Materials, and save the hierarchy to state.
   */
  const getMoveLocations = useCallback(async () => {
    try {
      setLoadingLocs(true);
      const locsRes = await axios.get(`/project/${projectID}/book/materials/`);
      if (!locsRes.data.err) {
        const foundLocs = locsRes.data.materials;
        if (Array.isArray(foundLocs)) {
          const selectedIDs = materials.map((obj) => obj.materialID);
          const filterRecursive = (arr) => {
            let passes = [];
            arr.forEach((obj) => {
              if (obj.storageType === 'folder' && !selectedIDs.includes(obj.materialID)) {
                let children = [];
                if (Array.isArray(obj.children)) {
                  children = filterRecursive(obj.children);
                }
                passes.push({
                  ...obj,
                  disabled: obj.materialID === currentDirectory,
                  children,
                });
              }
            });
            return passes;
          };
          const enabledFolders = [{
            materialID: '',
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
  }, [materials, currentDirectory, projectID, setLoadingLocs, setLocations, handleGlobalError]);

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
      for (let i = 0, n = materials.length; i < n; i += 1) {
        const currMaterial = materials[i];
        const moveRes = await axios.put(
          `/project/${projectID}/book/material/${currMaterial.materialID}/move`,
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
      <Modal.Header>Move Materials</Modal.Header>
      <Modal.Content scrolling>
        {!loading ? (
          <>
            <p>Select a new location for the following files:</p>
            <ul>
              {materials.map((obj) => (
                <li key={obj.materialID}>
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
                nodeIdentifierKey="materialID"
                nodeTypeKey="storageType"
                onFolderActionClick={handleMove}
                folderAction={(
                  <Button color="green" size="small" compact>
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

MoveMaterials.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the project materials belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Array of materials to be deleted.
   */
  materials: PropTypes.arrayOf(PropTypes.shape({
    materialID: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    storageType: PropTypes.string.isRequired,
  })).isRequired,
  /**
   * Identifier of the directory the modal was opened in the context of.
   */
  currentDirectory: PropTypes.string,
  /**
   * Handler to activate when the given material(s) have been moved.
   */
  onFinishedMove: PropTypes.func,
};

MoveMaterials.defaultProps = {
  onClose: () => { },
  currentDirectory: '',
  onFinishedMove: () => { },
};

export default MoveMaterials;
