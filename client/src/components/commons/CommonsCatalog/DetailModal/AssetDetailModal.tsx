import { Button, Icon, Modal } from "semantic-ui-react";
import { ConductorSearchResponseFile } from "../../../../types";
import { downloadFile, getFileTypeIcon } from "../../../../utils/assetHelpers";
import CatalogDetailMeta from "../../../util/CatalogDetailMeta";
import RenderAssetTags from "../../../FilesManager/RenderAssetTags";
import "../../Commons.css";
import { useState } from "react";
import useGlobalError from "../../../error/ErrorHooks";
import { getPrettyNameFromMimeType } from "../../../../utils/common-mime-types";
import FilePreview from "../../../FilesManager/FilePreview";

interface AssetDetailModalProps {
  file: ConductorSearchResponseFile;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ file }) => {
  const { handleGlobalError } = useGlobalError();
  const [downloadLoading, setDownloadLoading] = useState(false);

  const getAuthorsElement = () => {
    const corresponding = file.correspondingAuthor
      ? `${file.correspondingAuthor?.firstName} ${file.correspondingAuthor?.lastName}* (<a href="mailto:${file.correspondingAuthor.email}">${file.correspondingAuthor?.email}</a>)`
      : "";
    const allOthersMapped = file.authors
      ?.filter((a) => a && !!a.firstName && !!a.lastName)
      .map((a) => `${a?.firstName} ${a?.lastName}`);

    const allTogether = [
      file.primaryAuthor
        ? `${file.primaryAuthor?.firstName} ${file.primaryAuthor?.lastName}`
        : "",
      corresponding,
      ...(allOthersMapped ?? []),
    ]
      .filter((a) => a)
      .join(", ");

    return (
      <span
        dangerouslySetInnerHTML={{ __html: allTogether || "Unknown Author" }}
      />
    );
  };

  async function handleFileDownload(file: ConductorSearchResponseFile) {
    let success = false;
    try {
      if (file.isURL) {
        window.open(file.url, "_blank", "noreferrer");
        return;
      }
      if (file.isVideo) {
        window.open(
          `/file/${file.projectID}/${file.fileID}`,
          "_blank",
          "noreferrer"
        );
        return;
      }

      setDownloadLoading(true);
      success = await downloadFile(file.projectID, file.fileID);
    } catch (err) {
      if (!success) {
        console.error(err);
        handleGlobalError("Unable to download file. Please try again later.");
      }
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <Modal.Content className="max-h-screen overflow-y-auto">
      <div className="flex w-full h-auto">
        <FilePreview
          fileID={file.fileID}
          projectID={file.projectID}
          name={file.name}
          isURL={file.isURL}
          url={file.url}
          isVideo={file.isVideo}
          videoStorageID={file.videoStorageID}
          storageType={file.storageType}
          rendererClassName="!max-h-[500px] !max-w-[900px] overflow-auto !p-0"
        />
        {/* {file.projectInfo.thumbnail ? (
          <div
            onClick={() => window.open(`/commons-project/${file.projectID}`)}
            className="flex h-32 w-full rounded-md bg-left bg-no-repeat !bg-contain !cursor-pointer"
            style={{
              backgroundImage: `url(${file.projectInfo.thumbnail})`,
            }}
          ></div>
        ) : (
          <div className="flex h-32 w-full">
            <Icon name={getFileTypeIcon(file)} size="massive" color="black" />
          </div>
        )} */}
      </div>
      <p className="text-xl font-semibold break-words hyphens-auto mt-4">
        {file.name}
      </p>
      <p className="text-lg my-2">
        {file.description || "No description provided."}
      </p>
      <div className="flex">
        <div>
          <Icon name="user" className="text-blue-500" />
        </div>
        <p className="text-slate-600 ml-1.5">{getAuthorsElement()}</p>
      </div>
      {file.storageType === "file" && (
        <CatalogDetailMeta
          icon={getFileTypeIcon(file)}
          text={
            file.isURL
              ? "External Link"
              : getPrettyNameFromMimeType(file.mimeType) ?? "Unknown"
          }
          className="my-4"
        />
      )}
      <CatalogDetailMeta
        icon="legal"
        text={`${file.license?.name ? file.license.name : "Unknown License"} ${
          file.license?.version ? file.license.version : ""
        }`}
      />
      <div className="flex my-4">
        <div>
          <Icon name="wrench" className="text-blue-500" />
        </div>
        <a
          href={`/commons-project/${file.projectID}`}
          className="text-blue-600 ml-1.5 hover:underline"
        >
          View Conductor Project
        </a>
      </div>
      <div className={`${file.tags ? "mt-8" : ""} flex`}>
        <div className="flex flex-row items-center w-full pr-4">
          <RenderAssetTags
            file={file}
            showNoTagsMessage={false}
            size="large"
            basic={true}
            spreadArray
            max="none"
            popupDisabled={true}
          />
        </div>
        <div className="flex justify-end !w-full">
          <Button
            color="blue"
            size="big"
            loading={downloadLoading}
            onClick={() => handleFileDownload(file)}
            icon
            className="!w-"
          >
            <div className="flex flex-row items-center gap-x-2">
              <Icon
                name={
                  file.isURL ? "external" : file.isVideo ? "play" : "download"
                }
              />
              {file.isURL
                ? "Open External Link"
                : file.isVideo
                ? "Watch Video"
                : "Download File"}
            </div>
          </Button>
        </div>
      </div>
    </Modal.Content>
  );
};

export default AssetDetailModal;
