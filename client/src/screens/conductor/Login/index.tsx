import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Loader } from 'semantic-ui-react';
import AuthHelper from '../../../components/util/AuthHelper';
import styles from './Login.module.css';

/**
 * Visual landing to redirect the user to the LibreOne CAS login screen.
 */
const Login = () => {

  const location = useLocation();

  const [autoRedirect, setAutoRedirect] = useState(true);
  const [redirectURI, setRedirectURI] = useState('');
  const [showExpiredAuth, setShowExpiredAuth] = useState(false);
  const [showAccountRequestAuth, setShowAccountRequestAuth] = useState(false);

  /**
   * Set a redirect cookie and navigate to LibreOne login.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Login Required';
    const params = new URLSearchParams(location.search);
    const redirectURI = params.get('redirect_uri');
    let autoRedirect = true;
    if (params.get('src') === 'authexpired') {
      setShowExpiredAuth(true);
    }
    if (params.get('src') === 'accountrequest') {
      setShowAccountRequestAuth(true);
      autoRedirect = false;
    }
    setAutoRedirect(autoRedirect);
    if (redirectURI) {
        setRedirectURI(redirectURI);
    }
    
    if (autoRedirect) {
      const timer = setTimeout(() => {
        const loginURL = AuthHelper.generateLoginURL(redirectURI || undefined) ;
        window.location.assign(loginURL);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [location.search, setAutoRedirect, setRedirectURI, setShowExpiredAuth, setShowAccountRequestAuth]);

  /**
   * Resumes navigation to LibreOne login after user acknowledgment.
   */
  function handleContinueClick() {
    const loginURL = AuthHelper.generateLoginURL(redirectURI);
    window.location.assign(loginURL);
  }

  return (
    <div id={styles.wrapper}>
      <div id={styles.container}>
        <img id={styles.libre_logo} src="/transparent_logo.png" alt="LibreTexts" />
        <div id={styles.inner_container}>
          {showAccountRequestAuth && (
            <>
              <p id={styles.login_msg}><strong>Login Required</strong></p>
              <p className="text-center">To request access to instructors-only LibreTexts services, please create or login to an account with our centralized identity service, LibreOne. Accounts are free and open to all.</p>
            </>
          )}
          {autoRedirect ? (
            <>
              <Loader active inline="centered" />
              <p id={styles.wait_msg}>
                <strong>
                  {showExpiredAuth ? 'Session expired, please login again.' : 'Just a moment...'}
                </strong>
              </p>
              <p className="text-center">We're redirecting you to the LibreOne Central Authentication Service.</p>
            </>
          ) : (
            <Button
              className="mt-2e"
              fluid
              color="blue"
              onClick={handleContinueClick}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
