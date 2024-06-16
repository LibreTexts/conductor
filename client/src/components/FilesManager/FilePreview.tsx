import { useEffect, useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { ProjectFile } from "../../types";
import FileRenderer from "./FileRenderer";
import { Icon } from "semantic-ui-react";
import URLFileHyperlink from "./URLFileHyperlink";
import { Stream } from "@cloudflare/stream-react";

interface FilePreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  projectID: string;
  fileID: string;
  name: string;
  isURL?: boolean;
  url?: string;
  isVideo?: boolean;
  videoStorageID?: string;
  storageType: "file" | "folder";
  videoStreamURL?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  projectID,
  fileID,
  name,
  isURL,
  url,
  isVideo,
  videoStorageID,
  storageType,
  videoStreamURL,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filePreviewURL, setFilePreviewURL] = useState<string | null>(null);
  const [shouldShowPreview, setShouldShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<"image" | "video" | "url">(
    "image"
  ); // image is default type if not determined

  useEffect(() => {
    if (!fileID) return;
    const { shouldShow, type } = checkShouldShowPreview();
    setShouldShowPreview(shouldShow);
    setPreviewType(type);
    if (shouldShow && type === "image") loadFileURL();
  }, [fileID]);

  async function loadFileURL() {
    try {
      setPreviewLoading(true);

      const res = await api.getFileDownloadURL(projectID, fileID, false);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.url) {
        throw new Error("Failed to load file preview");
      }
      setFilePreviewURL(res.data.url);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function checkShouldShowPreview(): {
    shouldShow: boolean;
    type: "image" | "video" | "url";
  } {
    if (!fileID) return { shouldShow: false, type: "image" };

    // Don't show preview for folders
    if (storageType !== "file") {
      return { shouldShow: false, type: "image" };
    }

    if (isURL && url) {
      return { shouldShow: true, type: "url" };
    }

    if (isVideo && videoStorageID) {
      return { shouldShow: true, type: "video" };
    }

    // Check if file is an image
    const ext = name.split(".").pop()?.toLowerCase();
    const validImgExt = ["png", "jpg", "jpeg", "gif", "bmp", "svg"].includes(
      ext ?? ""
    );
    if (!validImgExt) {
      return { shouldShow: false, type: "image" };
    }

    return { shouldShow: true, type: "image" };
  }

  return (
    <div {...rest}>
      {filePreviewURL && previewType === "image" && (
        <>
          <p className="font-semibold">File Preview</p>
          {previewLoading ? (
            <p className="mt-2 mr-2">
              <Icon name="spinner" loading />
              Loading preview...
            </p>
          ) : (
            <div className="mt-2">
              <FileRenderer
                url={filePreviewURL}
                projectID={projectID}
                fileID={fileID}
                validImgExt={shouldShowPreview}
                className="max-w-full max-h-full p-2"
              />
            </div>
          )}
        </>
      )}
      {filePreviewURL && previewType === "url" && (
        <>
          <p className="font-semibold">External URL</p>
          <div className="mt-2">
            <URLFileHyperlink url={url} />
          </div>
        </>
      )}
      {videoStreamURL && previewType === "video" && (
        <>
          <p className="font-semibold">Video</p>
          <div className="mt-2">
            <Stream controls src={videoStreamURL} />
            <p className="text-xs italic muted-text mt-2">
              It may take a few moments for new videos to be processed and
              available for streaming.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default FilePreview;
