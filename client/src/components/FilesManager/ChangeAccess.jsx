import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Select } from '@libretexts/davis-react';
import { IconFile, IconFolder, IconLock } from '@tabler/icons-react';
import axios from 'axios';
import { PROJECT_FILES_ACCESS_SETTINGS } from '../util/ProjectHelpers';
import useGlobalError from '../error/ErrorHooks';

const accessOptions = PROJECT_FILES_ACCESS_SETTINGS.map((option) => ({
  value: option.value,
  label: option.text,
}));

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
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>Change File Access</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-800">
          <strong>WARNING: </strong>
          {`You're about to change the access setting on the following file(s). `}
          <strong>Changing access to a folder will also change access to all of its files and subdirectories.</strong>
        </p>
        <ul className="my-8 space-y-2">
          {files.map((obj) => (
            <li key={obj.fileID} className="flex items-center gap-2">
              {obj.storageType === 'folder' ? (
                <IconFolder size={20} aria-hidden="true" />
              ) : (
                <IconFile size={20} aria-hidden="true" />
              )}
              <span>{obj.name}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit}>
          <Select
            name="access-setting"
            label="Access Setting"
            placeholder="Access..."
            error={settingError}
            errorMessage={settingError ? "Select an access setting." : undefined}
            options={accessOptions}
            value={newAccess}
            onChange={(e) => setNewAccess(e.target.value)}
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="!bg-yellow-500 hover:!bg-yellow-600 active:!bg-yellow-700 focus-visible:!ring-yellow-500"
          onClick={handleChangeAccess}
          loading={loading}
          icon={<IconLock size={16} />}
        >
          Change Access
        </Button>
      </Modal.Footer>
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
