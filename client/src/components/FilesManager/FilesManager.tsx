import React, { useState, useMemo, useCallback } from "react";
import {
  Button,
  Loader,
  Icon,
  Breadcrumb,
  Table,
  Segment,
  Grid,
  Header,
  SegmentProps,
  SemanticWIDTHS,
  Popup,
  Dropdown,
  Message,
} from "semantic-ui-react";
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
import { useMediaQuery } from "react-responsive";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PermanentLinkModal from "./PermanentLinkModal";
import { useModals } from "../../context/ModalContext";
import BulkTagModal from "./BulkTagModal";

interface FilesManagerProps extends SegmentProps {
  projectID: string;
  toggleFilesManager: () => void;
  canViewDetails: boolean;
  allowBulkDownload?: boolean; 
  projectHasDefaultLicense?: boolean;
  projectVisibility?: string;
}

type FileEntry = ProjectFile & {
  checked: boolean;
};

/**
 * Modal tool to manage Files set for a Project
 */
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
  const isTailwindLg = useMediaQuery({ minWidth: 1024 }, undefined);
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

  const [editID, setEditID] = useState<string>("");
  const [moveFiles, setMoveFiles] = useState<FileEntry[]>([]);
  const [accessFiles, setAccessFiles] = useState<FileEntry[]>([]);
  const [deleteFiles, setDeleteFiles] = useState<FileEntry[]>([]);

  const FILES_QUERY_KEY = ["project-files", projectID, currDirectory];
  const { data: files, isFetching: filesLoading } = useQuery<FileEntry[]>({
    queryKey: FILES_QUERY_KEY,
    queryFn: () => getFiles(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const hasAnyTags = useMemo(() => {
    if (!files || files.length === 0) return false;
    return files.some((file) => file.tags && file.tags.length > 0);
  }, [files]);

  const TABLE_COLS: {
    key: string;
    text: string;
    width: SemanticWIDTHS;
    collapsing?: boolean;
  }[] = useMemo(() => {
    const baseCols = [
      {
        key: "name",
        text: "Name",
        width: hasAnyTags ? 5 : (7 as SemanticWIDTHS),
      },
      {
        key: "access",
        text: "Access",
        width: hasAnyTags ? 3 : (5 as SemanticWIDTHS),
      },
      {
        key: "actions",
        text: "",
        width: hasAnyTags ? 1 : (4 as SemanticWIDTHS),
        collapsing: true,
      },
    ];

    if (hasAnyTags) {
      // Insert tags column before actions
      baseCols.splice(-1, 0, { key: "tags", text: "Tags", width: 9 });
    }

    return baseCols;
  }, [hasAnyTags]);

  async function getFiles() {
    try {
      const fileRes = await api.getProjectFiles(projectID, currDirectory);
      if (fileRes.data.err) {
        throw new Error(fileRes.data.errMsg);
      }

      if (
        !Array.isArray(fileRes.data.files) ||
        !Array.isArray(fileRes.data.path)
      ) {
        throw new Error("Unable to fetch files. Please try again later.");
      }

      const withChecked = fileRes.data.files.map((item: ProjectFile) => ({
        ...item,
        checked: false,
      }));
      setCurrDirPath(fileRes.data.path);

      return withChecked;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const itemsChecked = useMemo(() => {
    if (!files) return 0;
    return files.filter((item) => item.checked).length;
  }, [files]);

  const allItemsChecked = useMemo(() => {
    if (!files) return false;
    return files.length > 0 && files.every((item) => item.checked);
  }, [files]);

  const canBulkTag = useMemo(() => {
    if (!files) return false;
    if (files.filter((item) => item.checked).length < 1) return false;
    // If any of the checked files are not of storageType 'file', disable bulk tag
    return !files.some((item) => item.checked && item.storageType !== "file");
  }, [files]);

  const handleEntryCheckedMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => _handleEntryChecked(id),
    onSuccess(data, variables, context) {
      if (!data) return;
      queryClient.setQueryData(FILES_QUERY_KEY, data);
    },
  });

  const handleToggleAllCheckedMutation = useMutation<FileEntry[]>({
    mutationFn: _handleToggleAllChecked,
    onSuccess(data, variables, context) {
      if (!data) return;
      queryClient.setQueryData(FILES_QUERY_KEY, data);
    },
  });

  /**
   * Update state when a File entry is checked/unchecked.
   */
  async function _handleEntryChecked(id: string): Promise<FileEntry[]> {
    if (!id || typeof id !== "string") {
      if (files) return files; // no change
      return [];
    }

    if (!files) return [];
    const newMapped = files.map((item) => {
      if (item.fileID === id) {
        return {
          ...item,
          checked: !item.checked,
        };
      }
      return item;
    });
    return newMapped;
  }

  /**
   * Toggles the checked status of all entries in the list.
   */
  async function _handleToggleAllChecked(): Promise<FileEntry[]> {
    if (!files) return [];

    const foundChecked = files.find((item) => item.checked);
    if (foundChecked) {
      // one checked, uncheck all
      const newMapped = files.map((item) => {
        return {
          ...item,
          checked: false,
        };
      });

      return newMapped;
    }

    // none checked, check all
    const newMapped = files.map((item) => {
      return {
        ...item,
        checked: true,
      };
    });
    return newMapped;
  }

  /**
   * Closes the Files Uploader tool and refreshes the Files list after new upload(s).
   */
  function handleUploadFinished() {
    setShowUploader(false);
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  /**
   * Closes the Add Folder tool and refreshes the Files list after addition.
   */
  function handleAddFolderFinished() {
    setShowAddFolder(false);
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  /**
   * Gathers the File entry to be edited, enters its information into state,
   * and opens the Edit File tool.
   *
   * @param {string} fileID - Identifier of the entry to work on.
   */
  function handleEditFile(fileID: string) {
    if (!fileID) return;
    setEditID(fileID);
    setShowEdit(true);
  }

  /**
   * Closes the Edit File tool and resets its state.
   */
  function handleEditClose() {
    setShowEdit(false);
    setEditID("");
  }

  /**
   * Closes the Edit File tool and refreshes the list of Files after successful edit.
   */
  function handleEditFinished() {
    handleEditClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  /**
   * Gathers the Files to be moved, enters them into state,
   * and opens the Move Files tool.
   */
  function handleMoveFiles(toMove: FileEntry[]) {
    if (toMove.length > 0) {
      setMoveFiles(toMove);
      setShowMove(true);
    }
  }

  /**
   * Closes the Move Files tool and resets its state.
   */
  function handleMoveClose() {
    setShowMove(false);
    setMoveFiles([]);
  }

  /**
   * Closes the Move Files tool and refreshes the list of Files upon successful move.
   */
  function handleMoveFinished() {
    handleMoveClose();
    queryClient.invalidateQueries(["project-files", projectID]); // invalidate entire project as we don't know where it moved
  }

  /**
   * Gathers the Files to be modified, enters them into state,
   * and opens the Change Access tool.
   */
  function handleChangeAccess(toChange: FileEntry[]) {
    if (!canViewDetails) return;
    if (toChange.length > 0) {
      setAccessFiles(toChange);
      setShowChangeAccess(true);
    }
  }

  /**
   * Closes the Change Access tool and resets its state.
   */
  function handleAccessClose() {
    setShowChangeAccess(false);
    setAccessFiles([]);
  }

  /**
   * Closes the Change Access tool and refreshes the list of Files
   * upon successful modification.
   */
  function handleAccessFinished() {
    handleAccessClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  /**
   * Gathers the Files to be deleted, enters them into state,
   * and opens the Delete Files tool.
   */
  function handleDeleteFiles(toDelete: FileEntry[]) {
    if (toDelete.length > 0) {
      setDeleteFiles(toDelete);
      setShowDelete(true);
    }
  }

  /**
   * Closes the Delete Files tool and resets its state.
   */
  function handleDeleteClose() {
    setShowDelete(false);
    setDeleteFiles([]);
  }

  /**
   * Closes the Delete Files tool and refreshes the list of Files upon successful deletion.
   */
  function handleDeleteFinished() {
    handleDeleteClose();
    queryClient.invalidateQueries(FILES_QUERY_KEY);
  }

  function handleDownloadRequest() {
    if (!files) return;
    const requested = files.filter(
      (obj) => obj.checked && obj.storageType === "file" && !obj.isVideo // filter out videos for now
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
          const permanentUrl = response.data.url;
          setPermanentLink(permanentUrl);
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

  function handleDownloadFile(
    projectID: string,
    fileID: string,
    isVideo?: boolean
  ) {
    if (isVideo) {
      window.open(`/file/${projectID}/${fileID}`, "_blank");
      return;
    }
    const success = downloadFile(projectID, fileID);
    if (!success) {
      handleGlobalError(
        new Error("Unable to download file. Please try again later.")
      );
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
        const b64Data = res.data.file;
        const blob = base64ToBlob(b64Data, "application/zip");
        if (!blob) {
          throw new Error("Unable to download files. Please try again later.");
        }
        saveAs(blob, `${projectID}.zip`);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setDownloadLoading(false);
      handleToggleAllCheckedMutation.mutate();
    }
  }

  async function handleGetEmbedCode(
    videoID: string,
    type: "html" | "url" = "html"
  ): Promise<void> {
    try {
      const res = await api.getProjectFileEmbedHTML(projectID, videoID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.embed_html || !res.data.embed_url) {
        throw new Error("Unable to get embed code. Please try again later.");
      }

      const code =
        type === "html"
          ? res.data.embed_html
          : type === "url"
          ? res.data.embed_url
          : res.data.media_id;

      if (!code) {
        throw new Error("Unable to get embed code. Please try again later.");
      }

      const msg =
        type === "html"
          ? "Embed code copied to clipboard. NOTE: This code is only valid on libretexts.org or libretexts.net domains."
          : "Embed URL copied to clipboard. Paste this URL into the ADAPT editor.";

      await copyToClipboard(code, msg);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  /**
   * Updates state with the a new directory to bring into view.
   *
   * @param {string} directoryID - Identifier of the directory entry.
   */
  function handleDirectoryClick(directoryID: string) {
    setCurrDirectory(directoryID);
  }

  function handleBulkTagFiles() {
    if (!files || files.length === 0) return;
    const toTag = files.filter(
      (obj) => obj.checked && obj.storageType === "file"
    );
    if (toTag.length === 0) return;

    openModal(
      <BulkTagModal
        projectID={projectID}
        fileIds={toTag.map((f) => f.fileID)}
        onCancel={() => closeAllModals()}
        onSave={() => {
          queryClient.invalidateQueries({
            queryKey: FILES_QUERY_KEY,
          });
          closeAllModals();
        }}
      />
    );
  }

  /**
   * Generates path breadcrumbs based on the current directory in view.
   *
   * @returns {React.ReactElement} The generated breadcrumbs.
   */
  function DirectoryBreadcrumbs() {
    const nodes: React.ReactElement[] = [];
    currDirPath.forEach((item, idx) => {
      let shouldLink = true;
      let name = item.name;
      if (item.name === "" && item.fileID === "") {
        name = "Files";
      } else {
        nodes.push(
          <Breadcrumb.Divider
            key={`divider-${item.fileID}`}
            icon="right chevron"
          />
        );
      }
      if (idx === currDirPath.length - 1) {
        shouldLink = false; // don't click active directory
      }
      nodes.push(
        <span
          key={`section-${item.fileID}`}
          onClick={
            shouldLink ? () => handleDirectoryClick(item.fileID) : undefined
          }
          className={shouldLink ? "text-link" : ""}
        >
          {name}
        </span>
      );
    });
    return <Breadcrumb>{nodes}</Breadcrumb>;
  }

  const RowMenu = (item: FileEntry) => {
    return (
      <Dropdown
        icon={null}
        trigger={<Icon name="ellipsis vertical" size="large" />}
        direction="left"
      >
        <Dropdown.Menu>
          {canViewDetails && (
            <>
              <Dropdown.Item
                icon="edit"
                text="Edit"
                onClick={() => handleEditFile(item.fileID)}
              />
              <Dropdown.Item
                icon="move"
                text="Move"
                onClick={() => handleMoveFiles([item])}
              />
              <Dropdown.Item
                icon="trash"
                text="Delete"
                onClick={() => handleDeleteFiles([item])}
              />
            </>
          )}
          {item.storageType === "file" && !item.isURL && (
            <Dropdown.Item
              icon="download"
              text="Download"
              onClick={() =>
                handleDownloadFile(projectID, item.fileID, item.isVideo)
              }
            />
          )}
          {item.storageType === "file" &&
            !item.isURL &&
            item.access === "public" && (
              <Dropdown.Item
                icon="share"
                text="Permanent Link"
                onClick={() => handlePermanentLinkClick(projectID, item.fileID)}
              />
            )}
          {item.storageType === "file" &&
            item.isVideo &&
            item.videoStorageID &&
            item.access === "public" &&
            projectVisibility === "public" && (
              <Dropdown.Item
                icon="code"
                text="Embed"
                onClick={async () => {
                  await handleGetEmbedCode(item.fileID, "html");
                }}
              />
            )}
          {item.storageType === "file" &&
            item.isVideo &&
            item.videoStorageID &&
            item.access === "public" &&
            projectVisibility === "public" && (
              <Dropdown.Item
                icon="student"
                text="Copy to ADAPT"
                onClick={async () => {
                  await handleGetEmbedCode(item.fileID, "url");
                }}
              />
            )}
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  const MobileTableRow = (item: FileEntry) => {
    return (
      <Table.Row key={item.fileID}>
        <Table.Cell colSpan={TABLE_COLS.length}>
          <div className="flex flex-row w-full">
            <div className="flex flex-col w-full">
              <p>
                {item.storageType === "folder" ? (
                  <Icon name="folder outline" />
                ) : (
                  <Icon name={getFileTypeIcon(item)} />
                )}
                {item.storageType === "folder" ? (
                  <span
                    className="text-link text-lg break-all"
                    onClick={() => handleDirectoryClick(item.fileID)}
                  >
                    {item.name}
                  </span>
                ) : (
                  <a
                    onClick={() =>
                      handleDownloadFile(projectID, item.fileID, item.isVideo)
                    }
                    className="text-lg cursor-pointer break-all"
                  >
                    {item.name}
                  </a>
                )}
              </p>
              <p>{item.description}</p>
              {hasAnyTags && item.tags && item.tags.length > 0 && (
                <div>
                  <RenderAssetTags file={item} popupDisabled spreadArray />
                </div>
              )}
            </div>
            <div className="flex flex-col">{RowMenu(item)}</div>
          </div>
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <Grid.Column className="!w-full">
      <Header as="h2" dividing>
        Assets
        <Button compact floated="right" onClick={toggleFilesManager}>
          Hide
        </Button>
      </Header>
      {projectVisibility === "private" && files && files.length > 0 && (
        <Message size="small" color="blue" style={{ backgroundColor: "#fff" }}>
          <Message.Content>
            Heads up! Your project's visibility is set to 'Private', so assets
            shown here won't be visible in Commons even if their access is set
            to 'Public'.
          </Message.Content>
        </Message>
      )}
      <Segment.Group size="large" raised className="mb-4">
        {(canViewDetails || allowBulkDownload) && (
          <Segment>
            {canViewDetails && (
              <p style={{ fontSize: "0.9em" }} className="mb-4">
                If your project has supporting files, use this tool to upload and
                organize them.
              </p>
            )}
            <Button.Group
              fluid
              widths="7"
              className={
                itemsChecked === 0
                  ? "max-w-[34rem]"
                  : itemsChecked === 1
                  ? "max-w-[46rem]"
                  : ""
              }
            >
              {canViewDetails && (
                <>
                  <Button color="green" onClick={() => setShowUploader(true)}>
                    <Icon name="upload" />
                    Upload
                  </Button>
                  <Button
                    color="green"
                    className="!bg-green-600"
                    onClick={() => setShowAddFolder(true)}
                  >
                    <Icon name="add" />
                    New Folder
                  </Button>
                </>
              )}
              {itemsChecked > 1 && (
                <Button
                  color="blue"
                  onClick={handleDownloadRequest}
                  disabled={downloadLoading}
                >
                  {!downloadLoading && (
                    <>
                      <Icon name="download" />
                      Download (ZIP)
                    </>
                  )}
                  {downloadLoading && (
                    <>
                      <Icon name="spinner" loading />
                      This may take a moment...
                    </>
                  )}
                </Button>
              )}
              {canViewDetails && itemsChecked > 1 && (
                <Button
                  color="teal"
                  disabled={itemsChecked < 1}
                  onClick={() => {
                    handleMoveFiles(files?.filter((obj) => obj.checked) || []);
                  }}
                >
                  <Icon name="move" />
                  Move
                </Button>
              )}
              {canViewDetails && itemsChecked > 0 && (
                <Button
                  color="yellow"
                  disabled={itemsChecked < 1}
                  onClick={() => {
                    handleChangeAccess(
                      files?.filter((obj) => obj.checked) || []
                    );
                  }}
                >
                  <Icon name="lock" />
                  Change Access
                </Button>
              )}
              {canViewDetails && canBulkTag && (
                <Button
                  color="purple"
                  disabled={itemsChecked < 1}
                  onClick={() => {
                    handleBulkTagFiles();
                  }}
                >
                  <Icon name="tags" />
                  Bulk Tag
                </Button>
              )}
              {canViewDetails && itemsChecked > 1 && (
                <Button
                  color="red"
                  disabled={itemsChecked < 1}
                  onClick={() => {
                    handleDeleteFiles(
                      files?.filter((obj) => obj.checked) || []
                    );
                  }}
                >
                  <Icon name="trash" />
                  Delete
                </Button>
              )}
            </Button.Group>
          </Segment>
        )}
        {!filesLoading ? (
          <>
            {currDirectory !== "" && (
              <Segment attached="top">
                <DirectoryBreadcrumbs />
              </Segment>
            )}
            <Table basic attached="bottom">
              <Table.Header>
                <Table.Row>
                  {(canViewDetails || allowBulkDownload) && (
                    <Table.HeaderCell key="check" collapsing={true}>
                      <input
                        type="checkbox"
                        checked={allItemsChecked}
                        onChange={() => {
                          handleToggleAllCheckedMutation.mutate();
                        }}
                        aria-label={`${
                          allItemsChecked ? "Uncheck" : "Check"
                        } all`}
                      />
                    </Table.HeaderCell>
                  )}
                  {/* {TABLE_COLS.map((item) => (
                    <Table.HeaderCell
                      key={item.key}
                      collapsing={item.collapsing}
                      width={item.width}
                    >
                      {item.text}
                    </Table.HeaderCell>
                  ))} */}
                  {isTailwindLg ? (
                    // Desktop: Show all columns
                    TABLE_COLS.map((item) => (
                      <Table.HeaderCell
                        key={item.key}
                        collapsing={item.collapsing}
                        width={item.width}
                      >
                        {item.text}
                      </Table.HeaderCell>
                    ))
                  ) : (
                    // Mobile: Just show a single "Files" header
                    <Table.HeaderCell>Files</Table.HeaderCell>
                  )}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {files?.map((item) => {
                  if (!isTailwindLg) return MobileTableRow(item);
                  return (
                    <Table.Row className="h-[60px]" key={item.fileID}>
                      {(canViewDetails || allowBulkDownload) && (
                        <Table.Cell>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) =>
                              handleEntryCheckedMutation.mutate({
                                id: item.fileID,
                              })
                            }
                            value={item.fileID}
                          />
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        <div className="flex items-center justify-between">
                          <div className="w-full">
                            <div
                              className={`flex flex-row justify-between ${
                                item.description ? "mb-05e" : ""
                              }`}
                            >
                              <div>
                                {item.storageType === "folder" ? (
                                  <Icon name="folder outline" />
                                ) : (
                                  <Icon name={getFileTypeIcon(item)} />
                                )}
                                {item.storageType === "folder" ? (
                                  <span
                                    className="text-link text-lg break-all"
                                    onClick={() =>
                                      handleDirectoryClick(item.fileID)
                                    }
                                  >
                                    {item.name}
                                  </span>
                                ) : (
                                  <a
                                    onClick={() =>
                                      handleDownloadFile(
                                        projectID,
                                        item.fileID,
                                        item.isVideo
                                      )
                                    }
                                    className="text-lg cursor-pointer break-all"
                                  >
                                    {item.name}
                                  </a>
                                )}
                              </div>
                              <Popup
                                content={
                                  <div>
                                    <p>
                                      <span className="font-semibold">
                                        License:
                                      </span>{" "}
                                      {getFilesLicenseText(item.license)}
                                    </p>
                                    {item.storageType === "file" && (
                                      <p>
                                        <span className="font-semibold">
                                          Size:
                                        </span>{" "}
                                        {fileSizePresentable(item.size)}
                                      </p>
                                    )}
                                    {item.createdDate && (
                                      <p>
                                        <span className="font-semibold">
                                          Created:
                                        </span>{" "}
                                        {getPrettyCreatedDate(item.createdDate)}{" "}
                                        {item.uploader && (
                                          <span>
                                            {" "}
                                            by{" "}
                                            {getPrettyUploader(item.uploader)}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                }
                                trigger={
                                  <Icon name="info circle" className="ml-1e" />
                                }
                              />
                            </div>
                            {item.description && (
                              <span className="muted-text ml-1e">
                                {truncateString(item.description, 100)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {canViewDetails ? (
                          <button
                            className="hover:underline text-blue-600 text-left"
                            onClick={() => handleChangeAccess([item])}
                            disabled={!canViewDetails}
                          >
                            {getFilesAccessText(item.access)}
                          </button>
                        ) : (
                          getFilesAccessText(item.access)
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {item.tags && item.tags.length > 0 && (
                          <RenderAssetTags
                            file={item}
                            popupDisabled
                            spreadArray
                          />
                        )}
                      </Table.Cell>
                      <Table.Cell>{RowMenu(item)}</Table.Cell>
                    </Table.Row>
                  );
                })}
                {(!files || files.length === 0) && (
                  <Table.Row>
                    <Table.Cell colSpan={TABLE_COLS.length}>
                      <p className="text-muted text-center mt-1p mb-1p">
                        <em>No files found.</em>
                      </p>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
              <Table.Footer>
                <Table.Row>
                  <Table.Cell colSpan={TABLE_COLS.length}>
                    <p className="text-center text-sm text-gray-500 italic !-mt-3">
                      Use caution when opening files/links from unknown sources.
                      LibreTexts is not responsible for the content of the
                      files/links above.
                    </p>
                  </Table.Cell>
                </Table.Row>
              </Table.Footer>
            </Table>
          </>
        ) : (
          <Loader active inline="centered" className="mt-2r mb-2r" />
        )}
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
      </Segment.Group>
    </Grid.Column>
  );
};

export default FilesManager;
