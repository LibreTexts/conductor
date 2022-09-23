import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button, Message, Icon } from 'semantic-ui-react';
import useQueryParam from '../../../utils/useQueryParam';
import useGlobalError from '../../../components/error/ErrorHooks';
import styles from './OAuthConsent.module.css';

/**
 * An interface allowing users to approve or deny an external application's
 * requested access to their Conductor account as part of an OAuth flow.
 */
const OAuthConsent = () => {

  const { handleGlobalError } = useGlobalError();

  const clientID = useQueryParam('client_id', null);
  const redirectURI = useQueryParam('redirect_uri', null);
  const permsChanged = useRef(useQueryParam('scopes_changed') === 'true');
  const [user, setUser] = useState({
    firstName: 'Conductor',
    lastName: 'User',
    email: '',
    avatar: '/mini_logo.png',
  });
  const [client, setClient] = useState({
    name: '',
    infoURL: '#',
    icon: '/mini_logo.png',
    scopeDescriptions: {},
  });

  /**
   * Retrieves information about the currently authenticated User from the server
   * and saves it to state.
   */
  const getUserInformation = useCallback(async () => {
    try {
      const accountRes = await axios.get('/user/accountinfo');
      if (!accountRes.data.err) {
        const { firstName, lastName, email, avatar } = accountRes.data.account;
        setUser({
          firstName,
          lastName,
          email,
          avatar,
        });
      } else {
        throw (new Error(accountRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }, [setUser, handleGlobalError]);

  /**
   * Retrieves information about the provided external application from the server
   * and saves it to state.
   */
  const getAPIClientInformation = useCallback(async () => {
    try {
      const clientRes = await axios.get(`/apiclients/${clientID}`);
      if (!clientRes.data.err) {
        const { name, infoURL, icon, scopeDescriptions } = clientRes.data.client;
        setClient({
          name,
          infoURL,
          icon,
          scopeDescriptions,
        });
      } else {
        throw (new Error(clientRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
  }, [clientID, setClient, handleGlobalError]);

  /**
   * Processes URL search parameters on load and saves them to state. If parameters are
   * invalid or missing, the user is redirected away in order to interrupt the OAuth flow.
   */
  useEffect(() => {
    if (!clientID) {
      window.top.location.replace('/home');
    }
    if (!redirectURI) {
      window.top.location.replace('/home');
    }
    getUserInformation();
    getAPIClientInformation();
  }, [clientID, redirectURI, permsChanged, getUserInformation, getAPIClientInformation]);

  /**
   * Handles access denial by redirecting to Home to interrupt the OAuth flow.
   */
  function handleDenyClick() {
    window.top.location.replace('/home');
  }

  /**
   * Handles access approval by redirecting to the provided `redirect_uri` parameter
   * to continue the OAuth flow.
   */
  function handleAllowClick() {
    try {
      window.location.replace(redirectURI); // already decoded by useQueryParam
    } catch (e) {
      console.error(e);
      alert(`Sorry, we're having trouble redirecting you. Please try again or contact LibreTexts.`);
    }
  }

  /**
   * Renders the list of an application's requested information scopes and
   * their human-readable descriptions.
   *
   * @returns {React.ReactElement[]} A set of list elements with descriptions and
   *  nested lists, if necessary.
   */
  function renderScopeDescriptions() {
    const resourceSets = [];
    Object.keys(client.scopeDescriptions).forEach((key) => {
      const resourceItems = [];
      const scopeSet = client.scopeDescriptions[key];
      scopeSet.resources.forEach((resource) => {
        resourceItems.push(
          <li><strong>{resource.accessDescription}:</strong> {resource.description}</li>
        );
      });
      resourceSets.push(
        <li>
          <span>{scopeSet.description}</span>
          <ul>{resourceItems}</ul>
        </li>
      );
    });
    return resourceSets;
  }

  return (
    <div id={styles.wrapper}>
      <div id={styles.form_container}>
        <img id={styles.libre_logo} src="/transparent_logo.png" alt="LibreTexts" />
        <h1 className="text-center">Sign in with Conductor</h1>
        <div id={styles.consent_form}>
          <div id={styles.icons_wrapper}>
            <img src="/mini_logo.png" aria-hidden="true" alt="" className={styles.app_icon} />
            <span id={styles.plus_symbol} aria-hidden="true">+</span>
            <img src={client.icon} aria-hidden="true" alt="" className={styles.app_icon} />
          </div>
          <h2 className="text-center">
            <a href={client.infoURL} target="_blank" rel="noreferrer">{client.name}</a>
            {` wants to access your Conductor account`}
          </h2>
          <div id={styles.user_wrapper}>
            <img id={styles.user_avatar} src={user.avatar} alt={`${user.firstName} ${user.lastName}`} />
            <span id={styles.user_email}>{user.email}</span>
          </div>
          {permsChanged.current && (
            <Message info icon>
              <Icon name="info circle" />
              <Message.Content>
                <Message.Header>Permissions Change</Message.Header>
                <p>Heads up, this application may be requesting different information since the last time you authorized it.</p>
              </Message.Content>
            </Message>
          )}
          <p>
            <a href={client.infoURL} target="_blank" rel="noreferrer">{client.name}</a> would like to access:
          </p>
          {(typeof (client.scopeDescriptions) === 'object') ? (
            <ul>
              {renderScopeDescriptions()}
            </ul>
          ) : (
            <p><strong>Unknown permissions requested.</strong></p>
          )}
          <p id={styles.security_msg}>
            {`Make sure you trust this application and want to give them access to any sensitive information listed above. `}
            {`You can always revoke access in your `}
            <Link to="/account/authorizedapps" target="_blank">Conductor account.</Link>
            {` If you don't recognize this application or have concerns, please `}
            <a href="mailto:info@libretexts.org" target="_blank" rel="noreferrer">
              contact LibreTexts
            </a>.
          </p>
          <Button.Group widths={2}>
            <Button onClick={handleDenyClick}>Deny</Button>
            <Button color="blue" onClick={handleAllowClick}>Allow</Button>
          </Button.Group>
        </div>
      </div>
    </div>
  )
};

export default OAuthConsent;
