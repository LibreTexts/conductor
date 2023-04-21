import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Icon, Modal } from 'semantic-ui-react';
import useGlobalError from '../../error/ErrorHooks';

/**
 * A modal tool to delete an Analytics Course.
 */
const DeleteAnalyticsCourse = ({ show, onClose, onFinishedDelete, courseID, courseTitle }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);

  /**
   * Submits the delete request to the server, then activates the provided callback on success.
   */
  async function submitDelete() {
    setLoading(true);
    try {
      const deleteRes = await axios.delete(`/analytics/courses/${courseID}`);
      if (!deleteRes.data.err) {
        setLoading(false);
        onFinishedDelete();
      } else {
        throw (new Error(deleteRes.data.err));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Delete Analytics Course</Modal.Header>
      <Modal.Content>
        <p>Are you sure you want to delete <strong>{courseTitle}</strong>? The course will also be deleted for any collaborators.</p>
        <p>
          This action won't delete collected analytics data, but you'll have to create another course to view it later. If you have concerns about analytics data and would like to request its removal, please{' '}
          <a href="mailto:support@libretexts.org" target="_blank" rel="noreferrer">contact LibreTexts</a>.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={submitDelete} color="red" loading={loading}>
          <Icon name="trash" />
          Delete Course
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

DeleteAnalyticsCourse.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
  /**
   * Handler to activate when the given course has been deleted.
   */
  onFinishedDelete: PropTypes.func,
  /**
   * Unique identifier of the course to be deleted.
   */
  courseID: PropTypes.string,
  /**
   * UI title of the course to be deleted.
   */
  courseTitle: PropTypes.string,
};

DeleteAnalyticsCourse.defaultProps = {
  onClose: () => { },
  onFinishedDelete: () => { },
  courseID: '',
  courseTitle: '',
};

export default DeleteAnalyticsCourse;
