import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Icon } from 'semantic-ui-react';
import useGlobalError from '../error/ErrorHooks';
import styles from './FileUploader.module.css';

/**
 * A drag-and-drop (or click) file upload area with customizations for
 * multiple and maximum numbers of files.
 */
const FileUploader = ({ multiple, maxFiles, onUpload, disabled=false, ...props }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const inputReference = useRef(null);

  // Uploader State
  const [dragActive, setDragActive] = useState(false);

  /**
   * Activates the "droppable" area visual state when a file is dragged into the uploader.
   *
   * @param {React.DragEvent} e - The event that triggered the handler. 
   */
  function handleFileDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  /**
   * Performs basic validation and triggers the passed upload handler.
   *
   * @param {React.FormEvent} e - The event that triggered the handler, containing a FileList.
   * @param {string} src - The source of the file upload, either 'select' or 'drag'.
   */
  function processFileTransfer(e, src = 'select') {
    let files = [];
    if (src === 'drag') {
      if (e.dataTransfer?.files) {
        files = e.dataTransfer.files;
      }
    } else {
      if (e.target?.files) {
        files = e.target.files;
      }
    }
    if (multiple && maxFiles && files.length > maxFiles) {
      // too many files
      handleGlobalError(`This uploader accepts a maximum of ${maxFiles} files.`);
    } else if (files.length > 0) {
      // files uploaded
      onUpload(files);
    }
  }

  /**
   * Starts the transfer process when a file has been dragged into the uploader.
   *
   * @param {React.FormEvent} e - The event that triggered the handler.
   */
  function handleFileDrop(e) {
    console.log(e);
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFileTransfer(e, 'drag');
  }

  /**
   * Starts the transfer process when a file has been selected using the OS picker.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler. 
   */
  function handleInputChange(e) {
    e.preventDefault();
    processFileTransfer(e);
  }

  /**
   * Activates the OS file picker by virtually "clicking" the hidden file input.
   */
  function handleUploadClick() {
    inputReference.current.click();
  }

  /**
   * Prevents default actions if the form submit process is triggered.
   *
   * @param {React.FormEvent} e - The event that triggered the handler. 
   */
  function handleFormSubmit(e) {
    e.preventDefault();
  }

  return (
    <form
      id={styles.uploader_form}
      onDragEnter={handleFileDrag}
      onSubmit={handleFormSubmit}
      {...props}
    >
      <input
        ref={inputReference}
        type="file"
        id={styles.uploader_input}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
      />
      <label
        id={styles.uploader_label}
        htmlFor={styles.uploader_input}
        className={dragActive ? styles.drag_active : ''}
      >
          <Icon name="upload" size="big" />
          <p id={styles.uploader_instructions}>Drag and drop your file or</p>
          <Button
            onClick={handleUploadClick}
            color="blue"
            disabled={disabled}
          >
            Select file(s)
          </Button>
      </label>
      {dragActive && !disabled && (
        <div
          id={styles.uploader_drag_area}
          onDragEnter={handleFileDrag}
          onDragLeave={handleFileDrag}
          onDragOver={handleFileDrag}
          onDrop={handleFileDrop}
        />
      )}
    </form>
  )
};

FileUploader.propTypes = {
  /**
   * Allow user to upload multiple files.
   */
  multiple: PropTypes.bool,
  /**
   * Maximum files to allow at once (if multiple enabled).
   */
  maxFiles: PropTypes.number,
  /**
   * Handler to activate when file(s) are ready to upload to their destination.
   */
  onUpload: PropTypes.func.isRequired,
};

FileUploader.defaultProps = {
  multiple: false,
  maxFiles: 1,
};

export default FileUploader;
