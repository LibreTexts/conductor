import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Checkbox, Grid, Header, Icon, Label, Modal, Popup } from 'semantic-ui-react';
import TextArea from '../../components/TextArea';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to view and approve or deny an Analytics Access Request.
 */
const ViewAnalyticsRequest = ({ show, onClose, request, onDataChange }) => {

  const DENY_MSG_MAX_CHARS = 500;

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // Data
  const [deleteCourse, setDeleteCourse] = useState(false);
  const [completeMode, setCompleteMode] = useState('deny');
  const [denyMessage, setDenyMessage] = useState('');
  const [denyMsgCharsRemain, setDenyMsgCharsRemain] = useState(DENY_MSG_MAX_CHARS);

  // UI
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [denyMsgError, setDenyMsgError] = useState(false);
  const denyMsgTextArea = useRef(null);

  /**
   * Validates the Completion (Approval or Denial) form and sets error states if necessary.
   *
   * @returns {boolean} True if valid form, false otherwise.
   */
  function validateCompletion() {
    let valid = true;
    if (completeMode === 'approve') {
      return valid;
    }
    
    if (denyMessage.length > DENY_MSG_MAX_CHARS) {
      valid = false;
      setDenyMsgError(true);
    }
    return valid;
  }

  /**
   * Resets any error states in the completion form.
   */
  function resetCompletionErrors() {
    setDenyMsgError(false);
  }

  /**
   * Submits a request to the server to mark the Request as approved or denied,
   * then closes the tool on success.
   */
  async function submitComplete() {
    resetCompletionErrors();
    if (validateCompletion()) {
      try {
        setLoading(true);
        const completeData = {
          verb: completeMode,
          message: denyMessage.trim(),
        };
        const completeRes = await axios.put(`/analytics/accessrequest/${request._id}`, completeData);
        if (!completeRes.data.err) {
          setLoading(false);
          onDataChange();
          handleClose();
        } else {
          throw (new Error(completeRes.data.errMsg));
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  /**
   * Submits a DELETE request to the server for the current Request,
   * then closes the tool on success.
   */
  async function submitDelete() {
    try {
      setLoading(true);
      const deleteRes = await axios.delete(`/analytics/accessrequest/${request._id}`, {
        params: {
          deleteCourse,
        },
      });
      if (!deleteRes.data.err) {
        setLoading(false);
        onDataChange();
        handleClose();
      } else {
        throw (new Error(deleteRes.data.errMsg));
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  /**
   * Updates the number of characters remaining in the Reason for Denial field. Adds an error
   * state to the field if number of characters exceeds maximum.
   *
   * @param {string} newDenyMsg - The new value of the field.
   */
  function updateDenyMsgCharsRemain(newDenyMsg) {
    const charsRemain = DENY_MSG_MAX_CHARS - newDenyMsg.length;
    setDenyMsgCharsRemain(charsRemain);
    if (charsRemain > -1) {
      setDenyMsgError(false);
    } else {
      setDenyMsgError(true);
    }
  }

  /**
   * Resets the tool to its initial state, then activates the provided `onClose` handler.
   */
  function handleClose() {
    setLoading(false);
    setShowConfirmComplete(false);
    setShowConfirmDelete(false);
    setDeleteCourse(false);
    setDenyMsgError(false);
    setCompleteMode('deny');
    setDenyMessage('');
    setDenyMsgCharsRemain(DENY_MSG_MAX_CHARS);
    onClose();
  }

  /**
   * Opens the Confirm Completion modal in Approval mode.
   */
  function handleApprove() {
    setCompleteMode('approve');
    setShowConfirmComplete(true);
  }

  /**
   * Opens the Confirm Completion modal in Denial mode.
   */
  function handleDeny() {
    setCompleteMode('deny');
    setShowConfirmComplete(true);
  }

  /**
   * Closes the Confirm Complete modal.
   */
  function handleCloseConfirmComplete() {
    setShowConfirmComplete(false);
    setCompleteMode('deny');
    setDenyMessage('');
    setDenyMsgError(false);
    setDenyMsgCharsRemain(DENY_MSG_MAX_CHARS);
  }

  /**
   * Opens the Confirm Deletion modal.
   */
  function handleOpenConfirmDelete() {
    setShowConfirmDelete(true);
  }

  /**
   * Closes the Confirm Deletion modal.
   */
  function handleCloseConfirmDelete() {
    setDeleteCourse(false);
    setShowConfirmDelete(false);
  }

  /**
   * Handles updates to the Delete Analytics Course checkbox in the Confirm Deletion modal.
   *
   * @param {React.FormEvent<HTMLInputElement>} e - Event that activated the handler. 
   * @param {object} data 
   */
  function handleDeleteCourseCheckboxChange(e, data) {
    setDeleteCourse(data.checked);
  }

  /**
   * Handles updates to the (optional) request denial message.
   *
   * @param {string} value - New message value.
   */
  function handleDenyMessageChange(value) {
    setDenyMessage(value);
    updateDenyMsgCharsRemain(value);
  }

  /**
   * Renders a link to the requested textbook, if data is available.
   *
   * @returns {JSX.Element} The rendered link.
   */
  function TextbookLink() {
    if (request?.course?.pendingTextbookID) {
      return (
        <a
          href={`https://go.libretexts.org/${request.course.pendingTextbookID}`}
          target="_blank"
          rel="noreferrer"
        >
          <em>{request.course.pendingTextbookID}</em>
        </a>
      );
    }
    return <span><em>Unknown</em></span>;
  }

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header as="h3">View Analytics Request</Modal.Header>
      <Modal.Content scrolling>
        <Grid divided>
          <Grid.Row columns={2}>
            <Grid.Column>
              <Header as="h4">Requester</Header>
              <p>
                <Header sub as="span">Name:</Header>
                <span> {request?.requester?.firstName} {request?.requester?.lastName}</span>
              </p>
              <p>
                <Header sub as="span">Email:</Header>
                <span> {request?.requester?.email}</span>
              </p>
              <div>
                <Header sub as="span">Verified Instructor: </Header>
                {request?.requester?.verifiedInstructor ? (
                  <Label color="green" className="ml-05e">
                    <Icon name="check" />
                    Yes
                  </Label>
                ) : (
                  <Label color="yellow" className="ml-05e">
                    <Icon name="times circle outline" />
                    No
                  </Label>
                )}
                <Popup
                  trigger={(
                    <span className="ml-05e underline-hover small-text muted-text">
                      What's this?
                    </span>
                  )}
                  position="top center"
                  content={(
                    <p className="text-center">
                      {request?.requester?.verifiedInstructor
                        ? 'A member of the LibreTexts team has already verified this user as an instructor'
                        : 'This user has not yet been verified as an instructor by the LibreTexts team'
                      }
                    </p>
                  )}
                />
              </div>
            </Grid.Column>
            <Grid.Column>
              <Header as="h4">Request Information</Header>
              <p>
                <Header sub as="span">Analytics Course Name:</Header>
                <span> {request?.course?.title}</span>
              </p>
              <p>
                <Header sub as="span">Requested LibreText:</Header>
                {' '}
                <TextbookLink />
              </p>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex-row-div">
          <div className="ui left-flex">
            <Button color="red" loading={loading} onClick={handleOpenConfirmDelete}>
              <Icon name="trash" />
              Delete
            </Button>
          </div>
          <div className="ui center-flex">
            <Button.Group widths="two">
              <Button color="orange" loading={loading} onClick={handleDeny}>
                <Icon name="x" />
                Deny
              </Button>
              <Button color="green" loading={loading} onClick={handleApprove}>
                <Icon name="check" />
                Approve
              </Button>
            </Button.Group>
          </div>
          <div className="ui right-flex">
            <Button color="blue" loading={loading} onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal.Actions>
      {/* Confirm Completion (Approval or Denial) */}
      <Modal open={showConfirmComplete} onClose={handleCloseConfirmComplete}>
        <Modal.Header>Confirm</Modal.Header>
        <Modal.Content>
          <p>Are you sure you want to {completeMode} this request?</p>
          {completeMode === 'approve' && (
            <p>
              The course creators will have access to live and archived textbook analytics data for
              {' '}
              <TextbookLink />.
            </p>
          )}
          {completeMode === 'deny' && (
            <div>
              <label htmlFor={denyMsgTextArea?.id} className="form-field-label">
                Reason for denial <span className="muted-text">(optional)</span>
              </label>
              <TextArea
                placeholder="Reason for denial..."
                hideFormatMsg
                textValue={denyMessage}
                onTextChange={handleDenyMessageChange}
                error={denyMsgError}
              />
              <span className={`small-text ${denyMsgError ? 'color-semanticred' : 'muted-text'}`}>
                Characters remaining: {denyMsgCharsRemain}
              </span>
            </div>
          )}
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseConfirmComplete}>Cancel</Button>
          <Button
            color={completeMode === 'approve' ? 'green' : 'orange'}
            loading={loading}
            onClick={submitComplete}
          >
            <Icon name={completeMode === 'approve' ? 'check' : 'x'} />
            {completeMode === 'approve' ? 'Approve' : 'Deny'}
          </Button>
        </Modal.Actions>
      </Modal>
      {/* Confirm Deletion */}
      <Modal open={showConfirmDelete} onClose={handleCloseConfirmDelete}>
        <Modal.Header>Confirm</Modal.Header>
        <Modal.Content>
          <p>Are you sure you want to delete this request? <strong>This action cannot be undone.</strong></p>
          <Checkbox
            label="Also delete originating Analytics Course"
            checked={deleteCourse}
            onChange={handleDeleteCourseCheckboxChange}
          />
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseConfirmDelete}>Cancel</Button>
          <Button color="red" loading={loading} onClick={submitDelete}>
            <Icon name="trash" />
            Delete Request
          </Button>
        </Modal.Actions>
      </Modal>
    </Modal>
  )
};

ViewAnalyticsRequest.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Submitted Analytics Request data.
   */
  request: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    requester: PropTypes.shape({
      firstName: PropTypes.string,
      lastName: PropTypes.string,
      email: PropTypes.string,
      verifiedInstructor: PropTypes.bool,
    }),
    course: PropTypes.shape({
      title: PropTypes.string,
    }),
    pendingTextbookID: PropTypes.string,
  }),
  /**
   * Handler to activate when server data has changed and the parent component should refresh.
   */
  onDataChange: PropTypes.func,
};

ViewAnalyticsRequest.defaultProps = {
  onClose: () => { },
  onDataChange: () => { },
};

export default ViewAnalyticsRequest;
