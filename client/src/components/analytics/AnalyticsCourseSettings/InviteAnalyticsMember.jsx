import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Form, Icon, Modal } from 'semantic-ui-react';
import { analyticsCourseAccessOptions } from '../../../utils/analyticsHelpers';
import useGlobalError from '../../../components/error/ErrorHooks';

/**
 * A modal tool to invite a user to join an Analytics Course.
 */
const InviteAnalyticsMember = ({ show, onClose, onFinishedInvite, course }) => {

  const DEFAULT_ACCESS = 'viewer';

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [userErr, setUserErr] = useState(false);

  // Data
  const [users, setUsers] = useState([]);
  const [invitee, setInvitee] = useState('');
  const [newRole, setNewRole] = useState(DEFAULT_ACCESS);

  /**
   * Retrieves a list of all users from the server, filters current course members,
   * prepares entries for UI, then saves the list to state.
   */
  const getInviteableUsers = useCallback(async () => {
    setLoading(true);
    try {
      const usersRes = await axios.get('/users/basic');
      if (!usersRes.data.err) {
        if (Array.isArray(usersRes.data.users)) {
          const currentMembers = course.members.map((item) => item.uuid);
          const usersToSet = usersRes.data.users.map((item) => ({
            key: item.uuid,
            text: `${item.firstName} ${item.lastName}`,
            value: item.uuid,
            image: {
              avatar: true,
              src: item.avatar,
            },
          })).filter((item) => !currentMembers.includes(item.value));
          const collator = new Intl.Collator();
          usersToSet.sort((a, b) => collator.compare(a.text, b.text));
          setUsers(usersToSet);
        }
      } else {
        throw (new Error(usersRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [course.members, setLoading, setUsers, handleGlobalError]);

  /**
   * Retrieve inviteable users from the server when the tool is opened.
   */
  useEffect(() => {
    if (show) {
      getInviteableUsers();
    }
  }, [show, getInviteableUsers]);

  /**
   * Resets any error states in the form.
   */
  function resetFormErrors() {
    setUserErr(false);
  }

  /**
   * Validates all inputs in the form and sets error states if necessary.
   *
   * @returns {boolean} True if all valid, false otherwise.
   */
  function validateForm() {
    let valid = true;
    if (!invitee) {
      valid = false;
      setUserErr(true);
    }
    return valid;
  }

  /**
   * Submits the delete request to the server, then activates the provided callback on success.
   */
  async function submitInvite() {
    resetFormErrors();
    if (validateForm()) {
      setLoading(true);
      try {
        const inviteRes = await axios.post(`/analytics/courses/${course.courseID}/invites`, {
          invitee,
          newRole,
        });
        if (!inviteRes.data.err) {
          setLoading(false);
          onFinishedInvite();
        } else {
          throw (new Error(inviteRes.data.err));
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  /**
   * Resets state to its initial values, then closes the tool.
   */
  function handleClose() {
    setLoading(false);
    resetFormErrors();
    setUsers([]);
    setInvitee('');
    setNewRole(DEFAULT_ACCESS);
    onClose();
  }

  /**
   * Handles changes to the selected user to invite and updates state.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Event that triggered the handler.
   * @param {object} data - Data passed from UI component.
   * @param {string} data.value - UUID of new user selection.
   */
  function handleInviteeSelectionChange(_e, { value }) {
    setInvitee(value);
  }

  /**
   * Handles changes to the selected new role and updates state.
   *
   * @param {React.ChangeEvent<HTMLSelectElement>} e - Event that triggered the handler. 
   * @param {object} data - Data passed from UI component.
   * @param {string} data.value - New role selection identifier.
   */
  function handleRoleSelectionChange(_e, { value }) {
    setNewRole(value);
  }

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header>Invite Member</Modal.Header>
      <Modal.Content>
        <p><strong>Instructors</strong> have access to view and modify the course and its settings. <strong>Viewers</strong> can see all course data, but cannot modify settings.</p>
        <Form>
          <Form.Dropdown
            label="Select a user to invite"
            placeholder="Start typing to search"
            search
            fluid
            selection
            loading={loading}
            options={users}
            error={userErr}
            value={invitee}
            onChange={handleInviteeSelectionChange}
          />
          <Form.Dropdown
            label="Add with role:"
            selection
            fluid
            options={analyticsCourseAccessOptions}
            value={newRole}
            onChange={handleRoleSelectionChange}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={submitInvite} color="green" loading={loading}>
          <Icon name="user plus" />
          Send Invite
        </Button>
      </Modal.Actions>
    </Modal>
  )
};

InviteAnalyticsMember.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
  /**
   * Handler to activate when an invite has been sent.
   */
  onFinishedInvite: PropTypes.func,
  /**
   * The course to be shared.
   */
  course: PropTypes.shape({
    courseID: PropTypes.string,
    members: PropTypes.arrayOf(PropTypes.shape({
      uuid: PropTypes.string,
      firstName: PropTypes.string,
      lastName: PropTypes.string,
      role: PropTypes.string,
    })),
  }),
};

InviteAnalyticsMember.defaultProps = {
  onClose: () => { },
  onFinishedInvite: () => { },
  course: { },
};

export default InviteAnalyticsMember;
