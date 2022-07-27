import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Modal, Button, Icon } from 'semantic-ui-react';
import axios from 'axios';
import FileTree from '../../FileTree';
import useGlobalError from '../../error/ErrorHooks';
import styles from './CommonsMaterials.module.css';

/**
 * Modal to explore a Commons Catalog entry's Ancillary Materials.
 */
const CommonsMaterials = ({ show, onClose, bookID, materials, hasLockedFileAccess }) => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();

  const [showLockAccess, setShowLockAccess] = useState(false);

  /**
   * Determine if any files are restricted to the user and show the
   * restricted access message if so.
   */
  useEffect(() => {
    if (Array.isArray(materials)) {
      const findLockedRecursive = (arr) => {
        let locked = false;
        for (let i = 0, n = arr.length; i < n; i += 1) {
          const currElem = arr[i];
          if (currElem.disabled) {
            locked = true;
            break;
          }
          if (!locked && Array.isArray(currElem.children)) {
            const childLocked = findLockedRecursive(currElem.children);
            if (childLocked) {
              locked = true;
              break;
            }
          }
        }
        return locked;
      };
      const locked = findLockedRecursive(materials);
      if (locked && !hasLockedFileAccess) {
        setShowLockAccess(true);
      }
    }
  }, [materials, hasLockedFileAccess, setShowLockAccess]);

  /**
   * Handle a view/download button click event from the file tree by
   * requesting a download link from the server.
   *
   * @param {string} materialID - Identifier of the Material entry to request from the server.
   */
  async function handleFileNodeClick(materialID) {
    try {
      const downloadRes = await axios.get(`/commons/book/${bookID}/material/${materialID}`);
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

  return (
    <Modal open={show} onClose={onClose} closeIcon size="fullscreen">
      <Modal.Header>Ancillary Materials</Modal.Header>
      <Modal.Content scrolling>
        {showLockAccess && (
          <p className={styles.lock_access_text}>
            <Icon name="lock" />
            <em>To view/download restricted files, <Link to="/login">sign in</Link> with your Conductor account.</em>
          </p>
        )}
        <FileTree
          items={materials}
          nodeIdentifierKey="materialID"
          nodeTypeKey="storageType"
          onFileActionClick={handleFileNodeClick}
          fileAction={(
            <Button
              icon
              aria-label="Open/Download"
              title="Open/Download"
              size="tiny"
              basic
            >
              <Icon name="download" />
            </Button>
          )}
          fileDisabledAction={(
            <span>
              <Icon name="lock" aria-label="Restricted" title="Restricted" />
            </span>
          )}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Close</Button>
      </Modal.Actions>
    </Modal>
  )
};

CommonsMaterials.propTypes = {
  /**
   * Opens or closes the modal.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
  /**
   * Identifier of the Book whose Materials are being presented.
   */
  bookID: PropTypes.string.isRequired,
  /**
   * Array of Materials (in heirarchical format) to present.
   */
  materials: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Unique identifier of the Material entry.
     */
    materialID: PropTypes.string.isRequired,
    /**
     * UI title of the Material entry.
     */
    name: PropTypes.string.isRequired,
    /**
     * Disable the Material entry for download.
     */
    disabled: PropTypes.bool,
  })),
  /**
   * Indicates the current user has access to restricted files.
   */
  hasLockedFileAccess: PropTypes.bool,
};

CommonsMaterials.defaultProps = {
  onClose: () => { },
  hasLockedFileAccess: false,
};

export default CommonsMaterials;
