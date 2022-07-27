import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Modal, Loader } from 'semantic-ui-react';
import useGlobalError from '../error/ErrorHooks';
import FileUploader from '../FileUploader';

/**
 * Modal interface to upload Ancillary Materials to a Project/Book.
 */
const MaterialsUploader = ({ show, onClose, directory, projectID, uploadPath, onFinishedUpload, ...props }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState(false);

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
      formData.append('materials', file);
    });
    try {
      const uploadRes = await axios.post(
        `/project/${projectID}/book/materials`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (!uploadRes.data.err) {
        setLoading(false);
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
      <Modal.Header>Upload Materials</Modal.Header>
      <Modal.Content>
        <p>Files will be uploaded to the <strong>{directory}</strong> folder. Up to 10 files can be uploaded at once, with a maximum of 100 MB each.</p>
        {!loading ? (
          <FileUploader multiple={true} maxFiles={10} onUpload={handleUpload} />
        ) : (
          <Loader active inline="centered" className="mt-2p mb-2p" />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
      </Modal.Actions>
    </Modal>
  )
};

MaterialsUploader.propTypes = {
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
   * Identifier of the project materials are being added to.
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

MaterialsUploader.defaultProps = {
  onClose: () => { },
  uploadPath: '',
  onFinishedUpload: () => { },
};

export default MaterialsUploader;
