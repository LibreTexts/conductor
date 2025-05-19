import { DetailedHTMLProps, HTMLAttributes, useEffect, useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { downloadFile } from "../../utils/assetHelpers";

interface FileRendererProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  url: string;
  validImgExt?: boolean;
  projectID?: string;
  fileID?: string;
}

const FileRenderer: React.FC<FileRendererProps> = ({
  url,
  validImgExt = false,
  projectID,
  fileID,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);

  useEffect(() => {
    getPreview(url);
  }, [url]);

  async function getPreview(fileURL: string) {
    try {
      if (!validImgExt) return; // We only want to render images for now
      setLoading(true);
      const xhr = new XMLHttpRequest();
      xhr.open("GET", fileURL, true);
      xhr.responseType = "blob";
      xhr.onload = () => {
        if (!xhr.response) return;
        setFileBlob(xhr.response);
        setLoading(false);
      };
      xhr.send();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadFile() {
    try {
      let downloadURL = "";
      if (!projectID || !fileID) {
        // If we don't have a projectID and fileID, just try to download file with current URL
        downloadURL = url;
      } else {
        // If we have a projectID and fileID, get fresh download URL and don't skip incrementing download count
        const res = await api.getFileDownloadURL(projectID, fileID);
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }
        if (!res.data.url) {
          throw new Error("No download URL returned");
        }
        downloadURL = res.data.url;
      }

      if (!downloadURL) return;
      const link = document.createElement("a");
      link.href = downloadURL;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      handleGlobalError(err);
    }
  }

  if (!validImgExt) {
    return (
      <div className="bg-gray-100 p-4 rounded-md">
        <p className="font-semibold">
          Preview is not available for this file type.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div aria-busy={loading} className="bg-gray-100 p-4">
        <p className="font-semibold">Loading File Preview...</p>
      </div>
    );
  }

  return fileBlob ? (
    <div
      aria-busy={loading}
      className="cursor-pointer"
      onClick={handleDownloadFile}
      {...rest}
    >
      <img
        src={URL.createObjectURL(fileBlob)}
        alt="Rendered File"
        className="cursor-pointer"
      ></img>
    </div>
  ) : (
    <div className="bg-gray-100 p-4 rounded-md">
      <p className="font-semibold">
        Oops, we ran into an error loading this file.
      </p>
    </div>
  );
};

export default FileRenderer;
