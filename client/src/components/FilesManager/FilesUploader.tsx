import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Button,
  Divider,
  Form,
  Icon,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import ProgressBar from "../ProgressBar";
import useGlobalError from "../error/ErrorHooks";
import FileUploader from "../FileUploader";
import styles from "./FilesManager.module.css";
import { z } from "zod";

type FilesUploaderProps = ModalProps & {
  show: boolean;
  onClose: () => void;
  directory: string;
  projectID: string;
  uploadPath: string;
  projectHasDefaultLicense?: boolean;
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
  projectHasDefaultLicense = false,
  onFinishedUpload,
  ...props
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [urlDisabled, setUrlDisabled] = useState<boolean>(false);
  const [fileDisabled, setFileDisabled] = useState<boolean>(false);
  const [validURL, setValidURL] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>("");
  const [percentUploaded, setPercentUploaded] = useState<number>(0);
  const [finishedFileTransfer, setFinishedFileTransfer] =
    useState<boolean>(false);
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const URL_SCHEMA = z.string().trim().url();
  const dirText = directory ? directory : "root";

  // Reset URL input when modal is closed/opened
  useEffect(() => {
    if (show) {
      setUrlInput("");
      setUrlDisabled(false);
      setFileDisabled(false);
    }
  }, [show]);

  // Disable file upload if URL is entered
  useEffect(() => {
    if (urlInput) {
      setFileDisabled(true);
    } else {
      setFileDisabled(false);
    }
  }, [urlInput]);

  useEffect(() => {
    if (!urlInput) return;

    const result = URL_SCHEMA.safeParse(urlInput);
    if (result.success) {
      setValidURL(true);
    } else {
      setValidURL(false);
    }
  }, [urlInput]);

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

  async function handleURLUpload() {
    try {
      setLoading(true);

      await URL_SCHEMA.parseAsync(urlInput); // Will throw if invalid URL

      const formData = new FormData();
      formData.append("parentID", uploadPath);
      formData.append("fileURL", urlInput);
      formData.append("isURL", "true");

      const res = await axios.post(`/project/${projectID}/files`, formData, {
        signal: abortControllerRef.current.signal,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      cleanupFileUploader();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
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
              disabled={fileDisabled}
            />
            <Divider horizontal>Or</Divider>
            <div>
              <Form onSubmit={(e) => e.preventDefault()}>
                <div className="">
                  <label className="form-field-label">
                    Externally Hosted Asset URL{" "}
                    <span className="italic">
                      (this will not download the asset to Conductor)
                    </span>
                  </label>
                  <Form.Input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/my-asset.png"
                    disabled={urlDisabled}
                    error={!validURL && urlInput ? true : false}
                  />
                  {!validURL && urlInput && (
                    <p className="text-red-400 -mt-3">
                      Please enter a valid URL.
                    </p>
                  )}
                </div>
              </Form>
            </div>
            {projectHasDefaultLicense && (
              <p className="mt-4 text-center italic">
                This project has a default license set for assets. You can
                change the license information for this file after uploading as
                needed.
              </p>
            )}
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
        {urlInput && (
          <Button
            color="green"
            icon
            labelPosition="left"
            disabled={!validURL}
            loading={loading}
            onClick={handleURLUpload}
          >
            <Icon name="save" />
            Save URL
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default FilesUploader;
