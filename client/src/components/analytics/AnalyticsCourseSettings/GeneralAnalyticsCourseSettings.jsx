import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';
import axios from 'axios';
import { Accordion, Button, Divider, Icon, Message, Segment } from 'semantic-ui-react';
import AnalyticsCourseSettingsForm from '../AnalyticsCourseSettingsForm';
import DeleteAnalyticsCourse from './DeleteAnalyticsCourse';
import useGlobalError from '../../../components/error/ErrorHooks';

/**
 * An interface for users to modify the general properties and settings of an Analytics Course.
 */
const GeneralAnalyticsCourseSettings = () => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const { courseID } = useParams();
  const user = useSelector((state) => state.user);

  // Data
  const [course, setCourse] = useState({});
  const [canEdit, setCanEdit] = useState(false);
  const [loadedCourse, setLoadedCourse] = useState(false);

  // UI
  const [showDeleteCourse, setShowDeleteCourse] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);

  /**
   * Retrieves information about the course from the server, parses it, and saves it to state.
   */
  const getCourse = useCallback(async () => {
    try {
      const courseRes = await axios.get(`/analytics/courses/${courseID}`);
      if (!courseRes.data.err) {
        if (courseRes.data.course) {
          const {
            status: courseStatus,
            title: courseTitle,
            term: courseTerm,
            start: startStr,
            end: endStr,
            textbookURL,
            textbookID,
            adaptCourseID,
            textbookDenied,
            creator,
          } = courseRes.data.course;
          const courseStart = new Date(startStr);
          const courseEnd = new Date(endStr);
          setCourse({
            courseStatus,
            courseTitle,
            courseTerm,
            courseStart,
            courseEnd,
            textbookURL,
            textbookID,
            adaptCourseID,
            textbookDenied,
            creator,
          });
          setLoadedCourse(true);
        }
        if (courseRes.data.canEdit) {
          setCanEdit(courseRes.data.canEdit);
        }
      } else {
        throw (new Error(courseRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }, [courseID, setCourse, setCanEdit, setLoadedCourse, handleGlobalError]);

  /**
   * Retrieve information about the course from the server on first load.
   */
  useEffect(() => {
    getCourse();
  }, [getCourse]);

  /**
   * Saves the updated course information to the server, then refreshes the available data.
   *
   * @param {object.<string, any>} formData - Information to submit, passed from the
   *  form component.
   */
  async function submitUpdate(formData) {
    try {
      setLoading(true);
      const {
        courseTitle: title,
        courseTerm: term,
        courseStart,
        courseEnd,
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
      };

      const updateRes = await axios.put(`/analytics/courses/${courseID}`, courseData);
      if (!updateRes.data.err) {
        setLoading(false);
        setShowUpdateSuccess(true);
        getCourse();
      } else {
        throw (new Error(updateRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  /**
   * Opens the Delete Course tool.
   */
  function handleOpenDeleteCourse() {
    setShowDeleteCourse(true);
  }

  /**
   * Closes the Delete Course tool.
   */
  function handleCloseDeleteCourse() {
    setShowDeleteCourse(false);
  }

  /**
   * Closes the Delete Course tool and redirects the user to the Analytics Portal on successful
   * course deletion.
   */
  function handleCourseDeletion() {
    handleCloseDeleteCourse();
    history.push('/analytics?courseDeleted=true');
  }

  const isCourseCreator = user.uuid === course.creator;

  return (
    <Segment basic className="pane-segment">
      <h2>General Course Settings</h2>
      <Divider />
      {showUpdateSuccess && (
        <Message icon success className="mb-2e">
          <Icon name="check" />
          <Message.Content>
            <Message.Header>Course Updated</Message.Header>
            <p>Successfully saved your course updates!</p>
          </Message.Content>
        </Message>
      )}
      {loadedCourse && (
        <>
          <AnalyticsCourseSettingsForm
            initialState={course}
            onSubmit={submitUpdate}
            loading={loading}
            canEdit={canEdit}
          />
          <Accordion className="mt-3e mb-2e" panels={[{
            key: 'danger',
            title: {
              content: <span className='color-semanticred'><strong>Danger Zone</strong></span>
            },
            content: {
              content: (
                <div>
                  <p className='color-semanticred'>Use caution with the options in this area!</p>
                  <Button
                    color='red'
                    fluid
                    onClick={handleOpenDeleteCourse}
                    disabled={!canEdit || !isCourseCreator}
                  >
                    <Icon name='trash alternate' />
                    Delete Course
                  </Button>
                </div>
              ),
            },
          }]} />
        </>
      )}
      <DeleteAnalyticsCourse
        show={showDeleteCourse}
        onClose={handleCloseDeleteCourse}
        onFinishedDelete={handleCourseDeletion}
        courseID={courseID}
        courseTitle={course.courseTitle}
      />
    </Segment>
  );
};

export default GeneralAnalyticsCourseSettings;