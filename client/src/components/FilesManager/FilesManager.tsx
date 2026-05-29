import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Alert,
  Breadcrumb as DavisBreadcrumb,
  Button,
  Menu,
  Spinner,
  Tooltip,
} from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import {
  IconArrowsMove,
  IconBook,
  IconCode,
  IconDownload,
  IconEdit,
  IconFolder,
  IconInfoCircle,
  IconLock,
  IconDotsVertical,
  IconPlus,
  IconShare,
  IconTags,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
const AddFolder = React.lazy(() => import("./AddFolder"));
const ChangeAccess = React.lazy(() => import("./ChangeAccess"));
const DeleteFiles = React.lazy(() => import("./DeleteFiles"));
const FileIcon = React.lazy(() => import("../FileIcon"));
const FilesUploader = React.lazy(() => import("./FilesUploader"));
const MoveFiles = React.lazy(() => import("./MoveFiles"));
const EditFile = React.lazy(() => import("./EditFile"));
const LargeDownloadModal = React.lazy(() => import("./LargeDownloadModal"));
import {
  getFilesLicenseText,
  getFilesAccessText,
} from "../util/ProjectHelpers";
import { truncateString } from "../util/HelperFunctions";
import useGlobalError from "../error/ErrorHooks";
import { ProjectFile } from "../../types";
import RenderAssetTags from "./RenderAssetTags";
import {
  downloadFile,
  fileSizePresentable,
  getFileTypeIcon,
  getPrettyCreatedDate,
  getPrettyUploader,
} from "../../utils/assetHelpers";
import api from "../../api";
import { saveAs } from "file-saver";
import { useTypedSelector } from "../../state/hooks";
import { base64ToBlob, copyToClipboard } from "../../utils/misc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PermanentLinkModal from "./PermanentLinkModal";
import { useModals } from "../../context/ModalContext";
import BulkTagModal from "./BulkTagModal";

interface FilesManagerProps {
  projectID: string;
  toggleFilesManager: () => void;
  canViewDetails: boolean;
  allowBulkDownload?: boolean;
  projectHasDefaultLicense?: boolean;
  projectVisibility?: string;
}

type FileEntry = ProjectFile;

const FilesManager: React.FC<FilesManagerProps> = ({
  projectID,
  toggleFilesManager,
  canViewDetails = false,
  allowBulkDownload = false,
  projectHasDefaultLicense = false,
  projectVisibility = "private",
}) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();

  const [showUploader, setShowUploader] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showChangeAccess, setShowChangeAccess] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [showMove, setShowMove] = useState(false);
  const [showLargeDownload, setShowLargeDownload] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [permanentLink, setPermanentLink] = useState("");
  const [showPermanentLinkModal, setShowPermanentLinkModal] = useState(false);
  const [currDirectory, setCurrDirectory] = useState("");
  const [currDirPath, setCurrDirPath] = useState([
    {
      fileID: "",
      name: "",
    },
  ]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const [editID, setEditID] = useState<string>("");
  const [moveFiles, setMoveFiles] = useState<FileEntry[]>([]);
  const [accessFiles, setAccessFiles] = useState<FileEntry[]>([]);
  const [deleteFiles, setDeleteFiles] = useState<FileEntry[]>([]);

  const FILES_QUERY_KEY = ["project-files", projectID, currDirectory];
  const { data: files, isFetching: filesLoading } = useQuery<FileEntry[]>({
    queryKey: FILES_QUERY_KEY,
    queryFn: () => getFiles(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setRowSelection({});
  }, [currDirectory]);

  const hasAnyTags = useMemo(() => {
    if (!files || files.length === 0) return false;
    return files.some((file) => file.tags && file.tags.length > 0);
  }, [files]);

  const selectedFiles = useMemo(
    () => files?.filter((f) => rowSelection[f.fileID]) || [],
    [files, rowSelection]
  );

  const itemsChecked = selectedFiles.length;

  const allItemsChecked = useMemo(
    () => !!files && files.length > 0 && files.every((f) => rowSelection[f.fileID]),
    [files, rowSelection]
  );

  const canBulkTag = useMemo(
    () =>
      selectedFiles.length >= 1 &&
      !selectedFiles.some((f) => f.storageType !== "file"),
    [selectedFiles]
  );

  async function getFiles() {
    try {
      const fileRes = await api.getProjectFiles(projectID, currDirectory);
      if (fileRes.data.err) throw new Error(fileRes.data.errMsg);
      if (!Array.isArray(fileRes.data.files) || !Array.isArray(fileRes.data.path)) {
        throw new Error("Unable to fetch files. Please try again later.");
      }
      setCurrDirPath(fileRes.data.path);
      return fileRes.data.files as FileEntry[];
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  function handleUploadFinished() {
    setShowUploader(false);
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleAddFolderFinished() {
    setShowAddFolder(false);
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleEditFile(fileID: string) {
    if (!fileID) return;
    setEditID(fileID);
    setShowEdit(true);
  }

  function handleEditClose() {
    setShowEdit(false);
    setEditID("");
  }

  function handleEditFinished() {
    handleEditClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleMoveFiles(toMove: FileEntry[]) {
    if (toMove.length > 0) {
      setMoveFiles(toMove);
      setShowMove(true);
    }
  }

  function handleMoveClose() {
    setShowMove(false);
    setMoveFiles([]);
  }

  function handleMoveFinished() {
    handleMoveClose();
    queryClient.invalidateQueries(["project-files", projectID]);
  }

  function handleChangeAccess(toChange: FileEntry[]) {
    if (!canViewDetails) return;
    if (toChange.length > 0) {
      setAccessFiles(toChange);
      setShowChangeAccess(true);
    }
  }

  function handleAccessClose() {
    setShowChangeAccess(false);
    setAccessFiles([]);
  }

  function handleAccessFinished() {
    handleAccessClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleDeleteFiles(toDelete: FileEntry[]) {
    if (toDelete.length > 0) {
      setDeleteFiles(toDelete);
      setShowDelete(true);
    }
  }

  function handleDeleteClose() {
    setShowDelete(false);
    setDeleteFiles([]);
  }

  function handleDeleteFinished() {
    handleDeleteClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleDownloadRequest() {
    const requested = selectedFiles.filter(
      (obj) => obj.storageType === "file" && !obj.isVideo
    );
    if (requested.length === 0) return;
    if (requested.length === 1) {
      handleDownloadFile(projectID, requested[0].fileID);
    } else {
      handleBulkDownload(requested.map((obj) => obj.fileID));
    }
  }

  const handlePermanentLinkClick = useCallback(
    async (projectID: string, fileID: string) => {
      try {
        const response = await api.getPermanentLink(projectID, fileID);
        if (!response.data.err) {
          setPermanentLink(response.data.url);
          setShowPermanentLinkModal(true);
        } else {
          handleGlobalError(response.data.errMsg);
        }
      } catch (error) {
        handleGlobalError(error);
      }
    },
    []
  );

  const closePermanentLinkModal = useCallback(() => {
    setShowPermanentLinkModal(false);
    setPermanentLink("");
  }, []);

  function handleDownloadFile(projectID: string, fileID: string, isVideo?: boolean) {
    if (isVideo) {
      window.open(`/file/${projectID}/${fileID}`, "_blank");
      return;
    }
    const success = downloadFile(projectID, fileID);
    if (!success) {
      handleGlobalError(new Error("Unable to download file. Please try again later."));
    }
  }

  async function handleBulkDownload(ids: string[]) {
    try {
      setDownloadLoading(true);
      const res = await api.bulkDownloadFiles(projectID, ids);
      if (!res.data || res.data.err) {
        throw new Error("Unable to download files. Please try again later.");
      }
      if (!res.data.file) {
        setShowLargeDownload(true);
      } else {
        const blob = base64ToBlob(res.data.file, "application/zip");
        if (!blob) throw new Error("Unable to download files. Please try again later.");
        saveAs(blob, `${projectID}.zip`);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setDownloadLoading(false);
      setRowSelection({});
    }
  }

  async function handleGetEmbedCode(videoID: string, type: "html" | "url" = "html"): Promise<void> {
    try {
      const res = await api.getProjectFileEmbedHTML(projectID, videoID);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.embed_html || !res.data.embed_url) {
        throw new Error("Unable to get embed code. Please try again later.");
      }
      const code = type === "html" ? res.data.embed_html : res.data.embed_url;
      if (!code) throw new Error("Unable to get embed code. Please try again later.");
      const msg =
        type === "html"
          ? "Embed code copied to clipboard. NOTE: This code is only valid on libretexts.org or libretexts.net domains."
          : "Embed URL copied to clipboard. Paste this URL into the ADAPT editor.";
      await copyToClipboard(code, msg);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  function handleDirectoryClick(directoryID: string) {
    setCurrDirectory(directoryID);
  }

  function handleBulkTagFiles() {
    if (selectedFiles.length === 0) return;
    const toTag = selectedFiles.filter((obj) => obj.storageType === "file");
    if (toTag.length === 0) return;
    openModal(
      <BulkTagModal
        projectID={projectID}
        fileIds={toTag.map((f) => f.fileID)}
        onCancel={() => closeAllModals()}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: FILES_QUERY_KEY });
          closeAllModals();
        }}
      />
    );
  }

  function DirectoryBreadcrumbs() {
    return (
      <DavisBreadcrumb>
        {currDirPath.map((item, idx) => {
          const isLast = idx === currDirPath.length - 1;
          const name = item.name === "" && item.fileID === "" ? "Files" : item.name;
          return (
            <DavisBreadcrumb.Item key={item.fileID || "root"} isCurrent={isLast}>
              {!isLast ? (
                <span
                  className="cursor-pointer hover:underline text-blue-600"
                  onClick={() => handleDirectoryClick(item.fileID)}
                >
                  {name}
                </span>
              ) : (
                name
              )}
            </DavisBreadcrumb.Item>
          );
        })}
      </DavisBreadcrumb>
    );
  }

  const RowMenu = (item: FileEntry) => {
    return (
      <Menu>
        <Menu.Button
          className="!bg-transparent !border-0 !text-gray-400 hover:!bg-gray-100 !p-1 [&>*:last-child]:!hidden"
          aria-label="File actions"
        >
          <IconDotsVertical size={18} />
        </Menu.Button>
        <Menu.Items>
          {canViewDetails && (
            <>
              <Menu.Item onClick={() => handleEditFile(item.fileID)}>
                <span className="flex items-center gap-2">
                  <IconEdit size={15} /> Edit
                </span>
              </Menu.Item>
              <Menu.Item onClick={() => handleMoveFiles([item])}>
                <span className="flex items-center gap-2">
                  <IconArrowsMove size={15} /> Move
                </span>
              </Menu.Item>
              <Menu.Item onClick={() => handleDeleteFiles([item])}>
                <span className="flex items-center gap-2 text-red-600">
                  <IconTrash size={15} /> Delete
                </span>
              </Menu.Item>
            </>
          )}
          {item.storageType === "file" && !item.isURL && (
            <Menu.Item onClick={() => handleDownloadFile(projectID, item.fileID, item.isVideo)}>
              <span className="flex items-center gap-2">
                <IconDownload size={15} /> Download
              </span>
            </Menu.Item>
          )}
          {item.storageType === "file" && !item.isURL && item.access === "public" && (
            <Menu.Item onClick={() => handlePermanentLinkClick(projectID, item.fileID)}>
              <span className="flex items-center gap-2">
                <IconShare size={15} /> Permanent Link
              </span>
            </Menu.Item>
          )}
          {item.storageType === "file" && item.isVideo && item.videoStorageID &&
            item.access === "public" && projectVisibility === "public" && (
              <Menu.Item onClick={async () => { await handleGetEmbedCode(item.fileID, "html"); }}>
                <span className="flex items-center gap-2">
                  <IconCode size={15} /> Embed
                </span>
              </Menu.Item>
            )}
          {item.storageType === "file" && item.isVideo && item.videoStorageID &&
            item.access === "public" && projectVisibility === "public" && (
              <Menu.Item onClick={async () => { await handleGetEmbedCode(item.fileID, "url"); }}>
                <span className="flex items-center gap-2">
                  <IconBook size={15} /> Copy to ADAPT
                </span>
              </Menu.Item>
            )}
        </Menu.Items>
      </Menu>
    );
  };

  const fileInfoTooltip = (item: FileEntry) => {
    const lines: string[] = [
      `License: ${getFilesLicenseText(item.license)}`,
    ];
    if (item.storageType === "file") {
      lines.push(`Size: ${fileSizePresentable(item.size)}`);
    }
    if (item.createdDate) {
      const creator = item.uploader ? ` by ${getPrettyUploader(item.uploader)}` : "";
      lines.push(`Created: ${getPrettyCreatedDate(item.createdDate)}${creator}`);
    }
    return lines.join(" · ");
  };

  const tableColumns = useMemo<ColumnDef<FileEntry>[]>(() => {
    const baseCols: ColumnDef<FileEntry>[] = [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="flex items-center gap-1">
                {item.storageType === "folder" && (
                  <IconFolder size={16} className="text-gray-500 flex-shrink-0" />
                )}
                {item.storageType === "folder" ? (
                  <span
                    className="text-link break-all cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDirectoryClick(item.fileID); }}
                  >
                    {item.name}
                  </span>
                ) : (
                  <a
                    onClick={(e) => { e.stopPropagation(); handleDownloadFile(projectID, item.fileID, item.isVideo); }}
                    className="cursor-pointer break-all"
                  >
                    {item.name}
                  </a>
                )}
                <Tooltip content={fileInfoTooltip(item)}>
                  <button
                    className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconInfoCircle size={15} />
                  </button>
                </Tooltip>
              </div>
              {item.description && (
                <span className="text-sm text-gray-500 block">
                  {truncateString(item.description, 100)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "access",
        header: "Access",
        cell: ({ row }) => {
          const item = row.original;
          return canViewDetails ? (
            <button
              className="hover:underline text-blue-600 text-left text-sm"
              onClick={(e) => { e.stopPropagation(); handleChangeAccess([item]); }}
            >
              {getFilesAccessText(item.access)}
            </button>
          ) : (
            <span className="text-sm">{getFilesAccessText(item.access)}</span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => RowMenu(row.original),
      },
    ];

    if (hasAnyTags) {
      baseCols.splice(2, 0, {
        id: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const item = row.original;
          return item.tags && item.tags.length > 0 ? (
            <RenderAssetTags file={item} popupDisabled spreadArray />
          ) : null;
        },
      });
    }

    return baseCols;
  }, [hasAnyTags, canViewDetails, projectID]);

  const allTableColumns = tableColumns;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Assets</h2>
        <Button variant="outline" size="sm" onClick={toggleFilesManager}>
          Hide
        </Button>
      </div>

      {projectVisibility === "private" && files && files.length > 0 && (
        <Alert
          variant="info"
          message="Heads up! Your project's visibility is set to 'Private', so assets shown here won't be visible in Commons even if their access is set to 'Public'."
          className="mb-3"
        />
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
        {(canViewDetails || allowBulkDownload) && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            {canViewDetails && (
              <p className="text-sm text-gray-600 mb-3">
                If your project has supporting files, use this tool to upload and organize them.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {canViewDetails && (
                <>
                  <Button
                    variant="primary"
                    icon={<IconUpload size={15} />}
                    onClick={() => setShowUploader(true)}
                  >
                    Upload
                  </Button>
                  <Button
                    variant="primary"
                    icon={<IconPlus size={15} />}
                    onClick={() => setShowAddFolder(true)}
                  >
                    New Folder
                  </Button>
                </>
              )}
              {itemsChecked > 1 && (
                <Button
                  variant="outline"
                  icon={!downloadLoading ? <IconDownload size={15} /> : undefined}
                  loading={downloadLoading}
                  onClick={handleDownloadRequest}
                  disabled={downloadLoading}
                >
                  {downloadLoading ? "This may take a moment..." : "Download (ZIP)"}
                </Button>
              )}
              {canViewDetails && itemsChecked > 1 && (
                <Button
                  variant="outline"
                  icon={<IconArrowsMove size={15} />}
                  onClick={() => handleMoveFiles(selectedFiles)}
                >
                  Move
                </Button>
              )}
              {canViewDetails && itemsChecked > 0 && (
                <Button
                  variant="outline"
                  icon={<IconLock size={15} />}
                  onClick={() => handleChangeAccess(selectedFiles)}
                >
                  Change Access
                </Button>
              )}
              {canViewDetails && canBulkTag && (
                <Button
                  variant="outline"
                  icon={<IconTags size={15} />}
                  onClick={handleBulkTagFiles}
                >
                  Bulk Tag
                </Button>
              )}
              {canViewDetails && itemsChecked > 1 && (
                <Button
                  variant="outline"
                  icon={<IconTrash size={15} />}
                  onClick={() => handleDeleteFiles(selectedFiles)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

        {currDirectory !== "" && (
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <DirectoryBreadcrumbs />
          </div>
        )}

        <DataTable
          data={files || []}
          columns={allTableColumns}
          enableRowSelection={canViewDetails || allowBulkDownload}
          loading={filesLoading}
          density="compact"
          striped
          emptyState={<em className="text-gray-400">No files found.</em>}
          tableOptions={{
            getRowId: (row) => row.fileID,
            state: { rowSelection },
            onRowSelectionChange: setRowSelection,
          }}
        />
        <p className="text-center text-xs text-gray-400 italic p-3 border-t border-gray-100">
          Use caution when opening files/links from unknown sources.
          LibreTexts is not responsible for the content of the files/links above.
        </p>
      </div>

      <FilesUploader
        show={showUploader}
        onClose={() => setShowUploader(false)}
        directory={currDirPath[currDirPath.length - 1].name}
        projectID={projectID}
        uploadPath={currDirectory}
        onFinishedUpload={handleUploadFinished}
        projectHasDefaultLicense={projectHasDefaultLicense}
        mode="add"
      />
      <AddFolder
        show={showAddFolder}
        onClose={() => setShowAddFolder(false)}
        projectID={projectID}
        parentDirectory={currDirPath[currDirPath.length - 1].fileID}
        onFinishedAdd={handleAddFolderFinished}
      />
      <ChangeAccess
        show={showChangeAccess}
        onClose={handleAccessClose}
        projectID={projectID}
        files={accessFiles}
        onFinishedChange={handleAccessFinished}
      />
      {editID && (
        <EditFile
          show={showEdit}
          onClose={handleEditClose}
          projectID={projectID}
          fileID={editID}
          onFinishedEdit={handleEditFinished}
        />
      )}
      <MoveFiles
        show={showMove}
        onClose={handleMoveClose}
        projectID={projectID}
        files={moveFiles}
        currentDirectory={currDirectory}
        onFinishedMove={handleMoveFinished}
      />
      <DeleteFiles
        show={showDelete}
        onClose={handleDeleteClose}
        projectID={projectID}
        files={deleteFiles}
        onFinishedDelete={handleDeleteFinished}
      />
      <LargeDownloadModal
        show={showLargeDownload}
        onClose={() => setShowLargeDownload(false)}
      />
      <PermanentLinkModal
        open={showPermanentLinkModal}
        link={permanentLink}
        onClose={closePermanentLinkModal}
      />
    </div>
  );
};

export default FilesManager;
