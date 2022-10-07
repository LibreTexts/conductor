import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { Grid, Menu } from 'semantic-ui-react';
import AnalyticsCourseRoster from './AnalyticsCourseRoster';
import AnalyticsCourseSharing from './AnalyticsCourseSharing';
import GeneralAnalyticsCourseSettings from './GeneralAnalyticsCourseSettings';

/**
 * Wraps various settings panes that allow a user to manage their Analytics Course's settings.
 */
const AnalyticsCourseSettings = () => {

  const DEFAULT_PANE = 'general';

  // Global State and Error Handling
  const history = useHistory();
  const { courseID, settingsPane } = useParams();

  // UI
  const [activePane, setActivePane] = useState(DEFAULT_PANE);

  /**
   * Activate a selected settings pane by updating the URL.
   *
   * @param {string} key - Internal/URL identifier of the pane to activate.
   */
  const handleActivatePane = useCallback((key) => {
    history.push(`/analytics/${courseID}/settings/${key}`);
  }, [history, courseID]);

  const panes = useMemo(() => [
    {
      key: 'general',
      name: 'General',
      active: 'general' === activePane,
      onClick: () => handleActivatePane('general'),
    },
    {
      key: 'roster',
      name: 'Roster',
      active: 'roster' === activePane,
      onClick: () => handleActivatePane('roster'),
    },
    {
      key: 'sharing',
      name: 'Sharing',
      active: 'sharing' === activePane,
      onClick: () => handleActivatePane('sharing'),
    },
  ], [activePane, handleActivatePane]);

  /**
   * Bring the selected settings pane into view based on the current URL.
   */
  useEffect(() => {
    if (settingsPane) {
      const foundPane = panes.find((item) => item.key === settingsPane);
      if (foundPane !== activePane) {
        setActivePane(foundPane.key);
      }
    }
  }, [courseID, panes, settingsPane, activePane, setActivePane]);

  /**
   * Renders the active settings pane.
   *
   * @returns {JSX.Element} The active pane.
   */
  function ActivePane() {
    switch (activePane) {
      case 'general':
      default:
        return <GeneralAnalyticsCourseSettings />;
      case 'roster':
        return <AnalyticsCourseRoster />;
      case 'sharing':
        return <AnalyticsCourseSharing />;
    }
  };

  return (
    <Grid>
      <Grid.Row>
        <Grid.Column width={2}>
          <Menu
            fluid
            vertical
            color="blue"
            secondary
            pointing
            className="fullheight-menu"
            items={panes}
          />
        </Grid.Column>
        <Grid.Column width={14}>
          <ActivePane />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AnalyticsCourseSettings;
