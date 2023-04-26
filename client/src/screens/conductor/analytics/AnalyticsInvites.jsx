import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useHistory } from 'react-router-dom';
import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Loader,
  Modal,
  Segment,
  Table,
} from 'semantic-ui-react';
import axios from 'axios';
import date from 'date-and-time';
import { getAnalyticsMemberAccessText } from '../../../utils/analyticsHelpers';
import useGlobalError from '../../../components/error/ErrorHooks';

/**
 * Lists invites to access Analytics Courses that the user has received.
 */
const AnalyticsInvites = () => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const user = useSelector((state) => state.user);

  // UI
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptInvite, setAcceptInvite] = useState(false);

  // Data
  const [invites, setInvites] = useState([]);
  const [confirmInvite, setConfirmInvite] = useState({});

  /**
   * Direct the user to the Verification Required page if they do not yet have
   * access to analytics features.
   */
  useEffect(() => {
    if (!user.verifiedInstructor) {
      history.push('/analytics/requestaccess');
    }
  }, [user, history]);

  /**
   * Loads the user's Analytics Invites from the server and saves them to state.
   */
  const getInvites = useCallback(async () => {
    setLoading(true);
    try {
      const invitesRes = await axios.get('/analytics/invites');
      if (!invitesRes.data.err) {
        if (Array.isArray(invitesRes.data.invites)) {
          setInvites(invitesRes.data.invites);
        }
      } else {
        throw (new Error(invitesRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [setInvites, setLoading, handleGlobalError]);

  /**
   * Get the user's courses on initial load.
   */
  useEffect(() => {
    document.title = 'LibreTexts Conductor | Analytics | Invites';
    getInvites();
  }, [getInvites]);

  /**
   * Opens the Confirm Invite Action modal and saves the specified invite in state.
   *
   * @param {string} id - Identifier of the desired invite.
   * @param {boolean} [accept=false] - Accept or deny the invite.
   */
  function handleOpenConfirmInvite(id, accept = false) {
    const foundInvite = invites.find((item) => item._id === id);
    if (foundInvite) {
      setConfirmInvite(foundInvite);
      setAcceptInvite(accept);
      setShowConfirm(true);
    }
  }

  /**
   * Closes the Confirm Invite Action modal and resets its state.
   */
  function handleCloseConfirm() {
    setConfirmInvite({});
    setAcceptInvite(false);
    setShowConfirm(false);
  }

  /**
   * Submits a request to the server to accept or deny the invite currently in state, then
   * refreshes the list of invites.
   */
  async function handleConfirmInvite() {
    setLoading(true);
    try {
      const apiURL = `/analytics/invites/${confirmInvite._id}`;
      const confirmRes = acceptInvite ? (await axios.put(apiURL)) : (await axios.delete(apiURL));
      if (!confirmRes.data.err) {
        handleCloseConfirm();
        setLoading(false);
        getInvites();
      } else {
        throw (new Error(confirmRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError();
    }
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row columns={1}>
        <Grid.Column>
          <Header as="h2" className="component-header">Analytics Invites</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row columns={1}>
        <Grid.Column>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/analytics">Analytics</Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Invites</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <Loader active={loading} inline="centered" />
              <p>Accepting an invite will add you to the course with the specified role.</p>
              {invites.length > 0 ? (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell width={6} scope="col">Course</Table.HeaderCell>
                      <Table.HeaderCell width={2} scope="col">Role</Table.HeaderCell>
                      <Table.HeaderCell width={2} scope="col">Sender</Table.HeaderCell>
                      <Table.HeaderCell width={4} scope="col">Expires</Table.HeaderCell>
                      <Table.HeaderCell width={2} scope="col">Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {invites.map((item) => {
                      const expiresDate = new Date(item.expiresAt);
                      const expiresTime = date.format(expiresDate, 'MM/DD/YY h:mm A') || 'Unknown';
                      return (
                        <Table.Row key={item.courseID}>
                          <Table.Cell>{item.course?.title}</Table.Cell>
                          <Table.Cell>{getAnalyticsMemberAccessText(item.newRole)}</Table.Cell>
                          <Table.Cell>{item.sender?.firstName} {item.sender?.lastName}</Table.Cell>
                          <Table.Cell>{expiresTime}</Table.Cell>
                          <Table.Cell>
                            <Button.Group fluid>
                              <Button
                                icon
                                color="red"
                                onClick={() => handleOpenConfirmInvite(item._id)}
                                title="Ignore"
                              >
                                <Icon name="remove circle" />
                              </Button>
                              <Button
                                icon
                                color="green"
                                onClick={() => handleOpenConfirmInvite(item._id, true)}
                                title="Accept"
                              >
                                <Icon name="check" />
                              </Button>
                            </Button.Group>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              ) : (
                <p className="muted-text text-center mt-2e mb-2e">No invites yet.</p>
              )}
            </Segment>
          </Segment.Group>
          {/* Confirm Invite Action */}
          <Modal open={showConfirm} onClose={handleCloseConfirm}>
            <Modal.Header>Confirm</Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to {acceptInvite ? 'accept' : 'ignore'} this invite to <strong>{confirmInvite.course?.title}</strong>?</p>
              {acceptInvite ? (
                <p>You'll be added to the course with the <em>{getAnalyticsMemberAccessText(confirmInvite.newRole)}</em> role.</p>
              ) : (
                <p>The course instructors will need to re-invite you if you wish to join in the future.</p>
              )}
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={handleCloseConfirm}>Cancel</Button>
              <Button onClick={handleConfirmInvite} color={acceptInvite ? 'green' : 'red'}>
                <Icon name={acceptInvite ? 'check' : 'remove circle'} />
                {acceptInvite ? 'Accept' : 'Ignore'}
              </Button>
            </Modal.Actions>
          </Modal>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AnalyticsInvites;
