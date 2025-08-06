import React, { useState } from "react";
import Uppy from "@uppy/core";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "@uppy/screen-capture/dist/style.css";
import { Dashboard, useUppyEvent } from "@uppy/react";
import ScreenCapture from "@uppy/screen-capture";
import classNames from "classnames";
import "./FileUploader.css"; // Custom styles for the uploader

interface FileUploaderProps {
  minFiles?: number; // minimum number of files required
  maxFiles?: number;
  maxFileSize?: number; // in bytes, e.g., 10485760 for 10MB
  fileTypes?: string[]; // e.g., ['image/*', 'application/pdf']
  disabled?: boolean;
  onUpload: (files: FileList) => void;
  className?: string;
  allowScreenCast?: boolean; // optional prop for screen cast
}

/**
 * A drag-and-drop (or click) file upload area with customizations for
 * multiple and maximum numbers of files.
 */
const FileUploader: React.FC<FileUploaderProps> = ({
  minFiles = 0,
  maxFiles = 1,
  maxFileSize = 10485760, // default to 10MB
  fileTypes,
  disabled = false,
  onUpload,
  className,
  allowScreenCast = false,
}) => {
  const [uppy] = useState(() => {
    const uppy = new Uppy({
      debug: true,
      
      restrictions: {
        maxFileSize: maxFileSize,
        minNumberOfFiles: minFiles,
        maxNumberOfFiles: maxFiles,
        allowedFileTypes: fileTypes || undefined,
      },
    });
    if (allowScreenCast) {
      uppy.use(ScreenCapture, {
        preferredVideoMimeType: "video/webm",
      });
    }
    return uppy;
  });

  useUppyEvent(uppy, "state-update", (prevState, newState) => {
    const stateFiles = Object.values(newState.files);

    const dataTransfer = new DataTransfer();
    stateFiles.forEach((file) => {
      if (file.data) {
        if (file.data instanceof File) {
          dataTransfer.items.add(file.data);
        } else if (file.data instanceof Blob) {
          const newFile = new File(
            [file.data],
            file.name || `${crypto.randomUUID()}.${file.extension}`,
            {
              type: file.type,
              lastModified: new Date().getTime(),
            }
          );
          dataTransfer.items.add(newFile);
        }
      }
    });

    const fileList = dataTransfer.files;
    onUpload(fileList); // Always send new file list even if empty
  });

  return (
    <Dashboard
      uppy={uppy}
      width={"100%"}
      height={"250px"}
      hideUploadButton
      disabled={disabled}
      className={classNames(className)}
    />
  );
};

export default FileUploader;
