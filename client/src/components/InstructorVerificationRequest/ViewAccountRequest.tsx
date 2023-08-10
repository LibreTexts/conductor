import { useState, FC } from "react";
import axios from "axios";
import {
  Button,
  Grid,
  Header,
  Icon,
  Image,
  Label,
  Modal,
  Popup,
} from "semantic-ui-react";
import { getPurposeText } from "../../utils/instructorVerificationRequestHelpers";
import { normalizeURL, truncateString } from "../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../util/LibraryOptions";
import useGlobalError from "../error/ErrorHooks";
import { AccountRequest } from "../../types";
import { checkIsUser } from "../util/TypeHelpers";
import AccountStatus from "../util/AccountStatus";

interface ViewAccountReqParams {
  show: boolean;
  request: AccountRequest;
  onClose: () => void;
  onDataChange: () => void;
}

/**
 * Modal tool to view and approve or deny an Instructor Account Request.
 */
const ViewAccountRequest: FC<ViewAccountReqParams> = ({
  show,
  request,
  onClose,
  onDataChange,
}) => {
  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [showConfirmComplete, setShowConfirmComplete] =
    useState<boolean>(false);

  /**
   * Submits a request to the server to mark the Request as completed,
   * then closes the tool on success.
   */
  async function submitComplete() {
    try {
      setLoading(true);
      const completeRes = await axios.put(`/accountrequest/${request._id}`);
      if (completeRes.data.err) {
        throw new Error(completeRes.data.errMsg);
      }
      setLoading(false);
      onDataChange();
      handleClose();
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
      if (deleteRes.data.err) {
        throw new Error(deleteRes.data.errMsg);
      }

      setLoading(false);
      onDataChange();
      handleClose();
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

  if (!request || !request.requester) {
    return (
      <Modal open={show} onClose={handleClose}>
        <Modal.Header as="h3">View Account Request</Modal.Header>
        <Modal.Content scrolling>
          <p>Oops, we had trouble loading this account request.</p>
        </Modal.Content>
      </Modal>
    );
  }

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header>
        <div className="flex-row-div">
          <div className="left-flex">
            <span>View Account Request</span>
          </div>
          <div className="right-flex">
            {request.status === "open" ? (
              <Label aria-label="Account request is pending" color="yellow">
                <span>Pending</span>
              </Label>
            ) : (
              <Label aria-label="Account request was completed" color="green">
                <span>Completed</span>
              </Label>
            )}
          </div>
        </div>
      </Modal.Header>
      <Modal.Content scrolling>
        <Grid divided>
          <Grid.Row columns={2}>
            <Grid.Column>
              <Header as="h4">Requester</Header>
              <p>
                <Header sub as="span">
                  Name:
                </Header>
                <span>
                  {" "}
                  {request.requester.firstName} {request.requester.lastName}
                </span>
              </p>
              <p>
                <Header sub as="span">
                  Email:
                </Header>
                <span> {request.requester.email}</span>
              </p>
              <p>
                <Header sub as="span">
                  Institution:
                </Header>
                <span> {request.requester.instructorProfile?.institution}</span>
              </p>
              <p>
                <Header sub as="span">
                  Verification URL:
                </Header>{" "}
                {request.requester.instructorProfile?.facultyURL && (
                  <a
                    href={normalizeURL(
                      request.requester.instructorProfile?.facultyURL
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="word-break-all"
                  >
                    {truncateString(
                      request.requester.instructorProfile?.facultyURL,
                      75
                    )}
                  </a>
                )}
              </p>
              <AccountStatus
                verifiedInstructor={request.requester.verifiedInstructor}
                thirdPerson
              />
            </Grid.Column>
            <Grid.Column>
              <Header as="h4">Request Information</Header>
              <p>
                <Header sub as="span">
                  Purpose:
                </Header>
                <span> {getPurposeText(request.purpose)}</span>
              </p>
              <p>
                <Header sub as="span">
                  Requests LibreNet Info:
                </Header>
                {request.moreInfo ? (
                  <span>
                    <strong> Yes</strong>
                  </span>
                ) : (
                  <span> No / Unspecified</span>
                )}
              </p>
              {request.purpose === "oer" && (
                <>
                  <Header sub>Libraries Requested</Header>
                  <ul>
                    {request.libraries &&
                      request.libraries.map((item) => (
                        <li key={item}>
                          <Image
                            src={getLibGlyphURL(item)}
                            className="library-glyph"
                          />
                          <span>{getLibraryName(item)}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex-row-div">
          {request.status === "open" && (
            <>
              <div className="ui left-flex">
                <Button
                  color="red"
                  loading={loading}
                  onClick={handleOpenConfirmDelete}
                >
                  <Icon name="trash" />
                  Delete
                </Button>
              </div>
              <div className="ui center-flex">
                <Button
                  color="green"
                  loading={loading}
                  onClick={handleOpenConfirmComplete}
                >
                  <Icon name="check" />
                  Mark Complete
                </Button>
              </div>
            </>
          )}
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
          <p>
            Are you sure you want to delete this request?{" "}
            <strong>This action cannot be undone.</strong>
          </p>
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
  );
};

export default ViewAccountRequest;
