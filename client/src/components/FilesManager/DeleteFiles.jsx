import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Button, Icon } from 'semantic-ui-react';
import FileIcon from '../FileIcon';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to remove entries from a Project Files set.
 */
const DeleteFiles = ({ show, onClose, projectID, files, onFinishedDelete }) => {

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
      for (let i = 0, n = files.length; i < n; i += 1) {
        const currFile = files[i];
        const deleteRes = await axios.delete(
          `/project/${projectID}/files/${currFile.fileID}`,
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
      <Modal.Header>Delete Files</Modal.Header>
      <Modal.Content>
        <p>Are you sure you want to delete the following files? <strong>Files inside any selected folders will also be deleted.</strong></p>
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
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="red" onClick={handleDelete} loading={loading}>
          <Icon name="trash" />
          Delete Files
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

DeleteFiles.propTypes = {
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
   * Handler to activate when the given files(s) have been deleted.
   */
  onFinishedDelete: PropTypes.func,
};

DeleteFiles.defaultProps = {
  onClose: () => { },
  onFinishedDelete: () => { },
};

export default DeleteFiles;
