import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Button,
  Divider,
  Form,
  Icon,
  Modal,
  ModalProps,
  Checkbox,
} from "semantic-ui-react";
import ProgressBar from "../ProgressBar";
import useGlobalError from "../error/ErrorHooks";
import FileUploader from "../FileUploader";
import { z } from "zod";
import api from "../../api";
import { useTypedSelector } from "../../state/hooks";

type _AddProps = {
  mode: "add";
  directory: string;
  projectHasDefaultLicense?: boolean;
};

type _ReplaceProps = {
  mode: "replace";
  fileID: string;
};

type FilesUploaderProps = ModalProps & {
  show: boolean;
  onClose: () => void;
  projectID: string;
  uploadPath: string;
  onFinishedUpload: () => void;
} & (_AddProps | _ReplaceProps);

const MAX_ADD_FILES = 20;

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
  mode = "add",
  fileID,
  ...props
}) => {
  // Global State &  Error Handling
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [urlDisabled, setUrlDisabled] = useState<boolean>(false);
  const [fileDisabled, setFileDisabled] = useState<boolean>(false);
  const [validURL, setValidURL] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>("");
  const [overwriteName, setOverwriteName] = useState<boolean>(true);
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
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("parentID", uploadPath);

      // If uploader exists in authors collection, add them as an author to the file
      if (mode === "add" && user) {
        const authorsRes = await api.getAuthors({ query: user.email });
        if (authorsRes.data.err) {
          console.error(authorsRes.data.errMsg);
        }
        if (!authorsRes.data.authors) {
          console.error("An error occurred while getting authors");
        }

        if (authorsRes.data.authors) {
          const foundAuthor = authorsRes.data.authors.find(
            (author) => author.email === user.email
          );
          if (foundAuthor && foundAuthor._id) {
            formData.append("authors", [foundAuthor._id].toString());
          }
        }
      }

      if (mode === "replace") {
        formData.append("overwriteName", overwriteName.toString()); // Only used for replace mode
      }

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const opts = {
        onUploadProgress: (progressEvent: any) => {
          if (
            typeof progressEvent.loaded === "number" &&
            typeof progressEvent.total === "number"
          ) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setPercentUploaded(progress);
            if (progress === 100) {
              setFinishedFileTransfer(true);
            }
          }
        },
        signal: abortControllerRef.current.signal,
      };

      const uploadRes =
        mode === "add"
          ? await api.addProjectFile(projectID, formData, opts)
          : await api.replaceProjectFile_FormData(
              projectID,
              fileID,
              formData,
              opts
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
      formData.append("overwriteName", overwriteName.toString());

      const url =
        mode === "add"
          ? `/project/${projectID}/files`
          : `/project/${projectID}/files/${fileID}`;
      const signal = abortControllerRef.current.signal;

      const res =
        mode === "add"
          ? await api.addProjectFile(projectID, formData, { signal })
          : await axios.put(url, formData, { signal });

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
      <Modal.Header>
        {mode === "add" ? "Upload Files" : "Replace Files"}
      </Modal.Header>
      <Modal.Content>
        {!loading ? (
          <div>
            {mode === "replace" && (
              <div className="flex flex-col justify-center items-center">
                <p className="mb-2 text-center">
                  <strong>Warning:</strong> Replacing an existing file with a
                  new file or URL will remove and overwrite the old file. This
                  action cannot be undone!
                </p>
                <Checkbox
                  label="Overwrite file name?"
                  toggle
                  className="mb-4"
                  checked={overwriteName}
                  onChange={() => setOverwriteName(!overwriteName)}
                />
              </div>
            )}
            {mode === "add" && (
              <p>
                Files will be uploaded to the <strong>{dirText}</strong> folder.
                Up to {MAX_ADD_FILES} files can be uploaded at once, with a maximum of 100 MB
                each.
              </p>
            )}

            <FileUploader
              multiple={mode === "add" ? true : false}
              maxFiles={mode === "add" ? MAX_ADD_FILES : 1}
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
                className="block text-center mb-4 font-semibold"
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
