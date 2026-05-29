import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Modal } from '@libretexts/davis-react';
import { IconFile, IconFolder, IconTrash } from '@tabler/icons-react';
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
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>Delete Files</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Are you sure you want to delete the following files? <strong>Files inside any selected folders will also be deleted.</strong></p>
        <ul className="mt-4 space-y-2">
          {files.map((obj) => (
            <li key={obj.fileID} className="flex items-start gap-2 break-words">
              {obj.storageType === 'folder' ? (
                <IconFolder size={20} aria-hidden="true" className="mt-1 shrink-0" />
              ) : (
                <IconFile size={20} aria-hidden="true" className="mt-1 shrink-0" />
              )}
              <span>{obj.name}</span>
            </li>
          ))}
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="!bg-red-600 hover:!bg-red-700 active:!bg-red-800 focus-visible:!ring-red-600"
          onClick={handleDelete}
          loading={loading}
          icon={<IconTrash size={16} />}
        >
          Delete
        </Button>
      </Modal.Footer>
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
