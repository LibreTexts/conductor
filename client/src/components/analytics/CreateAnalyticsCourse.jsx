import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import { Modal } from 'semantic-ui-react';
import AnalyticsCourseSettingsForm from './AnalyticsCourseSettingsForm';
import useGlobalError from '../error/ErrorHooks';

/**
 * A modal tool to create a new Analytics Course.
 */
const CreateAnalyticsCourse = ({ show, onClose }) => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const user = useSelector((state) => state.user);

  // UI
  const [loading, setLoading] = useState(false);

  /**
   * Direct the user to the Verification Required page if they do not yet have
   * access to analytics features.
   */
  useEffect(() => {
    if (!user.verifiedInstructor) {
      history.push('/analytics/requestaccess');
    }
  }, [user, history]);

  /**
   * Submit the new course information to the server, then direct the user to the new
   * course page on success.
   *
   * @param {object.<string, any>} formData - Information to submit, passed from the
   *  form component.
   */
  async function createCourse(formData) {
    try {
      setLoading(true);
      const {
        courseTitle: title,
        courseTerm: term,
        courseStart,
        courseEnd,
        textbookURL,
        adaptSharingKey,
      } = formData;
      const startDate = {
        month: `0${courseStart.getMonth() + 1}`.slice(-2),
        date: `0${courseStart.getDate()}`.slice(-2),
        year: courseStart.getFullYear(),
      };
      const endDate = {
        month: `0${courseEnd.getMonth() + 1}`.slice(-2),
        date: `0${courseEnd.getDate()}`.slice(-2),
        year: courseEnd.getFullYear(),
      };
      const start = `${startDate.month}-${startDate.date}-${startDate.year}`;
      const end = `${endDate.month}-${endDate.date}-${endDate.year}`;
      const courseData = {
        title,
        term,
        start,
        end,
        textbookURL,
        adaptSharingKey,
      };

      const createRes = await axios.post('/analytics/courses', courseData);
      if (!createRes.data.err) {
        setLoading(false);
        if (createRes.data.courseID) {
          history.push(`/analytics/${createRes.data.courseID}/dashboard?courseCreated=true`);
        } else {
          history.push(`/analytics?courseCreated=true`);
        }
      } else {
        throw (new Error(createRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal size="large" open={show} onClose={onClose} closeIcon>
      <Modal.Header>Create Analytics Course</Modal.Header>
      <Modal.Content>
        <AnalyticsCourseSettingsForm create onSubmit={createCourse} loading={loading} canEdit />
      </Modal.Content>
    </Modal>
  );
};

CreateAnalyticsCourse.propTypes = {
  /**
   * Opns or closes the modal.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
};

CreateAnalyticsCourse.defaultProps = {
  onClose: () => { },
};

export default CreateAnalyticsCourse;
