import React, { useState, useRef } from "react";
import axios from "axios";
import { Button, Modal, ModalProps } from "semantic-ui-react";
import ProgressBar from "../ProgressBar";
import useGlobalError from "../error/ErrorHooks";
import FileUploader from "../FileUploader";
import styles from "./FilesManager.module.css";

type FilesUploaderProps = ModalProps & {
  show: boolean;
  onClose: () => void;
  directory: string;
  projectID: string;
  uploadPath: string;
  onFinishedUpload: () => void;
};

/**
 * Modal interface to upload Project Files to a Project.
 */
const FilesUploader: React.FC<FilesUploaderProps> = ({
  show,
  onClose,
  directory,
  projectID,
  uploadPath,
  onFinishedUpload,
  ...props
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [percentUploaded, setPercentUploaded] = useState<number>(0);
  const [finishedFileTransfer, setFinishedFileTransfer] =
    useState<boolean>(false);
  const abortControllerRef = useRef<AbortController>(new AbortController());

  const dirText = directory ? directory : "root";

  /**
   * Handles upload to the server after files are collected using the FileUploader.
   *
   * @param {FileList} files - Files selected for upload by the user.
   */
  async function handleUpload(files: FileList) {
    setLoading(true);
    const formData = new FormData();
    formData.append("parentID", uploadPath);
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const uploadRes = await axios.post(
        `/project/${projectID}/files`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            if (
              typeof progressEvent.loaded === "number" &&
              typeof progressEvent.total === "number"
            ) {
              const progress =
                (progressEvent.loaded / progressEvent.total) * 100;
              setPercentUploaded(progress);
              if (progress === 100) {
                setFinishedFileTransfer(true);
              }
            }
          },
          signal: abortControllerRef.current.signal,
        }
      );
      if (uploadRes.data.err) {
        throw new Error(uploadRes.data.errMsg);
      }
      cleanupFileUploader();
    } catch (e: any) {
      if (e.message === "canceled") return; // Noop if canceled
      setLoading(false);
      handleGlobalError(e);
    }
  }

  async function handleCancelUpload() {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController(); // Reset abort controller
      cleanupFileUploader();
    } catch (err) {
      handleGlobalError(err);
    }
  }

  function cleanupFileUploader() {
    setLoading(false);
    setPercentUploaded(0);
    setFinishedFileTransfer(false);
    onFinishedUpload();
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Upload Files</Modal.Header>
      <Modal.Content>
        {!loading ? (
          <div>
            <p>
              Files will be uploaded to the <strong>{dirText}</strong> folder.
              Up to 10 files can be uploaded at once, with a maximum of 100 MB
              each.
            </p>
            <FileUploader
              multiple={true}
              maxFiles={10}
              onUpload={handleUpload}
            />
          </div>
        ) : (
          <ProgressBar
            id="upload-progress"
            label={
              <label
                htmlFor="upload-progress"
                className={styles.upload_progress_label}
              >
                {!finishedFileTransfer ? "Uploading..." : "Finishing..."}
              </label>
            }
            value={percentUploaded}
            max={100}
          />
        )}
      </Modal.Content>
      <Modal.Actions>
        {!loading ? (
          <Button onClick={onClose}>Cancel</Button>
        ) : (
          <Button onClick={handleCancelUpload}>Cancel Upload</Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default FilesUploader;
