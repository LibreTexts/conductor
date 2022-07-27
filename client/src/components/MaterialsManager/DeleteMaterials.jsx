import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Button, Icon } from 'semantic-ui-react';
import FileIcon from '../FileIcon';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to remove entries from an Ancillary Materials set.
 */
const DeleteMaterials = ({ show, onClose, projectID, materials, onFinishedDelete }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);

  /**
   * Submits delete request(s) to the server, then closes the modal.
   */
  async function handleDelete() {
    setLoading(true);
    try {
      for (let i = 0, n = materials.length; i < n; i += 1) {
        const currMaterial = materials[i];
        const deleteRes = await axios.delete(
          `/project/${projectID}/book/materials/${currMaterial.materialID}`,
        );
        if (deleteRes.data.err) {
          throw (new Error(deleteRes.data.errMsg));
        }
      }
      setLoading(false);
      onFinishedDelete();
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Delete Materials</Modal.Header>
      <Modal.Content>
        <p>Are you sure you want to delete the following materials? <strong>Materials inside any selected folders will also be deleted.</strong></p>
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
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="red" onClick={handleDelete} loading={loading}>
          <Icon name="trash" />
          Delete Materials
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

DeleteMaterials.propTypes = {
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
   * Handler to activate when the given material(s) have been deleted.
   */
  onFinishedDelete: PropTypes.func,
};

DeleteMaterials.defaultProps = {
  onClose: () => { },
  onFinishedDelete: () => { },
};

export default DeleteMaterials;
