import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Button, Grid, Header, Icon, Image, Label, Modal, Popup } from 'semantic-ui-react';
import { getPurposeText } from '../../utils/accountRequestHelpers';
import { normalizeURL, truncateString } from '../util/HelperFunctions';
import { getLibGlyphURL, getLibraryName } from '../util/LibraryOptions';
import useGlobalError from '../error/ErrorHooks';

/**
 * Modal tool to view and approve or deny an Instructor Account Request.
 */
const ViewAccountRequest = ({ show, onClose, request, onDataChange }) => {

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);

  /**
   * Submits a request to the server to mark the Request as completed,
   * then closes the tool on success.
   */
  async function submitComplete() {
    try {
      setLoading(true);
      const completeRes = await axios.put(`/accountrequest/${request._id}`);
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

  /**
   * Submits a DELETE request to the server for the current Request,
   * then closes the tool on success.
   */
  async function submitDelete() {
    try {
      setLoading(true);
      const deleteRes = await axios.delete(`/accountrequest/${request._id}`);
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
   * Resets the tool to its initial state, then activates the provided `onClose` handler.
   */
  function handleClose() {
    setLoading(false);
    setShowConfirmComplete(false);
    setShowConfirmDelete(false);
    onClose();
  }

  /**
   * Opens the Confirm Completion modal.
   */
  function handleOpenConfirmComplete() {
    setShowConfirmComplete(true);
  }

  /**
   * Closes the Confirm Complete modal.
   */
  function handleCloseConfirmComplete() {
    setShowConfirmComplete(false);
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
    setShowConfirmDelete(false);
  }

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header as="h3">View Account Request</Modal.Header>
      <Modal.Content scrolling>
        <Grid divided>
          <Grid.Row columns={2}>
            <Grid.Column>
              <Header as="h4">Requester</Header>
              <p>
                <Header sub as="span">Name:</Header>
                <span> {request?.name}</span>
              </p>
              <p>
                <Header sub as="span">Email:</Header>
                <span> {request?.email}</span>
              </p>
              <p>
                <Header sub as="span">Institution:</Header>
                <span> {request?.institution}</span>
              </p>
              <p>
                <Header sub as="span">Verification URL:</Header>
                {' '}
                <a
                  href={normalizeURL(request?.facultyURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="word-break-all"
                >
                  {truncateString(request?.facultyURL, 75)}
                </a>
              </p>
              <p>
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
              </p>
            </Grid.Column>
            <Grid.Column>
              <Header as="h4">Request Information</Header>
              <p>
                <Header sub as="span">Purpose:</Header>
                <span> {getPurposeText(request?.purpose)}</span>
              </p>
              <p>
                <Header sub as="span">Requests LibreNet Info:</Header>
                {request?.hasOwnProperty('moreInfo')
                  ? (request.moreInfo
                    ? <span><strong> Yes</strong></span>
                    : <span> No</span>
                  )
                  : <span> <em>Unspecified</em></span>
                }
              </p>
              {request?.purpose === 'oer' && (
                <>
                  <Header sub>Libraries Requested</Header>
                  <ul>
                    {Array.isArray(request?.libraries) && (
                      request.libraries.map((item) => (
                        <li key={item}>
                          <Image src={getLibGlyphURL(item)} className="library-glyph" />
                          <span>{getLibraryName(item)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
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
            <Button color="green" loading={loading} onClick={handleOpenConfirmComplete}>
              <Icon name="check" />
              Mark Complete
            </Button>
          </div>
          <div className="ui right-flex">
            <Button color="blue" loading={loading} onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal.Actions>
      {/* Confirm Completion */}
      <Modal open={showConfirmComplete} onClose={handleCloseConfirmComplete}>
        <Modal.Header>Confirm</Modal.Header>
        <Modal.Content>
          <p>
            Are you sure you want to mark this request as complete?
            <strong>
              {` Marking this request as complete will also mark the requester as a
               verified instructor, if not already verified.`}
            </strong>
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseConfirmComplete}>Cancel</Button>
          <Button color="green" loading={loading} onClick={submitComplete}>
            <Icon name="check" />
            Confirm
          </Button>
        </Modal.Actions>
      </Modal>
      {/* Confirm Deletion */}
      <Modal open={showConfirmDelete} onClose={handleCloseConfirmDelete}>
        <Modal.Header>Confirm</Modal.Header>
        <Modal.Content>
          <p>Are you sure you want to delete this request? <strong>This action cannot be undone.</strong></p>
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

ViewAccountRequest.propTypes = {
  /**
   * Sets the modal to open or closed.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when closed.
   */
  onClose: PropTypes.func,
  /**
   * Submitted Account Request data.
   */
  request: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    purpose: PropTypes.string.isRequired,
    institution: PropTypes.string.isRequired,
    facultyURL: PropTypes.string.isRequired,
    moreInfo: PropTypes.bool,
    libraries: PropTypes.arrayOf(PropTypes.string),
    requester: PropTypes.shape({
      verifiedInstructor: PropTypes.bool,
    }),
  }),
  /**
   * Handler to activate when server data has changed and the parent component should refresh.
   */
  onDataChange: PropTypes.func,
};

ViewAccountRequest.defaultProps = {
  onClose: () => { },
  onDataChange: () => { },
};

export default ViewAccountRequest;
