import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Modal, Loader, Icon, Breadcrumb, Table, Segment } from 'semantic-ui-react';
import date from 'date-and-time';
import AddFolder from './AddFolder';
import ChangeAccess from './ChangeAccess';
import DeleteMaterials from './DeleteMaterials';
import FileIcon from '../FileIcon';
import MaterialsUploader from './MaterialsUploader';
import MoveMaterials from './MoveMaterials';
import EditMaterial from './EditMaterial';
import { getMaterialsAccessText } from '../util/BookHelpers';
import { fileSizePresentable, truncateString } from '../util/HelperFunctions';
import useGlobalError from '../error/ErrorHooks';
import styles from './MaterialsManager.module.css';

/**
 * Modal tool to manage the Ancillary Materials set for a Commons Book
 * linked to a Conductor Project.
 */
const MaterialsManager = ({ projectID, show, onClose, ...props }) => {

  const TABLE_COLS = [
    { key: 'check', text: '', collapsing: true },
    { key: 'name', text: 'Name', width: 8 },
    { key: 'access', text: 'Access', width: 2, },
    { key: 'size', text: 'Size', width: 1 },
    { key: 'uploaded', text: 'Created/Uploaded', width: 4 },
    { key: 'download', text: '', collapsing: true },
  ];

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  const [materials, setMaterials] = useState([]);

  const [showUploader, setShowUploader] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showChangeAccess, setShowChangeAccess] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [itemsChecked, setItemsChecked] = useState(0);
  const [allItemsChecked, setAllItemsChecked] = useState(false);

  const [currDirectory, setCurrDirectory] = useState('');
  const [currDirPath, setCurrDirPath] = useState([{
    materialID: '',
    name: '',
  }]);

  const [editID, setEditID] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescrip, setEditDescrip] = useState('');
  const [moveMaterials, setMoveMaterials] = useState([]);
  const [accessMaterials, setAccessMaterials] = useState([]);
  const [deleteMaterials, setDeleteMaterials] = useState([]);

  /**
   * Load the Materials list from the server, prepare it for the UI, then save it to state.
   */
  const getMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    try {
      const matRes = await axios.get(
        `/project/${projectID}/book/materials/${currDirectory}?depth=1`,
      );
      if (!matRes.data.err) {
        if (Array.isArray(matRes.data.materials)) {
          const withChecked = matRes.data.materials.map((item) => ({
            ...item,
            checked: false,
          }));
          setMaterials(withChecked);
          setAllItemsChecked(false);
        }
        if (Array.isArray(matRes.data.path)) {
          setCurrDirPath(matRes.data.path);
        }
      } else {
        throw (new Error(matRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setMaterialsLoading(false);
  }, [projectID, currDirectory, setMaterialsLoading, setMaterials,
    setCurrDirPath, handleGlobalError, setAllItemsChecked]);

  /**
   * Load the Materials list on open.
   */
  useEffect(() => {
    if (show) {
      getMaterials();
    }
  }, [show, getMaterials]);

  /**
   * Track updates to the number and type of currently checked files.
   */
  useEffect(() => {
    let numChecked = 0;
    materials.forEach((item) => {
      if (item.checked) {
        numChecked += 1;
      }
    });
    setItemsChecked(numChecked);
  }, [materials, setItemsChecked]);

  /**
   * Update state when a Material entry is checked/unchecked.
   */
  function handleEntryChecked({ target }) {
    setMaterials((prevMaterials) => prevMaterials.map((item) => {
      if (item.materialID === target.value) {
        return {
          ...item,
          checked: !item.checked,
        }
      }
      return item;
    }));
  }

  /**
   * Toggles the checked status of all entries in the list.
   */
  function handleToggleAllChecked() {
    const foundChecked = materials.find((item) => item.checked);
    if (foundChecked) { // one checked, uncheck all
      setMaterials((prevMaterials) => prevMaterials.map((item) => {
        return {
          ...item,
          checked: false,
        };
      }));
      setAllItemsChecked(false);
    } else { // none checked, check all
      setMaterials((prevMaterials) => prevMaterials.map((item) => {
        return {
          ...item,
          checked: true,
        };
      }));
      setAllItemsChecked(true);
    }
  }

  /**
   * Sets the Materials Uploader tool to open.
   */
  function handleShowUploader() {
    setShowUploader(true);
  }

  /**
   * Sets the Materials Uploader tool to closed.
   */
  function handleUploaderClose() {
    setShowUploader(false);
  }

  /**
   * Closes the Materials Uploader tool and refreshes the Materials list after new upload(s).
   */
  function handleUploadFinished() {
    setShowUploader(false);
    getMaterials();
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
   * Closes the Add Folder tool and refreshes the Materials list after addition.
   */
  function handleAddFolderFinished() {
    setShowAddFolder(false);
    getMaterials();
  }

  /**
   * Gathers the Material entry to be edited, enters its information into state,
   * and opens the Edit Material tool.
   *
   * @param {string} materialID - Identifier of the entry to work on.
   */
  function handleEditMaterial(materialID) {
    const toEdit = materials.find((obj) => obj.materialID === materialID);
    if (toEdit) {
      setEditID(toEdit.materialID);
      setEditName(toEdit.name);
      setEditDescrip(toEdit.description || '');
      setShowEdit(true);
    }
  }

  /**
   * Closes the Edit Material tool and resets its state.
   */
  function handleEditClose() {
    setShowEdit(false);
    setEditID('');
    setEditName('');
    setEditDescrip('');
  }

  /**
   * Closes the Edit Material tool and refreshes the list of Materials after successful edit.
   */
  function handleEditFinished() {
    handleEditClose();
    getMaterials();
  }

  /**
   * Gathers the Materials to be moved, enters them into state,
   * and opens the Move Materials tool.
   */
  function handleMoveMaterials() {
    const toMove = materials.filter((obj) => obj.checked);
    if (toMove.length > 0) {
      setMoveMaterials(toMove);
      setShowMove(true);
    }
  }

  /**
   * Closes the Move Materials tool and resets its state.
   */
  function handleMoveClose() {
    setShowMove(false);
    setMoveMaterials([]);
  }

  /**
   * Closes the Move Materials tool and refreshes the list of Materials upon successful move.
   */
  function handleMoveFinished() {
    handleMoveClose();
    getMaterials();
  }

  /**
   * Gathers the Materials to be modified, enters them into state,
   * and opens the Change Access tool.
   */
  function handleChangeAccess() {
    const toChange = materials.filter((obj) => obj.checked);
    if (toChange.length > 0) {
      setAccessMaterials(toChange);
      setShowChangeAccess(true);
    }
  }

  /**
   * Closes the Change Access tool and resets its state.
   */
  function handleAccessClose() {
    setShowChangeAccess(false);
    setAccessMaterials([]);
  }

  /**
   * Closes the Change Access tool and refreshes the list of Materials
   * upon successful modification.
   */
  function handleAccessFinished() {
    handleAccessClose();
    getMaterials();
  }

  /**
   * Gathers the Materials to be deleted, enters them into state,
   * and opens the Delete Materials tool.
   */
  function handleDeleteMaterials() {
    const toDelete = materials.filter((obj) => obj.checked);
    if (toDelete.length > 0) {
      setDeleteMaterials(toDelete);
      setShowDelete(true);
    }
  }

  /**
   * Closes the Delete Materials tool and resets its state.
   */
  function handleDeleteClose() {
    setShowDelete(false);
    setDeleteMaterials([]);
  }

  /**
   * Closes the Delete Material tool and refreshes the list of Materials upon successful deletion.
   */
  function handleDeleteFinished() {
    handleDeleteClose();
    getMaterials();
  }

  /**
   * Requests a download link from the server for a Materials entry, then opens it in a new tab.
   *
   * @param {string} materialID - Identifier of the material to download.
   */
  async function handleDownloadFile(materialID) {
    try {
      const downloadRes = await axios.get(`/project/${projectID}/book/material/${materialID}`);
      if (!downloadRes.data.err) {
        if (typeof (downloadRes.data.url) === 'string') {
          window.open(downloadRes.data.url, '_blank', 'noreferrer');
        }
      } else {
        throw (new Error(downloadRes.data.errMsg));
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
      if (item.name === '' && item.materialID === '') {
        name = 'Materials';
      } else {
        nodes.push(
          <Breadcrumb.Divider key={`divider-${item.materialID}`} icon="right chevron" />
        )
      }
      if (idx === currDirPath.length - 1) {
        shouldLink = false; // don't click active directory
      }
      nodes.push(
        <span
          key={`section-${item.materialID}`}
          onClick={shouldLink ? () => handleDirectoryClick(item.materialID) : undefined}
          className={shouldLink ? 'text-link' : ''}
        >
          {name}
        </span>
      )
    });
    return (
      <Breadcrumb>
        {nodes}
      </Breadcrumb>
    );
  }

  return (
    <Modal size="fullscreen" open={show} onClose={onClose} {...props}>
      <Modal.Header>Manage Ancillary Materials</Modal.Header>
      <Modal.Content scrolling>
        <p>If your resource has ancillary materials, use this tool to upload and organize them. Materials will be visible to the public on Commons via the resource's catalog entry.</p>
        <Button.Group fluid widths="6">
          <Button color="green" onClick={handleShowUploader}>
            <Icon name="upload" />
            Upload
          </Button>
          <Button color="olive" onClick={handleShowAddFolder}>
            <Icon name="add" />
            New Folder
          </Button>
          <Button color="teal" disabled={itemsChecked < 1} onClick={handleMoveMaterials}>
            <Icon name="move" />
            Move
          </Button>
          <Button
            color="yellow"
            disabled={itemsChecked < 1}
            onClick={handleChangeAccess}
          >
            <Icon name="lock" />
            Change Access
          </Button>
          <Button color="red" disabled={itemsChecked < 1} onClick={handleDeleteMaterials}>
            <Icon name="trash" />
            Delete
          </Button>
        </Button.Group>
        {!materialsLoading ? (
          <>
            <Segment attached="top">
              <DirectoryBreadcrumbs />
            </Segment>
            <Table basic attached="bottom">
              <Table.Header>
                <Table.Row>
                  {TABLE_COLS.map((item) => (
                    <Table.HeaderCell key={item.key} collapsing={item.collapsing} width={item.width}>
                      {item.text}
                      {item.key === 'check' && (
                        <input
                          type="checkbox"
                          checked={allItemsChecked}
                          onChange={handleToggleAllChecked}
                          aria-label={`${allItemsChecked ? 'Uncheck' : 'Check'} all`}
                        />
                      )}
                    </Table.HeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {materials.map((item) => {
                  let uploadTime = null;
                  let uploaderName = null;
                  if (item.createdDate) {
                    const dateInstance = new Date(item.createdDate);
                    uploadTime = date.format(dateInstance, 'MM/DD/YY h:mm A');
                  }
                  if (item.uploader?.firstName && item.uploader?.lastName) {
                    uploaderName = `${item.uploader.firstName} ${item.uploader.lastName}`;
                  }
                  return (
                    <Table.Row className={styles.table_row} key={item.materialID}>
                      <Table.Cell>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={handleEntryChecked}
                          value={item.materialID}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <div className={styles.namedescrip_cell}>
                          <div>
                            <div className={item.description ? 'mb-05e' : ''}>
                              {item.storageType === 'folder' ? (
                                <Icon name="folder outline" />
                              ) : (
                                <FileIcon filename={item.name} />
                              )}
                              {item.storageType === 'folder' ? (
                                <span
                                  className={`text-link ${styles.namedescrip_title}`}
                                  onClick={() => handleDirectoryClick(item.materialID)}
                                >
                                  {item.name}
                                </span>
                              ) : (
                                <span className={styles.namedescrip_title}>{item.name}</span>
                              )}
                            </div>
                            {item.description && (
                              <span className="muted-text ml-1e">{truncateString(item.description, 100)}</span>
                            )}
                          </div>
                          <Button
                            icon="edit"
                            size="small"
                            basic
                            circular
                            title="Edit name or description"
                            onClick={() => handleEditMaterial(item.materialID)}
                          />
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {getMaterialsAccessText(item.access)}
                      </Table.Cell>
                      <Table.Cell>
                        {item.storageType === 'file' && fileSizePresentable(item.size)}
                      </Table.Cell>
                      <Table.Cell>
                        {uploadTime && (
                          <span>{uploadTime} </span>
                        )}
                        {uploaderName && (
                          <span>by {uploaderName}</span>
                        )}
                      </Table.Cell>
                      <Table.Cell textAlign="center">
                        {item.storageType === 'file' && (
                          <Button
                            icon
                            size="small"
                            title="Download file (opens in new tab)"
                            onClick={() => handleDownloadFile(item.materialID)}
                          >
                            <Icon name="download" />
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
                {materials.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={TABLE_COLS.length}>
                      <p className="text-muted text-center mt-1p mb-1p">
                        <em>No materials found.</em>
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
        <MaterialsUploader
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
          parentDirectory={currDirPath[currDirPath.length - 1].materialID}
          onFinishedAdd={handleAddFolderFinished}
        />
        <ChangeAccess
          show={showChangeAccess}
          onClose={handleAccessClose}
          projectID={projectID}
          materials={accessMaterials}
          onFinishedChange={handleAccessFinished}
        />
        <EditMaterial
          show={showEdit}
          onClose={handleEditClose}
          projectID={projectID}
          materialID={editID}
          currentName={editName}
          currentDescrip={editDescrip}
          onFinishedEdit={handleEditFinished}
        />
        <MoveMaterials
          show={showMove}
          onClose={handleMoveClose}
          projectID={projectID}
          materials={moveMaterials}
          currentDirectory={currDirectory}
          onFinishedMove={handleMoveFinished}
        />
        <DeleteMaterials
          show={showDelete}
          onClose={handleDeleteClose}
          projectID={projectID}
          materials={deleteMaterials}
          onFinishedDelete={handleDeleteFinished}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} color="blue">Done</Button>
      </Modal.Actions>
    </Modal>
  )
};

MaterialsManager.propTypes = {
  /**
   * Identifier of the project Materials belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Opens or closes the modal.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
};

MaterialsManager.defaultProps = {
  onClose: () => { },
};

export default MaterialsManager;
