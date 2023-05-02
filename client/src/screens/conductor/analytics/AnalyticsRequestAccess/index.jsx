import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import { Button, Icon } from 'semantic-ui-react';
import styles from './AnalyticsRequestAccess.module.css';

/**
 * Prompts the user to submit an Instructor Account Request before they can
 * access Analytics features.
 */
const AnalyticsRequestAccess = () => {

  // Global State
  const history = useHistory();
  const user = useSelector((state) => state.user);

  /**
   * Redirect the user to the Analytics Portal if they are already a verified
   * instructor (have access).
   */
  useEffect(() => {
    if (user.verifiedInstructor) {
      history.push('/analytics');
    }
  }, [user, history]);

  return (
    <div id={styles.wrapper}>
      <div id={styles.container}>
        <div id={styles.icon}>
          <Icon name="hand paper outline" size="massive" />
        </div>
        <h1 className="text-center">Verification Required</h1>
        <p className="text-center mt-2e mb-2e">
          In order to display student analytics data, LibreTexts needs to verify your status as an instructor. Once verified, you won't have to complete this process again. If you've already submitted an Account Request, you'll receive an email when the LibreTexts team  approves your request.
        </p>
        <p className="text-center mb-2e ml-2e mr-2e">
          Thank you for helping us protect student privacy.
        </p>
        <Button.Group widths={2}>
          <Button as={Link} to="/analytics">Cancel</Button>
          <Button color="blue" as={Link} to="/accountrequest?src=analytics">
            Submit Instructor Verification
          </Button>
        </Button.Group>
      </div>
    </div>
  )
};

export default AnalyticsRequestAccess;