import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Modal } from 'semantic-ui-react';
import ProgressBar from '../ProgressBar';
import useGlobalError from '../error/ErrorHooks';
import FileUploader from '../FileUploader';
import styles from './FilesManager.module.css';

/**
 * Modal interface to upload Project Files to a Project.
 */
const FilesUploader = ({ show, onClose, directory, projectID, uploadPath, onFinishedUpload, ...props }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);
  const [percentUploaded, setPercentUploaded] = useState(0);
  const [finishedFileTransfer, setFinishedFileTransfer] = useState(false);

  const dirText = directory ? directory : 'root';

  /**
   * Handles upload to the server after files are collected using the FileUploader.
   *
   * @param {FileList} files - Files selected for upload by the user.
   */
  async function handleUpload(files) {
    setLoading(true);
    const formData = new FormData();
    formData.append('parentID', uploadPath);
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    try {
      const uploadRes = await axios.post(
        `/project/${projectID}/files`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (typeof (progressEvent.loaded) === 'number' && typeof (progressEvent.total) === 'number') {
              const progress = (progressEvent.loaded / progressEvent.total) * 100;
              setPercentUploaded(progress);
              if (progress === 100) {
                setFinishedFileTransfer(true);
              }
            }
          },
        },
      );
      if (!uploadRes.data.err) {
        setLoading(false);
        setPercentUploaded(0);
        setFinishedFileTransfer(false);
        onFinishedUpload();
      } else {
        throw (new Error(uploadRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Upload Files</Modal.Header>
      <Modal.Content>
        {!loading ? (
          <div>
            <p>Files will be uploaded to the <strong>{dirText}</strong> folder. Up to 10 files can be uploaded at once, with a maximum of 100 MB each.</p>
            <FileUploader multiple={true} maxFiles={10} onUpload={handleUpload} />
          </div>
        ) : (
          <ProgressBar
            id="upload-progress"
            label={(
              <label
                htmlFor="upload-progress"
                className={styles.upload_progress_label}
              >
                {!finishedFileTransfer ? 'Uploading...' : 'Finishing...'}
              </label>
            )}
            value={percentUploaded}
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
      </Modal.Actions>
    </Modal>
  )
};

FilesUploader.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Visual title of the directory files will be uploaded to.
   */
  directory: PropTypes.string.isRequired,
  /**
   * Identifier of the project Files are being added to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Path to add the materials to in the Project/Book's file hierarchy.
   */
  uploadPath: PropTypes.string,
  /**
   * Handler to activate when uploads to the server are finished.
   */
  onFinishedUpload: PropTypes.func,
};

FilesUploader.defaultProps = {
  onClose: () => { },
  uploadPath: '',
  onFinishedUpload: () => { },
};

export default FilesUploader;
