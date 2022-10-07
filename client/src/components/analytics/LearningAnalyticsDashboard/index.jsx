import React from 'react';
import { useParams } from 'react-router-dom';
import styles from './LearningAnalyticsDashboard.module.css';

/**
 * A wrapper to the LibreTexts Learning Analytics Dashboard.
 */
const LearningAnalyticsDashboard = () => {

  // Global State
  const { courseID } = useParams();

  const location = window.location;
  const { protocol, hostname, port } = location;
  const apiEndpoint = `${protocol}//${hostname}${port ? `:5000` : ''}/api/v1/analytics/learning/init?courseID=${courseID}`;

  return (
    <iframe
      src={apiEndpoint}
      id={styles.dashboard_iframe}
      title="Learning Analytics Dashboard"
    >
    </iframe>
  );
};

export default LearningAnalyticsDashboard;
