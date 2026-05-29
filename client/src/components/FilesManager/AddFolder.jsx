import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button, Input, Modal } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
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
    <Modal open={show} onClose={() => onClose()} size="sm">
      <Modal.Header>
        <Modal.Title>New Folder</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit}>
          <Input
            name="foldername"
            label="Folder Name"
            type="text"
            placeholder="New Folder..."
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            error={nameError}
            errorMessage={
              nameError
                ? "Folder name must be between 1 and 100 characters."
                : undefined
            }
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleAddFolder}
          loading={loading}
          icon={<IconPlus size={16} />}
        >
          Add Folder
        </Button>
      </Modal.Footer>
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
