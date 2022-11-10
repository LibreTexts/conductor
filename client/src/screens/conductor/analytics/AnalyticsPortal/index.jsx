import React, { useCallback, useEffect, useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Loader,
  Message,
  Popup,
  Segment,
  Table,
} from 'semantic-ui-react';
import axios from 'axios';
import CreateAnalyticsCourse from 'components/analytics/CreateAnalyticsCourse';
import useGlobalError from 'components/error/ErrorHooks';
import styles from './AnalyticsPortal.module.css';
import useQueryParam from 'utils/useQueryParam';

/**
 * The main entry portal to a user's Analytics Courses.
 */
const AnalyticsPortal = () => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const location = useLocation();

  // UI
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const showCourseCreated = useQueryParam('courseCreated') === 'true';
  const showCourseDeleted = useQueryParam('courseDeleted') === 'true';

  // Data
  const [courses, setCourses] = useState([]);

  /**
   * Loads the user's Analytics Courses from the server and saves them to state.
   */
  const getCourses = useCallback(async () => {
    setLoading(true);
    try {
      const coursesRes = await axios.get('/analytics/courses');
      if (!coursesRes.data.err) {
        if (Array.isArray(coursesRes.data.courses)) {
          setCourses(coursesRes.data.courses);
        }
      } else {
        throw (new Error(coursesRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [setCourses, setLoading, handleGlobalError]);

  /**
   * Get the user's courses on initial load.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Analytics';
    getCourses();
  }, [getCourses]);

  /**
   * Show the Create Analytics Course tool if indicated in the current URL.
   */
  useEffect(() => {
    if (location.pathname.includes('create')) {
      setShowCreateModal(true);
    } else {
      setShowCreateModal(false);
    }
  }, [location, setShowCreateModal]);

  /**
   * Return to the main portal URL when the Create Analytics Course tool is closed.
   */
  function handleCloseCreateCourse() {
    history.push('/analytics');
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as="h2" className="component-header">Analytics</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row columns={1}>
        <Grid.Column>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section active>Analytics</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              {showCourseCreated && (
                <Message icon success className="mb-2e">
                  <Icon name="check circle" />
                  <Message.Content>
                    <Message.Header>Course Created</Message.Header>
                    <p>Successfully created an Analytics Course!</p>
                  </Message.Content>
                </Message>
              )}
              {showCourseDeleted && (
                <Message icon info className="mb-2e">
                  <Icon name="check circle" />
                  <Message.Content>
                    <Message.Header>Course Deleted</Message.Header>
                    <p>Successfully deleted the Analytics Course.</p>
                  </Message.Content>
                </Message>
              )}
              <div className="flex-row-div">
                <div className={styles.intro_text_wrapper}>
                  <p>LibreTexts Analytics allows instructors to explore measurements of their students' interactions with LibreTexts open access content in order to gauge understanding of course content and identify potential areas of improvement.</p>
                </div>
                <div>
                  <Button.Group>
                    <Button as={Link} to="/analytics/invites">
                      <Icon name="mail outline" />
                      Invites
                    </Button>
                    <Button color="green" as={Link} to="/analytics/create">
                      <Icon name="plus" />
                      New Course
                    </Button>
                  </Button.Group>
                </div>
              </div>
              <Loader active={loading} inline="centered" />
              {courses.length > 0 ? (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Course</Table.HeaderCell>
                      <Table.HeaderCell>Term</Table.HeaderCell>
                      <Table.HeaderCell>Source(s)</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {courses.map((item) => {
                      const sources = [];
                      if (item.hasTextbook) {
                        sources.push('Textbook');
                      }
                      if (item.hasADAPT) {
                        sources.push('ADAPT');
                      }
                      return (
                        <Table.Row key={item.courseID}>
                          <Table.Cell>
                            <Link to={`/analytics/${item.courseID}/dashboard`}>{item.title}</Link>
                            {item.status === 'pending' && (
                              <Popup
                                trigger={(
                                  <Icon name="clock outline" className="ml-05e" />
                                )}
                                position="top center"
                                content={(
                                  <p className="text-center">This course is awaiting review by the LibreTexts team.</p>
                                )}
                              />
                            )}
                          </Table.Cell>
                          <Table.Cell>{item.term}</Table.Cell>
                          <Table.Cell>{sources.join(', ')}</Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              ) : (
                <p className="muted-text text-center mt-2e mb-2e">No courses yet. To get started, tap New Course above!</p>
              )}
            </Segment>
          </Segment.Group>
          {showCreateModal && (
            <CreateAnalyticsCourse show={showCreateModal} onClose={handleCloseCreateCourse} />
          )}
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AnalyticsPortal;
