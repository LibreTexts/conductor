import React, { useCallback, useEffect, useState } from 'react';
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
import useGlobalError from '../../../components/error/ErrorHooks';

/**
 * Account Settings is the interface for all Conductor users to manage their Conductor account and
 * update their profile or security settings.
 */
const AccountSettings = () => {

  // Global State and Error Handling
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [activePane, setActivePane] = useState('overview');

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
   * Activates the Overview pane.
   */
  function handleOpenOverviewPane() {
    setActivePane('overview');
  }

  /**
   * Activates the Security pane.
   */
  function handleOpenSecurityPane() {
    setActivePane('security');
  }

  /**
   * Handles notifications of potential server data changes from child components by
   * refreshing account data.
   */
  function handleDataChange() {
    getAccountInfo();
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
                    <Menu.Item
                      name="overview"
                      active={activePane === 'overview'}
                      onClick={handleOpenOverviewPane}
                    >
                      Account Overview
                    </Menu.Item>
                    <Menu.Item
                      name="security"
                      active={activePane === 'security'}
                      onClick={handleOpenSecurityPane}
                    >
                      Security
                    </Menu.Item>
                  </Menu>
                </Grid.Column>
                <Grid.Column stretched width={12}>
                  {activePane === 'overview' && (
                    <AccountOverview account={account} onDataChange={handleDataChange} />
                  )}
                  {activePane === 'security' && (
                    <AccountSecurity account={account} onDataChange={handleDataChange} />
                  )}
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
