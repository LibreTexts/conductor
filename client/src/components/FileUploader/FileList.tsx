import React from "react";
import type Uppy from "@uppy/core";
import { IconButton } from "@libretexts/davis-react";
import { IconFile, IconX } from "@tabler/icons-react";
import { formatFileSize } from "./utils";

interface FileListFile {
  id: string;
  name: string;
  size: number;
}

interface FileListProps {
  files: FileListFile[];
  uppy: Uppy;
  disabled?: boolean;
}

const FileList: React.FC<FileListProps> = ({
  files,
  uppy,
  disabled = false,
}) => {
  return (
    <ul aria-label="Selected files" className="divide-y divide-gray-200">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2 min-w-0">
            <IconFile size={18} className="shrink-0 text-gray-500" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm text-gray-900">{file.name}</span>
              <span className="text-xs text-gray-700">
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
          <IconButton
            icon={<IconX size={16} />}
            aria-label={`Remove file ${file.name}`}
            variant="outline"
            size="sm"
            onClick={() => uppy.removeFile(file.id)}
            disabled={disabled}
          />
        </li>
      ))}
    </ul>
  );
};

export default FileList;
