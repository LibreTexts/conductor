import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import {
  Button,
  Loader,
  Icon,
  Breadcrumb,
  Table,
  Segment,
  Grid,
  Header
} from "semantic-ui-react";
import date from "date-and-time";
import AddFolder from "./AddFolder";
import ChangeAccess from "./ChangeAccess";
import DeleteFiles from "./DeleteFiles";
import FileIcon from "../FileIcon";
import FilesUploader from "./FilesUploader";
import MoveFiles from "./MoveFiles";
import EditFile from "./EditFile";
import {
  checkProjectMemberPermission,
  getFilesAccessText,
} from "../util/ProjectHelpers";
import { fileSizePresentable, truncateString } from "../util/HelperFunctions";
import useGlobalError from "../error/ErrorHooks";
import styles from "./FilesManager.module.css";

/**
 * Modal tool to manage Files set for a Project
 */
const FilesManager = ({ projectID, toggleFilesManager, canViewDetails }) => {
  const TABLE_COLS = [
    { key: "name", text: "Name", width: 8 },
    { key: "access", text: "Access", width: 2 },
    { key: "size", text: "Size", width: 1 },
    { key: "uploaded", text: "Created/Uploaded", width: 4 },
    { key: "download", text: "", collapsing: true },
  ];

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  const [files, setFiles] = useState([]);

  const [showUploader, setShowUploader] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showChangeAccess, setShowChangeAccess] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [itemsChecked, setItemsChecked] = useState(0);
  const [allItemsChecked, setAllItemsChecked] = useState(false);

  const [currDirectory, setCurrDirectory] = useState("");
  const [currDirPath, setCurrDirPath] = useState([
    {
      fileID: "",
      name: "",
    },
  ]);

  const [editID, setEditID] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescrip, setEditDescrip] = useState("");
  const [moveFiles, setMoveFiles] = useState([]);
  const [accessFiles, setAccessFiles] = useState([]);
  const [deleteFiles, setDeleteFiles] = useState([]);

  /**
   * Load the Files list from the server, prepare it for the UI, then save it to state.
   */
  const getFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const fileRes = await axios.get(
        `/project/${projectID}/files/${currDirectory}?depth=1`
      );
      if (!fileRes.data.err) {
        if (Array.isArray(fileRes.data.files)) {
          const withChecked = fileRes.data.files.map((item) => ({
            ...item,
            checked: false,
          }));
          setFiles(withChecked);
          setAllItemsChecked(false);
        }
        if (Array.isArray(fileRes.data.path)) {
          setCurrDirPath(fileRes.data.path);
        }
      } else {
        throw new Error(fileRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setFilesLoading(false);
  }, [
    projectID,
    currDirectory,
    setFilesLoading,
    setFiles,
    setCurrDirPath,
    handleGlobalError,
    setAllItemsChecked,
  ]);

  /**
   * Load the Files list on open.
   */
  useEffect(() => {
      getFiles();
  }, [currDirectory]);

  /**
   * Track updates to the number and type of currently checked files.
   */
  useEffect(() => {
    let numChecked = 0;
    files.forEach((item) => {
      if (item.checked) {
        numChecked += 1;
      }
    });
    setItemsChecked(numChecked);
  }, [files, setItemsChecked]);

  /**
   * Update state when a File entry is checked/unchecked.
   */
  function handleEntryChecked({ target }) {
    setFiles((prevFiles) =>
      prevFiles.map((item) => {
        if (item.fileID === target.value) {
          return {
            ...item,
            checked: !item.checked,
          };
        }
        return item;
      })
    );
  }

  /**
   * Toggles the checked status of all entries in the list.
   */
  function handleToggleAllChecked() {
    const foundChecked = files.find((item) => item.checked);
    if (foundChecked) {
      // one checked, uncheck all
      setFiles((prevFiles) =>
        prevFiles.map((item) => {
          return {
            ...item,
            checked: false,
          };
        })
      );
      setAllItemsChecked(false);
    } else {
      // none checked, check all
      setFiles((prevFiles) =>
        prevFiles.map((item) => {
          return {
            ...item,
            checked: true,
          };
        })
      );
      setAllItemsChecked(true);
    }
  }

  /**
   * Sets the Files Uploader tool to open.
   */
  function handleShowUploader() {
    setShowUploader(true);
  }

  /**
   * Sets the Files Uploader tool to closed.
   */
  function handleUploaderClose() {
    setShowUploader(false);
  }

  /**
   * Closes the Files Uploader tool and refreshes the Files list after new upload(s).
   */
  function handleUploadFinished() {
    setShowUploader(false);
    getFiles();
  }

  /**
   * Sets the Add Folder tool to open.
   */
  function handleShowAddFolder() {
    setShowAddFolder(true);
  }

  /**
   * Set the Add Folder tool to close.
   */
  function handleAddFolderClose() {
    setShowAddFolder(false);
  }

  /**
   * Closes the Add Folder tool and refreshes the Files list after addition.
   */
  function handleAddFolderFinished() {
    setShowAddFolder(false);
    getFiles();
  }

  /**
   * Gathers the File entry to be edited, enters its information into state,
   * and opens the Edit File tool.
   *
   * @param {string} fileID - Identifier of the entry to work on.
   */
  function handleEditFile(fileID) {
    const toEdit = files.find((obj) => obj.fileID === fileID);
    if (toEdit) {
      setEditID(toEdit.fileID);
      setEditName(toEdit.name);
      setEditDescrip(toEdit.description || "");
      setShowEdit(true);
    }
  }

  /**
   * Closes the Edit File tool and resets its state.
   */
  function handleEditClose() {
    setShowEdit(false);
    setEditID("");
    setEditName("");
    setEditDescrip("");
  }

  /**
   * Closes the Edit File tool and refreshes the list of Files after successful edit.
   */
  function handleEditFinished() {
    handleEditClose();
    getFiles();
  }

  /**
   * Gathers the Files to be moved, enters them into state,
   * and opens the Move Files tool.
   */
  function handleMoveFiles() {
    const toMove = files.filter((obj) => obj.checked);
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
    getFiles();
  }

  /**
   * Gathers the Files to be modified, enters them into state,
   * and opens the Change Access tool.
   */
  function handleChangeAccess() {
    const toChange = files.filter((obj) => obj.checked);
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
    getFiles();
  }

  /**
   * Gathers the Files to be deleted, enters them into state,
   * and opens the Delete Files tool.
   */
  function handleDeleteFiles() {
    const toDelete = files.filter((obj) => obj.checked);
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
    getFiles();
  }

  /**
   * Requests a download link from the server for a File entry, then opens it in a new tab.
   *
   * @param {string} fileID - Identifier of the File to download.
   */
  async function handleDownloadFile(fileID) {
    try {
      const downloadRes = await axios.get(
        `/project/${projectID}/files/${fileID}/download`
      );
      if (!downloadRes.data.err) {
        if (typeof downloadRes.data.url === "string") {
          window.open(downloadRes.data.url, "_blank", "noreferrer");
        }
      } else {
        throw new Error(downloadRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }

  /**
   * Updates state with the a new directory to bring into view.
   *
   * @param {string} directoryID - Identifier of the directory entry.
   */
  function handleDirectoryClick(directoryID) {
    setCurrDirectory(directoryID);
  }

  /**
   * Generates path breadcrumbs based on the current directory in view.
   *
   * @returns {React.ReactElement} The generated breadcrumbs.
   */
  function DirectoryBreadcrumbs() {
    const nodes = [];
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

  return (
    <Grid.Column>
      <Header as="h2" dividing>
        Files
        <Button compact floated="right" onClick={toggleFilesManager}>
          Hide
        </Button>
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
      {
        canViewDetails && (
              <Segment>
                <p style={{fontSize: '0.9em'}}>
                  If your project has supporting files, use this tool to upload and
                  organize them. Files with 'public' access will be visible to the
                  public on Commons via the resource's catalog entry.
                </p>
                <Button.Group fluid widths="6">
                  <Button color="green" onClick={handleShowUploader}>
                    <Icon name="upload" />
                    Upload
                  </Button>
                  <Button color="olive" onClick={handleShowAddFolder}>
                    <Icon name="add" />
                    New Folder
                  </Button>
                  <Button
                    color="teal"
                    disabled={itemsChecked < 1}
                    onClick={handleMoveFiles}
                  >
                    <Icon name="move" />
                    Move
                  </Button>
                  <Button
                    color="yellow"
                    disabled={itemsChecked < 1 || !checkProjectMemberPermission}
                    onClick={handleChangeAccess}
                  >
                    <Icon name="lock" />
                    Change Access
                  </Button>
                  <Button
                    color="red"
                    disabled={itemsChecked < 1}
                    onClick={handleDeleteFiles}
                  >
                    <Icon name="trash" />
                    Delete
                  </Button>
                </Button.Group>
              </Segment>
            )
          }
          {!filesLoading ? (
            <>
              <Segment attached="top">
                <DirectoryBreadcrumbs />
              </Segment>
              <Table basic attached="bottom">
                <Table.Header>
                  <Table.Row>
                    {canViewDetails && (
                      <Table.HeaderCell
                        key='check'
                        collapsing={true}
                      >
                        <input
                          type="checkbox"
                          checked={allItemsChecked}
                          onChange={handleToggleAllChecked}
                          aria-label={`${
                            allItemsChecked ? "Uncheck" : "Check"
                          } all`}
                        />
                      </Table.HeaderCell>
                    )}
                    {TABLE_COLS.map((item) => (
                      <Table.HeaderCell
                        key={item.key}
                        collapsing={item.collapsing}
                        width={item.width}
                      >
                        {item.text}
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {files.map((item) => {
                    let uploadTime = null;
                    let uploaderName = null;
                    if (item.createdDate) {
                      const dateInstance = new Date(item.createdDate);
                      uploadTime = date.format(dateInstance, "MM/DD/YY h:mm A");
                    }
                    if (item.uploader?.firstName && item.uploader?.lastName) {
                      uploaderName = `${item.uploader.firstName} ${item.uploader.lastName}`;
                    }
                    return (
                      <Table.Row className={styles.table_row} key={item.fileID}>
                        {canViewDetails && (
                            <Table.Cell>
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={handleEntryChecked}
                                value={item.fileID}
                              />
                            </Table.Cell>
                        )}
                        <Table.Cell>
                          <div className={styles.namedescrip_cell}>
                            <div>
                              <div className={item.description ? "mb-05e" : ""}>
                                {item.storageType === "folder" ? (
                                  <Icon name="folder outline" />
                                ) : (
                                  <FileIcon filename={item.name} />
                                )}
                                {item.storageType === "folder" ? (
                                  <span
                                    className={`text-link ${styles.namedescrip_title}`}
                                    onClick={() =>
                                      handleDirectoryClick(item.fileID)
                                    }
                                  >
                                    {item.name}
                                  </span>
                                ) : (
                                  <span className={styles.namedescrip_title}>
                                    {item.name}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <span className="muted-text ml-1e">
                                  {truncateString(item.description, 100)}
                                </span>
                              )}
                            </div>
                            {canViewDetails &&
                              <Button
                                icon="edit"
                                size="small"
                                basic
                                circular
                                title="Edit name or description"
                                onClick={() => handleEditFile(item.fileID)}
                              />
                            }
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {getFilesAccessText(item.access)}
                        </Table.Cell>
                        <Table.Cell>
                          {item.storageType === "file" &&
                            fileSizePresentable(item.size)}
                        </Table.Cell>
                        <Table.Cell>
                          {uploadTime && <span>{uploadTime} </span>}
                          {uploaderName && <span>by {uploaderName}</span>}
                        </Table.Cell>
                        <Table.Cell textAlign="center">
                          {item.storageType === "file" && (
                            <Button
                              icon
                              size="small"
                              title="Download file (opens in new tab)"
                              onClick={() => handleDownloadFile(item.fileID)}
                            >
                              <Icon name="download" />
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                  {files.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={TABLE_COLS.length}>
                        <p className="text-muted text-center mt-1p mb-1p">
                          <em>No files found.</em>
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </>

          ) : (
            <Loader active inline="centered" className="mt-2r mb-2r" />
          )}
          <FilesUploader
            show={showUploader}
            onClose={handleUploaderClose}
            directory={currDirPath[currDirPath.length - 1].name}
            projectID={projectID}
            uploadPath={currDirectory}
            onFinishedUpload={handleUploadFinished}
          />
          <AddFolder
            show={showAddFolder}
            onClose={handleAddFolderClose}
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
          <EditFile
            show={showEdit}
            onClose={handleEditClose}
            projectID={projectID}
            fileID={editID}
            currentName={editName}
            currentDescrip={editDescrip}
            onFinishedEdit={handleEditFinished}
          />
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
      </Segment.Group>
    </Grid.Column>
  );
};

FilesManager.propTypes = {
  /**
   * Identifier of the project Files belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Function to run when FilesManager view is toggle
   */
  toggleFilesManager: PropTypes.func,
  /**
   * Boolean indicating if user is authorized to manage project files
   */
  canViewDetails: PropTypes.bool
};

FilesManager.defaultProps = {
  toggleFilesManager: () => {},
  canViewDetails: false
};

export default FilesManager;
