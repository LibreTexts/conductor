import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import {
  Button,
  Divider,
  Form,
  Icon,
  Loader,
  Segment,
  Table,
} from 'semantic-ui-react';
import InviteAnalyticsMember from './InviteAnalyticsMember';
import {
  analyticsCourseAccessOptions,
  getAnalyticsMemberAccessText,
} from '../../../utils/analyticsHelpers';
import useGlobalError from '../../error/ErrorHooks';

/**
 * An interface to manage access control for an Analytics Course.
 */
const AnalyticsCourseSharing = () => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const { courseID } = useParams();

  // Data
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [canEdit, setCanEdit] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  /**
   * Retrieves a list of course members from the server and saves it to state.
   */
  const getMembers = useCallback(async () => {
    setLoading(true);
    try {
      const membersRes = await axios.get(`/analytics/courses/${courseID}/members`);
      if (!membersRes.data.err) {
        if (Array.isArray(membersRes.data.members)) {
          setMembers(membersRes.data.members);
        }
        if (membersRes.data.canEdit) {
          setCanEdit(membersRes.data.canEdit);
        }
      } else {
        throw (new Error(membersRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [courseID, setMembers, setCanEdit, setLoading, handleGlobalError]);

  /**
   * Retrieves a list of course invites from the server and saves it to state.
   */
  const getInvites = useCallback(async () => {
    setLoading(true);
    try {
      const invitesRes = await axios.get(`/analytics/courses/${courseID}/invites`);
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
  }, [courseID, setInvites, setLoading, handleGlobalError]);

  /**
   * Retrieve the list of course members from the server on first load.
   */
  useEffect(() => {
    getMembers();
    getInvites();
  }, [getMembers, getInvites]);

  /**
   * Submits a request to the server to update a member's access setting, then refreshes the
   * list of members.
   *
   * @param {string} uuid - Identifier of the member to update.
   * @param {string} role - New member access setting selection.
   */
  async function handleMembersRowUpdate(uuid, role) {
    setLoading(true);
    try {
      const updateRes = await axios.put(`/analytics/courses/${courseID}/members/${uuid}`, {
        role,
      });
      if (!updateRes.data.err) {
        getMembers();
      } else {
        throw (new Error(updateRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }

  /**
   * Submits a request to the server to remove a member, then refreshes the list of members.
   *
   * @param {string} uuid - Identifier of the user to remove.
   */
  async function handleMembersRowDelete(uuid) {
    setLoading(true);
    try {
      const deleteRes = await axios.delete(`/analytics/courses/${courseID}/members/${uuid}`);
      if (!deleteRes.data.err) {
        getMembers();
      } else {
        throw (new Error(deleteRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }

  /**
   * Submits a request to delete the specified invite, then refreshes the list of invites.
   *
   * @param {string} id - Identifier of the invite to delete.
   */
  async function handleInviteRowDelete(id) {
    setLoading(true);
    try {
      const deleteRes = await axios.delete(`/analytics/invites/${id}`);
      if (!deleteRes.data.err) {
        getInvites();
      } else {
        throw (new Error(deleteRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }

  /**
   * Opens the Invite Analytics Member tool.
   */
  function handleOpenInvite() {
    setShowInvite(true);
  }

  /**
   * Closes the Invite Analytics Member tool.
   */
  function handleCloseInvite() {
    setShowInvite(false);
  }

  /**
   * Closes the Invite Analytics Member tool and refreshes the list of invites when
   * a new invite has been sent.
   */
  function handleInviteSent() {
    handleCloseInvite();
    getInvites();
  }

  /**
   * Renders a stylized invite status.
   *
   * @param {object} invite - Invite information.
   * @returns {JSX.Element} The stylized status.
   */
  function renderInviteStatus(invite) {
    if (invite.status === 'accepted') {
      const acceptedDate = new Date(invite.acceptedAt);
      const acceptTime = date.format(acceptedDate, 'MM/DD/YY h:mm A') || 'Unknown';
      return (
        <span>
          <span className="color-semanticgreen">Accepted</span>
          <span className="muted-text"> (at {acceptTime})</span>
        </span>
      );
    }
    if (invite.status === 'expired') {
      return (<span className="color-semanticred">Expired</span>)
    }
    const expireDate = new Date(invite.expiresAt);
    const expireTime = date.format(expireDate, 'MM/DD/YY h:mm A') || 'Unknown';
    return (
      <span>
        Pending{' '}
        <span className="muted-text">(expires at {expireTime})</span>
      </span>
    )
  }

  return (
    <Segment basic className="pane-segment">
      <h2>Sharing and Access Control</h2>
      <Divider />
      <h3>Course Members</h3>
      <p><strong>Instructors</strong> have access to view and modify the course and its settings. <strong>Viewers</strong> can see all course data, but cannot modify settings.</p>
      <Loader active={loading} inline="centered" />
      <Form className="mt-1e">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={7} scope="col">Name</Table.HeaderCell>
              <Table.HeaderCell width={7} scope="col">Access</Table.HeaderCell>
              <Table.HeaderCell width={2} scope="col">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {members.map((item) => {
              return (
                <Table.Row key={item.uuid}>
                  <Table.Cell>{item.firstName} {item.lastName}</Table.Cell>
                  <Table.Cell>
                    <Form.Select
                      fluid
                      label={(
                        <label className="sr-only">Access Level</label>
                      )}
                      placeholder="Access Level"
                      id={`role.${item.uuid}`}
                      name="role"
                      options={analyticsCourseAccessOptions}
                      value={item.role}
                      onChange={(_e, { value }) => handleMembersRowUpdate(item.uuid, value)}
                      disabled={item.creator || !canEdit}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      icon
                      color="red"
                      onClick={() => handleMembersRowDelete(item.uuid)}
                      fluid
                      disabled={item.creator || !canEdit}
                    >
                      <Icon name="remove circle" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )
            })}
            {members.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  <p className="muted-text text-center"><em>No members yet.</em></p>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </Form>
      <div className="flex-row-div mt-3e">
        <div className="left-flex">
          <h3>Invites</h3>
        </div>
        <div className="right-flex">
          <Button
            color="green"
            icon
            labelPosition="left"
            onClick={handleOpenInvite}
            disabled={!canEdit}
          >
            <Icon name="user plus" />
            Invite User
          </Button>
        </div>
      </div>
      <Table className="mb-1e">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={4} scope="col">Invitee</Table.HeaderCell>
            <Table.HeaderCell width={2} scope="col">Role</Table.HeaderCell>
            <Table.HeaderCell width={5} scope="col">Sent</Table.HeaderCell>
            <Table.HeaderCell width={4} scope="col">Status</Table.HeaderCell>
            <Table.HeaderCell width={1} scope="col">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {invites.map((item) => {
            const dateInstance = new Date(item.createdAt);
            const sentTime = date.format(dateInstance, 'MM/DD/YY h:mm A') || 'Unknown';
            return (
              <Table.Row key={item._id}>
                <Table.Cell>{item.invitee?.firstName} {item.invitee?.lastName}</Table.Cell>
                <Table.Cell>{getAnalyticsMemberAccessText(item.newRole)}</Table.Cell>
                <Table.Cell>{sentTime} by {item.sender?.firstName} {item.sender?.lastName}</Table.Cell>
                <Table.Cell>{renderInviteStatus(item)}</Table.Cell>
                <Table.Cell>
                  {item.status !== 'accepted' && (
                    <Button
                      icon
                      color="red"
                      onClick={() => handleInviteRowDelete(item._id)}
                      fluid
                      disabled={!canEdit}
                    >
                      <Icon name="remove circle" />
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })}
          {invites.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <p className="muted-text text-center"><em>No invites sent yet.</em></p>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      <InviteAnalyticsMember
        show={showInvite}
        onClose={handleCloseInvite}
        onFinishedInvite={handleInviteSent}
        course={{ courseID, members }}
      />
    </Segment>
  );
};

export default AnalyticsCourseSharing;
