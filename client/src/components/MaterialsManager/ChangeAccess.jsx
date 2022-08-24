import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, Icon, Button, Form } from 'semantic-ui-react';
import axios from 'axios';
import FileIcon from '../FileIcon';
import { MATERIALS_ACCESS_SETTINGS } from '../util/BookHelpers';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to set the access/visibility setting of Ancillary Materials entries.
 */
const ChangeAccess = ({ show, onClose, projectID, materials, onFinishedChange }) => {

  const DEFAULT_ACCESS_SETTING = 'public';

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  const [loading, setLoading] = useState(false);
  const [newAccess, setNewAccess] = useState(DEFAULT_ACCESS_SETTING);
  const [settingError, setSettingError] = useState(false);

  /**
   * Reset the setting selection on open/close.
   */
  useEffect(() => {
    setNewAccess(DEFAULT_ACCESS_SETTING);
  }, [show, setNewAccess]);

  /**
   * Prevents default actions if the modal form is submitted.
   *
   * @param {React.FormEvent} e - Event that activated the handler. 
   */
  function handleSubmit(e) {
    e.preventDefault();
  }

  /**
   * Updates the new access setting in state.
   *
   * @param {React.ChangeEvent} _e - Event that activated the handler.
   * @param {object} data - Data passed from the UI element.
   * @param {string} data.value - The newly selected access setting identifier.
   */
  function handleSettingChange(_e, { value }) {
    setNewAccess(value);
  }

  /**
   * Resets any error states in the form.
   */
  function resetFormErrors() {
    setSettingError(false);
  }

  /**
   * Validates the form's inputs and sets error states if necessary.
   *
   * @returns {boolean} True if all inputs valid, false otherwise.
   */
  function validateForm() {
    let validForm = true;
    if (newAccess.length < 1) {
      validForm = false;
      setSettingError(true);
    }
    return validForm;
  }

  /**
   * Submits update request(s) to the server (if form is valid), then closes the modal.
   */
  async function handleChangeAccess() {
    resetFormErrors();
    if (validateForm()) {
      setLoading(true);
      try {
        for (let i = 0, n = materials.length; i < n; i += 1) {
          const currMaterial = materials[i];
          const updateRes = await axios.put(
            `/project/${projectID}/book/material/${currMaterial.materialID}/access`,
            { newAccess },
          );
          if (updateRes.data.err) {
            throw (new Error(updateRes.data.errMsg));
          }
        }
        setLoading(false);
        onFinishedChange();
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Change Material Access</Modal.Header>
      <Modal.Content>
        <p>
          <strong>WARNING: </strong>
          {`You're about to change the access setting on the following material(s). `}
          <strong>Changing access to a folder will also change access to all of its files and subdirectories.</strong>
        </p>
        <ul>
          {materials.map((obj) => (
            <li key={obj.materialID}>
              {obj.storageType === 'folder' ? (
                <Icon name="folder outline" />
              ) : (
                <FileIcon filename={obj.name} />
              )}
              {obj.name}
            </li>
          ))}
        </ul>
        <Form onSubmit={handleSubmit}>
          <Form.Select
            label="Access Setting"
            fluid
            placeholder="Access..."
            error={settingError}
            options={MATERIALS_ACCESS_SETTINGS}
            value={newAccess}
            onChange={handleSettingChange}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleChangeAccess} color="yellow" loading={loading}>
          <Icon name="lock" />
          Change Access
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

ChangeAccess.propTypes = {
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
   * Array of materials to modify.
   */
  materials: PropTypes.arrayOf(PropTypes.shape({
    materialID: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  /**
   * Handler to activate when the given material(s) have been modified.
   */
  onFinishedChange: PropTypes.func,
};

ChangeAccess.defaultProps = {
  onClose: () => { },
  onFinishedChange: () => { },
};

export default ChangeAccess;
