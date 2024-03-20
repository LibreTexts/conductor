import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Modal, Form, Button, Icon } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";

/**
 * Modal tool to add a new folder to an Project Files list.
 */
const AddFolder = ({
  show,
  onClose,
  projectID,
  parentDirectory,
  onFinishedAdd,
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Form State
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [nameError, setNameError] = useState(false);

  /**
   * Reset the folder name input on open/close.
   */
  useEffect(() => {
    setFolderName("");
  }, [show, setFolderName]);

  /**
   * Updates the new folder name in state.
   *
   * @param {React.ChangeEvent} e - Event that activated the handler.
   */
  function handleFolderNameChange(e) {
    setFolderName(e.target.value);
  }

  /**
   * Prevents default actions if the modal form is submitted.
   *
   * @param {React.FormEvent} e - Event that activated the handler.
   */
  function handleSubmit(e) {
    e.preventDefault();
  }

  /**
   * Resets any error states in the form.
   */
  function resetFormErrors() {
    setNameError(false);
  }

  /**
   * Validates the form's inputs and sets error states if necessary.
   *
   * @returns {boolean} True if all inputs valid, false otherwise.
   */
  function validateForm() {
    let validForm = true;
    if (folderName.length < 1 || folderName.length > 100) {
      validForm = false;
      setNameError(true);
    }
    return validForm;
  }

  /**
   * Submits the folder creation action to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleAddFolder() {
    resetFormErrors();
    if (validateForm()) {
      setLoading(true);
      try {
        const createRes = await api.addProjectFileFolder(
          projectID,
          folderName,
          parentDirectory
        );
        if (!createRes.data.err) {
          setLoading(false);
          onFinishedAdd();
        } else {
          throw new Error(createRes.data.errMsg);
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>New Folder</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleSubmit}>
          <Form.Field error={nameError}>
            <label htmlFor="foldername">Folder Name</label>
            <input
              id="foldername"
              type="text"
              placeholder="New Folder..."
              value={folderName}
              onChange={handleFolderNameChange}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAddFolder} color="green" loading={loading}>
          <Icon name="add" />
          Add Folder
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

AddFolder.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the project files are being added to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Identifier of the directory to add the new folder under.
   */
  parentDirectory: PropTypes.string,
  /**
   * Handler to activate when the folder has been created.
   */
  onFinishedAdd: PropTypes.func,
};

AddFolder.defaultProps = {
  onClose: () => {},
  parentDirectory: "",
  onFinishedAdd: () => {},
};

export default AddFolder;
