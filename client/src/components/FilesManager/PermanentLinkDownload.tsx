import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import useGlobalError from "../error/ErrorHooks";
import { downloadFile } from "../../utils/assetHelpers";
import { Icon } from "semantic-ui-react";

const PermanentLinkDownload = () => {
  const { handleGlobalError } = useGlobalError();
  const location = useLocation();

  const pathSegments = location.pathname.split("/");
  const projectID = pathSegments[2];
  const fileID = pathSegments[3];

  useEffect(() => {
    if (!projectID || !fileID) {
      handleGlobalError("Invalid project or file ID in the URL.");
    }
    attemptDownload(projectID, fileID);
  }, [projectID, fileID]);

  async function attemptDownload(projectID: string, fileID: string) {
    try {
      const success = await downloadFile(projectID, fileID);
      if (!success) {
        handleGlobalError(
          "Failed to download the file. Please check the link or try again later."
        );
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-6">
      <Icon name="check circle" size="massive" className="text-green-500" />
      <h1 className="text-3xl font-bold mt-12 mb-4">Downloading File...</h1>
      <p className="text-xl">
        If the download does not start automatically, please check your
        browser's download manager and/or allow pop-ups for this site.
      </p>
    </div>
  );
};

export default PermanentLinkDownload;
