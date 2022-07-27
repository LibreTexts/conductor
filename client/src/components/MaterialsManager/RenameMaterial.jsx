import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Form, Button, Icon } from 'semantic-ui-react';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to rename an Ancillary Material entry.
 */
const RenameMaterial = ({
  show,
  onClose,
  projectID,
  materialID,
  currentName,
  onFinishedRename,
}) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Form State
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState(false);

  /**
   * Reset file name input on open/close.
   */
  useEffect(() => {
    setNewName('');
  }, [show, setNewName]);

  /**
   * Updates the new material name in state.
   *
   * @param {React.ChangeEvent} e - Event that activated the handler.
   */
  function handleNewNameChange(e) {
    setNewName(e.target.value);
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
    if (newName.length < 1 || newName.length > 100) {
      validForm = false;
      setNameError(true);
    }
    return validForm;
  }

  /**
   * Submits the material rename request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleRename() {
    resetFormErrors();
    if (validateForm()) {
      setLoading(true);
      try {
        const renameRes = await axios.put(`/project/${projectID}/book/materials/${materialID}`, {
          newName,
        });
        if (!renameRes.data.err) {
          setLoading(false);
          onFinishedRename();
        } else {
          throw (new Error(renameRes.data.errMsg));
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Rename Material</Modal.Header>
      <Modal.Content>
        <p><strong>Current Name:</strong> {currentName}</p>
        <Form onSubmit={handleSubmit}>
          <Form.Field error={nameError}>
            <label htmlFor="namefield">New Name</label>
            <input
              id="namefield"
              type="text"
              placeholder="Material Name..."
              value={newName}
              onChange={handleNewNameChange}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="blue" onClick={handleRename} loading={loading}>
          <Icon name="edit" />
          Rename
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

RenameMaterial.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the project materials belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Identifier of the materials entry to rename.
   */
  materialID: PropTypes.string.isRequired,
  /**
   * Current name of the materials entry being renamed.
   */
  currentName: PropTypes.string,
  /**
   * Handler to activate when the materials entry has been renamed.
   */
  onFinishedRename: PropTypes.func,
};

RenameMaterial.defaultProps = {
  onClose: () => { },
  currentName: '',
  onFinishedRename: () => { },
};

export default RenameMaterial;
