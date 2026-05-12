import React, { useState } from "react";
import Uppy from "@uppy/core";
import { useUppyEvent } from "@uppy/react";
import classNames from "classnames";
import DropZone from "./DropZone";
import FileList from "./FileList";
import ScreenCaptureModal from "./ScreenCaptureModal";

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
    return new Uppy({
      restrictions: {
        maxFileSize: maxFileSize,
        minNumberOfFiles: minFiles,
        maxNumberOfFiles: maxFiles,
        allowedFileTypes: fileTypes || undefined,
      },
    });
  });

  // Keep parent in sync with Uppy file state
  useUppyEvent(uppy, "state-update", (_prevState, newState) => {
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

  // Derive file list from Uppy state for rendering
  const [files, setFiles] = useState<
    { id: string; name: string; size: number }[]
  >([]);

  useUppyEvent(uppy, "state-update", (_prevState, newState) => {
    const uppyFiles = Object.values(newState.files);
    setFiles(
      uppyFiles.map((f) => ({
        id: f.id,
        name: f.name ?? "Unnamed file",
        size: f.size ?? 0,
      }))
    );
  });

  return (
    <div
      className={classNames("flex flex-col gap-3", className)}
      role="group"
      aria-label="File upload"
    >
      <DropZone
        uppy={uppy}
        disabled={disabled}
        fileTypes={fileTypes}
        maxFiles={maxFiles}
        currentFileCount={files.length}
      />
      {files.length > 0 && (
        <FileList files={files} uppy={uppy} disabled={disabled} />
      )}
      {allowScreenCast && (
        <ScreenCaptureModal uppy={uppy} disabled={disabled} />
      )}
    </div>
  );
};

export default FileUploader;
