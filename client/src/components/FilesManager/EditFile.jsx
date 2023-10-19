import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Modal, Form, Button, Icon } from 'semantic-ui-react';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to rename an Ancillary Material entry.
 */
const EditFile = ({
  show,
  onClose,
  projectID,
  fileID,
  currentName,
  currentDescrip,
  onFinishedEdit,
}) => {

  const DESCRIP_MAX_CHARS = 500;

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Form State
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [descrip, setDescrip] = useState('');
  const [descripCharsRemain, setDescripCharsRemain] = useState(DESCRIP_MAX_CHARS);
  const [nameError, setNameError] = useState(false);
  const [descripError, setDescripError] = useState(false);

  /**
   * Updates the number of characters remaining in the description field. Adds an error state to
   * the field if number of characters exceeds maximum.
   *
   * @param {string} newDescrip - The new value of the description field.
   */
  function updateCharsRemain(newDescrip) {
    const charsRemain = DESCRIP_MAX_CHARS - newDescrip.length;
    setDescripCharsRemain(charsRemain);
    if (charsRemain > -1) {
      setDescripError(false);
    } else {
      setDescripError(true);
    }
  }

  /**
   * Sets/resets inputs on open/close.
   */
  useEffect(() => {
    if (show) {
      setName(currentName);
      setDescrip(currentDescrip);
      updateCharsRemain(currentDescrip);
    } else {
      setName('');
      setDescrip('');
    }
  }, [show, currentName, currentDescrip, setName, setDescrip]);

  /**
   * Updates the material name in state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler.
   */
  function handleNameChange(e) {
    setName(e.target.value);
  }

  /**
   * Updates the new material description in state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activate the handler. 
   */
  function handleDescripChange(e) {
    setDescrip(e.target.value);
    updateCharsRemain(e.target.value);
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
    setDescripError(false);
  }

  /**
   * Validates the form's inputs and sets error states if necessary.
   *
   * @returns {boolean} True if all inputs valid, false otherwise.
   */
  function validateForm() {
    let validForm = true;
    if (name.length < 1 || name.length > 100) {
      validForm = false;
      setNameError(true);
    }
    if (descrip.length > DESCRIP_MAX_CHARS) {
      validForm = false;
      setDescripError(true);
    }
    return validForm;
  }

  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleEdit() {
    resetFormErrors();
    if (validateForm()) {
      setLoading(true);
      try {
        const editObj = {};
        if (currentName !== name) {
          editObj.name = name;
        }
        if (currentDescrip !== descrip) {
          editObj.description = descrip;
        }
        if (Object.keys(editObj).length > 0) {
          const editRes = await axios.put(`/project/${projectID}/files/${fileID}`, editObj);
          if (!editRes.data.err) {
            setLoading(false);
            onFinishedEdit();
          } else {
            throw (new Error(editRes.data.errMsg));
          }
        } else { // no updates to save
          setLoading(false);
          onFinishedEdit();
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Edit File</Modal.Header>
      <Modal.Content>
        <Form onSubmit={handleSubmit}>
          <Form.Field error={nameError}>
            <label htmlFor="namefield">Name</label>
            <input
              id="namefield"
              type="text"
              placeholder="File Name..."
              value={name}
              onChange={handleNameChange}
            />
          </Form.Field>
          <Form.TextArea
            id="description"
            label="Description"
            placeholder="Describe this file or folder..."
            value={descrip}
            onChange={handleDescripChange}
            error={descripError}
            className="semantic-textarea-font mb-05p"
          />
          <span className={`${descripError ? 'color-semanticred' : 'muted-text'} small-text`}>
            Characters remaining: {descripCharsRemain}
          </span>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="blue" onClick={handleEdit} loading={loading}>
          <Icon name="edit" />
          Edit
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

EditFile.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the project files belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Identifier of the files entry to work on.
   */
  fileID: PropTypes.string.isRequired,
  /**
   * Current name of the files entry.
   */
  currentName: PropTypes.string,
  /**
   * Current description of the files entry.
   */
  currentDescrip: PropTypes.string,
  /**
   * Handler to activate when the files entry has been edited.
   */
  onFinishedEdit: PropTypes.func,
};

EditFile.defaultProps = {
  onClose: () => { },
  currentName: '',
  currentDescrip: '',
  onFinishedEdit: () => { },
};

export default EditFile;
