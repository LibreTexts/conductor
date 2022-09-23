import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Grid,
  Header,
  Menu,
  Segment,
} from 'semantic-ui-react';
import AccountOverview from '../../../components/accountsettings/AccountOverview';
import AccountSecurity from '../../../components/accountsettings/AccountSecurity';
import AuthorizedApplications from '../../../components/accountsettings/AuthorizedApplications';
import InstructorProfile from '../../../components/accountsettings/InstructorProfile';
import useGlobalError from '../../../components/error/ErrorHooks';

/**
 * Account Settings is the interface for all Conductor users to manage their Conductor account and
 * update their profile or security settings.
 */
const AccountSettings = () => {

  const DEFAULT_ACTIVE_PANE = 'overview';

  const MENU_ITEMS = [
    { key: 'overview', title: 'Account Overview' },
    { key: 'instructorprofile', title: 'Instructor Profile' },
    { key: 'authorizedapps', title: 'Authorized Applications' },
    { key: 'security', title: 'Security' },
  ];

  // Global State and Error Handling
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const { activePane } = useParams();

  // Data
  const [account, setAccount] = useState({});

  /**
   * Retrieves information about the user's account from the server and saves it to state.
   */
  const getAccountInfo = useCallback(async () => {
    try {
      setLoading(true);
      const infoRes = await axios.get('/user/accountinfo');
      if (!infoRes.data.err && infoRes.data.account) {
        const createdDate = new Date(infoRes.data.account.createdAt);
        setAccount({
          ...infoRes.data.account,
          createdAt: createdDate.toDateString(),
        });
      } else {
        throw (new Error(infoRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [setAccount, setLoading, handleGlobalError]);

  /**
   * Activate the default pane if one is not yet active.
   */
  useEffect(() => {
    if (!activePane) {
      history.push(`/account/${DEFAULT_ACTIVE_PANE}`);
    }
  }, [activePane, history]);

  /**
   * Set the page title and gather data from the server on load.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Account Settings';
    getAccountInfo();
  }, [getAccountInfo]);

  /**
   * Update global state if the user updates their name in Account Settings.
   */
  useEffect(() => {
    if (
      account.firstName
      && account.lastName
      && (user.firstName !== account.firstName || user.lastName !== account.lastName)
    ) {
      dispatch({
        type: 'SET_USER_NAME',
        payload: {
          firstName: account.firstName,
          lastName: account.lastName,
        },
      });
    }
  }, [account.firstName, account.lastName, user.firstName, user.lastName, dispatch]);

  /**
   * Activates the pane identified by the `name` argument.
   *
   * @param {string} name - Identifier of the desired pane.
   */
  function handleActivatePane(name) {
    history.push(`/account/${name}`);
  }

  /**
   * Handles notifications of potential server data changes from child components by
   * refreshing account data.
   */
  function handleDataChange() {
    getAccountInfo();
  }

  /**
   * Renders the currently active pane.
   *
   * @returns {JSX.Element} The rendered pane.
   */
  function ActivePane() {
    switch (activePane) {
      case 'overview':
        return <AccountOverview account={account} onDataChange={handleDataChange} />;
      case 'authorizedapps':
        return <AuthorizedApplications />;
      case 'instructorprofile':
        return <InstructorProfile account={account} onDataChange={handleDataChange} />
      case 'security':
        return <AccountSecurity account={account} onDataChange={handleDataChange} />;
      default:
        return null;
    }
  }

  return (
    <Grid className="component-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Account Settings</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment loading={loading}>
            <Grid>
              <Grid.Row>
                <Grid.Column width={4}>
                  <Menu fluid vertical color="blue" secondary pointing className="fullheight-menu">
                    {MENU_ITEMS.map((item) => (
                      <Menu.Item
                        key={item.key}
                        active={activePane === item.key}
                        onClick={() => handleActivatePane(item.key)}
                      >
                        {item.title}
                      </Menu.Item>
                    ))}
                  </Menu>
                </Grid.Column>
                <Grid.Column stretched width={12}>
                  <ActivePane />
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Segment>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AccountSettings;
