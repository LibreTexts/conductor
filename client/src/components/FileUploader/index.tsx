import React, { useState, useRef } from "react";
import PropTypes from "prop-types";
import { Button, Icon, Label } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import styles from "./FileUploader.module.css";
import { truncateString } from "../util/HelperFunctions";

interface FileUploaderProps
  extends React.DetailedHTMLProps<
    React.FormHTMLAttributes<HTMLFormElement>,
    HTMLFormElement
  > {
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  onUpload: (files: FileList) => void;
  showUploads?: boolean;
}

/**
 * A drag-and-drop (or click) file upload area with customizations for
 * multiple and maximum numbers of files.
 */
const FileUploader: React.FC<FileUploaderProps> = ({
  multiple = false,
  maxFiles = 1,
  disabled = false,
  onUpload,
  showUploads = false,
  ...props
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const inputReference = useRef<HTMLInputElement | null>(null);

  // Uploader State
  const [dragActive, setDragActive] = useState(false);

  /**
   * Activates the "droppable" area visual state when a file is dragged into the uploader.
   *
   * @param {React.DragEvent} e - The event that triggered the handler.
   */
  function handleFileDrag(e: React.DragEvent) {
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
  function processFileTransfer(
    e: React.DragEvent | React.ChangeEvent,
    src = "select"
  ) {
    let files;
    if (src === "drag") {
      if ((e as React.DragEvent).dataTransfer?.files) {
        files = (e as React.DragEvent).dataTransfer.files;
      }
    } else {
      // @ts-expect-error
      if ((e as React.ChangeEvent).target?.files) {
        // @ts-expect-error
        files = e.target.files;
      }
    }
    if (multiple && maxFiles && files.length > maxFiles) {
      // too many files
      handleGlobalError(
        `This uploader accepts a maximum of ${maxFiles} files.`
      );
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
  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFileTransfer(e, "drag");
  }

  /**
   * Starts the transfer process when a file has been selected using the OS picker.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler.
   */
  function handleInputChange(e: React.ChangeEvent) {
    e.preventDefault();
    processFileTransfer(e);
  }

  /**
   * Activates the OS file picker by virtually "clicking" the hidden file input.
   */
  function handleUploadClick() {
    if (inputReference.current) {
      inputReference.current.click();
    }
  }

  /**
   * Prevents default actions if the form submit process is triggered.
   *
   * @param {React.FormEvent} e - The event that triggered the handler.
   */
  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <form
      onDragEnter={handleFileDrag}
      onSubmit={handleFormSubmit}
      {...props}
      id={styles.uploader_form}
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
        className={dragActive ? styles.drag_active : ""}
      >
        <Icon name="upload" size="big" />
        <p id={styles.uploader_instructions}>Drag and drop your file or</p>
        <Button onClick={handleUploadClick} color="blue" disabled={disabled}>
          Select file(s)
        </Button>
      </label>
      {!disabled && dragActive && (
        <div
          id={styles.uploader_drag_area}
          onDragEnter={handleFileDrag}
          onDragLeave={handleFileDrag}
          onDragOver={handleFileDrag}
          onDrop={handleFileDrop}
        />
      )}
      {showUploads && multiple && inputReference.current?.files && (
        <div className="flex flex-row justify-start mt-2">
          {Array.from(inputReference.current.files).map((file) => (
            <Label color="blue" size="tiny" key={crypto.randomUUID()} className="mr-2">
              {truncateString(file.name, 40)}
            </Label>
          ))}
        </div>
      )}
    </form>
  );
};

export default FileUploader;
