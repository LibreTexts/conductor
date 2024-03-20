import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, Icon, Button, Form } from 'semantic-ui-react';
import axios from 'axios';
import FileIcon from '../FileIcon';
import { PROJECT_FILES_ACCESS_SETTINGS } from '../util/ProjectHelpers';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to set the access/visibility setting of Project Files entries.
 */
const ChangeAccess = ({ show, onClose, projectID, files, onFinishedChange }) => {

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
        for (let i = 0, n = files.length; i < n; i += 1) {
          const currFile = files[i];
          const updateRes = await axios.put(
            `/project/${projectID}/files/${currFile.fileID}/access`,
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
      <Modal.Header>Change File Access</Modal.Header>
      <Modal.Content>
        <p>
          <strong>WARNING: </strong>
          {`You're about to change the access setting on the following file(s). `}
          <strong>Changing access to a folder will also change access to all of its files and subdirectories.</strong>
        </p>
        <ul className='my-8'>
          {files.map((obj) => (
            <li key={obj.fileID}>
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
            options={PROJECT_FILES_ACCESS_SETTINGS}
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
   * Identifier of the project files belong to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Array of files to modify.
   */
  files: PropTypes.arrayOf(PropTypes.shape({
    fileID: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  /**
   * Handler to activate when the given files(s) have been modified.
   */
  onFinishedChange: PropTypes.func,
};

ChangeAccess.defaultProps = {
  onClose: () => { },
  onFinishedChange: () => { },
};

export default ChangeAccess;
