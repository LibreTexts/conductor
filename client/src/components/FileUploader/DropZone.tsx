import React, { useCallback, useRef, useState } from "react";
import type Uppy from "@uppy/core";
import { IconUpload } from "@tabler/icons-react";

interface DropZoneProps {
  uppy: Uppy;
  disabled?: boolean;
  fileTypes?: string[];
  maxFiles: number;
  currentFileCount: number;
}

const DropZone: React.FC<DropZoneProps> = ({
  uppy,
  disabled = false,
  fileTypes,
  maxFiles,
  currentFileCount,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        try {
          uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
            source: "local",
          });
        } catch (err: any) {
          setError(err?.message ?? "Unable to add file.");
        }
      }
    },
    [uppy]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [disabled, addFiles]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [addFiles]
  );

  const atCapacity = currentFileCount >= maxFiles;

  return (
    <div>
      <div
        role="region"
        aria-label="File drop zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver && !disabled
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <IconUpload size={28} className="text-gray-500" aria-hidden="true" />
        <p className="text-gray-700">
          {atCapacity ? (
            "Maximum number of files reached."
          ) : (
            <>
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-blue-700 underline decoration-blue-700/50 underline-offset-2 hover:text-blue-800 hover:decoration-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                disabled={disabled}
              >
                browse files
              </button>
            </>
          )}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple={maxFiles > 1}
          accept={fileTypes?.join(",")}
          onChange={handleFileInput}
          aria-label="Choose files to upload"
          disabled={disabled || atCapacity}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};

export default DropZone;
