import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Button, Checkbox, Input, Modal, Progress } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconUpload } from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks";
import FileUploader from "../FileUploader";
import { z } from "zod";
import api from "../../api";
import { useTypedSelector } from "../../state/hooks";
import tusUpload from "../../utils/tusUpload";
import { calculateVideoLength } from "../../utils/assetHelpers";
import { supportTicketAttachmentAllowedTypes } from "../../utils/supportHelpers";

type FilesUploaderProps = {
  show: boolean;
  onClose: () => void;
  projectID: string;
  uploadPath: string;
  onFinishedUpload: () => void;
  mode?: "add" | "replace";
  directory?: string;
  fileID?: string;
  projectHasDefaultLicense?: boolean;
};

const MAX_ADD_FILES = 20;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

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
}) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);

  const [loading, setLoading] = useState<boolean>(false);
  const [urlDisabled, setUrlDisabled] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileDisabled, setFileDisabled] = useState<boolean>(false);
  const [validURL, setValidURL] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>("");
  const [overwriteName, setOverwriteName] = useState<boolean>(true);
  const [percentUploaded, setPercentUploaded] = useState<number>(0);
  const [finishedFileTransfer, setFinishedFileTransfer] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const URL_SCHEMA = z.string().trim().url();
  const dirText = directory ? directory : "root";

  useEffect(() => {
    if (show) {
      setUrlInput("");
      setUrlDisabled(false);
      setFileDisabled(false);
    }
  }, [show]);

  useEffect(() => {
    if (urlInput) {
      setFileDisabled(true);
    } else {
      setFileDisabled(false);
    }
  }, [urlInput]);

  useEffect(() => {
    if (files.length > 0) {
      setUrlDisabled(true);
    } else {
      setUrlDisabled(false);
    }
  }, [files]);

  useEffect(() => {
    if (!urlInput) return;
    const result = URL_SCHEMA.safeParse(urlInput);
    setValidURL(result.success);
  }, [urlInput]);

  async function handleUpload(files: File[]) {
    try {
      if (!files || files.length === 0) return;

      setLoading(true);
      const formData = new FormData();
      formData.append("parentID", uploadPath);

      if (mode === "replace") {
        formData.append("overwriteName", overwriteName.toString());
      }

      const videoFiles = files.filter((file) => file.type.startsWith("video"));
      const standardFiles = files.filter((file) => !file.type.startsWith("video"));

      const videoCheckPromises = videoFiles.map((file) => calculateVideoLength(file));
      const videoCheckResults = await Promise.allSettled(videoCheckPromises);
      videoCheckResults.forEach((result) => {
        if (result.status === "rejected" || !result.value) {
          throw new Error("Failed to calculate video length");
        }
        if (result.value > org.videoLengthLimit * 60) {
          throw new Error(
            `Video length exceeds the organization's limit of ${org.videoLengthLimit} minutes.`
          );
        }
      });

      const videoData: { videoID: string; videoName: string }[] = [];
      const videoPromises = videoFiles.map((file) => {
        return (async () => {
          const uploadId = await tusUpload(
            file,
            api.cloudflareStreamUploadURL,
            (progress) => {
              setPercentUploaded(progress / videoFiles.length);
              if (progress / videoFiles.length === 100 && standardFiles.length === 0) {
                setFinishedFileTransfer(true);
              }
            },
            abortControllerRef.current.signal,
            { maxDurationSeconds: org.videoLengthLimit * 60 }
          );
          if (!uploadId) throw new Error("Failed to upload video file");
          videoData.push({ videoID: uploadId, videoName: file.name });
        })();
      });

      await Promise.all(videoPromises);

      if (videoData.length > 0) {
        formData.append("videoData", JSON.stringify(videoData));
      }

      standardFiles.forEach((file) => {
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
          : await api.replaceProjectFile_FormData(projectID, fileID!, formData, opts);

      if (uploadRes.data.err) {
        throw new Error(uploadRes.data.errMsg);
      }
      cleanupFileUploader();
    } catch (e: any) {
      if (e.message === "canceled") return;
      setLoading(false);
      handleGlobalError(e);
    }
  }

  async function handleURLUpload() {
    try {
      setLoading(true);
      await URL_SCHEMA.parseAsync(urlInput);

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
      abortControllerRef.current = new AbortController();
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

  async function saveFilesToState(filesToSet: FileList) {
    setFiles([...Array.from(filesToSet)]);
  }

  return (
    <Modal open={show} onClose={(v) => { if (!v) onClose(); }}>
      <Modal.Header>
        <Modal.Title>{mode === "add" ? "Upload Files" : "Replace Files"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!loading ? (
          <div>
            {mode === "replace" && (
              <div className="flex flex-col justify-center items-center mb-4">
                <p className="mb-3 text-center">
                  <strong>Warning:</strong> Replacing an existing file with a new file or URL
                  will remove and overwrite the old file. This action cannot be undone!
                </p>
                <Checkbox
                  name="overwrite-name"
                  label="Overwrite file name?"
                  checked={overwriteName}
                  onChange={(checked) => setOverwriteName(checked)}
                />
              </div>
            )}
            {mode === "add" && (
              <p className="mb-3">
                Files will be uploaded to the <strong>{dirText}</strong> folder.
                Up to <strong>{MAX_ADD_FILES} files</strong> can be uploaded at once,
                with a maximum of <strong>100 MB</strong> each. Your organization has a
                video length limit of <strong>{org.videoLengthLimit}</strong> minutes.
              </p>
            )}

            <FileUploader
              className="mt-2"
              fileTypes={supportTicketAttachmentAllowedTypes}
              maxFiles={mode === "add" ? MAX_ADD_FILES : 1}
              maxFileSize={MAX_FILE_SIZE}
              onUpload={saveFilesToState}
              disabled={fileDisabled}
              minFiles={1}
            />

            <div className="flex items-center my-4">
              <hr className="flex-1 border-gray-200" />
              <span className="px-3 text-sm text-gray-500">Or</span>
              <hr className="flex-1 border-gray-200" />
            </div>

            <Input
              name="url-input"
              label="Externally Hosted Asset URL"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/my-asset.png"
              disabled={urlDisabled}
              error={!validURL && !!urlInput}
              errorMessage={!validURL && urlInput ? "Please enter a valid URL." : undefined}
              helperText="This will not download the asset to Conductor"
            />

            {projectHasDefaultLicense && (
              <p className="mt-4 text-center italic text-sm text-gray-600">
                This project has a default license set for assets. You can change the
                license information for this file after uploading as needed.
              </p>
            )}
          </div>
        ) : (
          <Progress
            value={percentUploaded}
            variant="success"
            size="lg"
            label={!finishedFileTransfer ? "Uploading..." : "Finishing..."}
            showValue
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          {!loading ? (
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          ) : (
            <Button variant="outline" onClick={handleCancelUpload}>Cancel Upload</Button>
          )}
          {urlInput && !urlDisabled && (
            <Button
              variant="primary"
              icon={<IconDeviceFloppy size={15} />}
              disabled={!validURL}
              loading={loading}
              onClick={handleURLUpload}
            >
              Save URL
            </Button>
          )}
          {files.length > 0 && !fileDisabled && (
            <Button
              variant="primary"
              icon={<IconUpload size={15} />}
              loading={loading}
              onClick={() => handleUpload(files)}
              disabled={fileDisabled || loading}
            >
              Upload Files
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FilesUploader;
