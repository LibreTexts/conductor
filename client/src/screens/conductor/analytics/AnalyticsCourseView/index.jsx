import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Breadcrumb, Button, Grid, Header, Icon, Loader, Message, Segment } from 'semantic-ui-react';
import AnalyticsCourseSettings from '../../../../components/analytics/AnalyticsCourseSettings';
import LearningAnalyticsDashboard from '../../../../components/analytics/LearningAnalyticsDashboard';
import useQueryParam from '../../../../utils/useQueryParam';
import useGlobalError from '../../../../components/error/ErrorHooks';
import styles from './AnalyticsCourseView.module.css';

/**
 * The main entry point to an Analytics Course, presenting the user with the Analytics Dashboard.
 */
const AnalyticsCourseView = () => {

  const DEFAULT_PANE = 'dashboard';

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const { courseID, pane } = useParams();
  const user = useSelector((state) => state.user);

  // UI
  const [activePane, setActivePane] = useState(DEFAULT_PANE);
  const [loading, setLoading] = useState(false);
  const showCourseCreated = useQueryParam('courseCreated') === 'true';

  // Data
  const [course, setCourse] = useState({});

  const panes = useMemo(() => [
    { key: 'dashboard', title: 'Learning Analytics' },
    { key: 'settings', title: 'Settings' },
  ], []);

  /**
   * Direct the user to the Verification Required page if they do not yet have
   * access to analytics features.
   */
  useEffect(() => {
    if (!user.isVerifiedInstructor) {
      history.push('/analytics/requestaccess');
    }
  }, [user, history]);

  /**
   * Loads information about the course from the server and saves it to state.
   */
  const getCourse = useCallback(async () => {
    setLoading(true);
    try {
      const courseRes = await axios.get(`/analytics/courses/${courseID}`);
      if (!courseRes.data.err) {
        if (courseRes.data.course) {
          setCourse(courseRes.data.course);
        }
      } else {
        throw (new Error(courseRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [courseID, setCourse, setLoading, handleGlobalError]);

  /**
   * Retrieve information from the server and set the page title on first load.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Analytics | Course View';
    getCourse();
  }, [getCourse]);

  /**
   * Redirect to the default Dashboard view if a pane name was not provided in the URL.
   */
  useEffect(() => {
    if (!pane) {
      history.push(`/analytics/${courseID}/${DEFAULT_PANE}`);
    }
  }, [pane, courseID, history]);

  /**
   * Bring the desired pane into view when the URL changes.
   */
  useEffect(() => {
    if (pane) {
      const foundPane = panes.find((item) => item.key === pane);
      if (foundPane) {
        setActivePane(foundPane.key);
      }
    }
  }, [pane, panes, setActivePane]);

  /**
   * Renders the currently selected pane.
   *
   * @returns {JSX.Element} The rendered pane.
   */
  const ActivePane = () => {
    switch (activePane) {
      case 'dashboard':
        return (
          <LearningAnalyticsDashboard />
        );
      case 'settings':
        return (
          <AnalyticsCourseSettings />
        );
      default:
        return null;
    }
  };

  /**
   * Toggle between Dashboard and Settings on click of the settings button.
   */
  function handleSettingsClick() {
    if (activePane !== 'settings') {
      history.push(`/analytics/${courseID}/settings`);
    } else {
      history.push(`/analytics/${courseID}/dashboard`);
    }
  }

  return (
    <div id={styles.wrapper}>
      <div id={styles.header_row}>
        <Header as="h2" className="component-header">{course.title}</Header>
      </div>
      <div id={styles.content_row}>
        <Segment.Group id={styles.segments_wrapper} className={activePane === 'dashboard' ? styles.dashboard_active : ''}>
          <Segment className="flex-row-div">
            <div className="left-flex">
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/analytics">Analytics</Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>{course.title}</Breadcrumb.Section>
              </Breadcrumb>
            </div>
            <div className="right-flex">
              <Loader active={loading} inline className="mr-2e" />
              <Button
                onClick={handleSettingsClick}
                color={activePane === 'settings' ? undefined : 'blue'}
              >
                <Icon name={activePane === 'settings' ? 'close' : 'settings'} />
                {activePane === 'settings' && 'Close'} Course Settings
              </Button>
            </div>
          </Segment>
          <Segment id={styles.active_pane_segment}>
            {showCourseCreated && (
              <Message icon success className="mb-1e">
                <Icon name="check circle" />
                <Message.Content>
                  <Message.Header>Course Created</Message.Header>
                  <p>Welcome to your new Analytics Course, <em>{course.title}</em>!</p>
                </Message.Content>
              </Message>
            )}
            <ActivePane />
          </Segment>
        </Segment.Group>
      </div>
    </div>
  );
};

export default AnalyticsCourseView;

/*

    <Grid id={styles.wrapper} divided="vertically">
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as="h2" className="component-header">{course.title}</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row columns={1}>
        <Grid.Column>

        </Grid.Column>
      </Grid.Row>
    </Grid>

*/