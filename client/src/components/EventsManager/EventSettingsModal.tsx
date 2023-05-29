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
import { getPurposeText } from "../../utils/accountRequestHelpers";
import { normalizeURL, truncateString } from "../util/HelperFunctions";
import { getLibGlyphURL, getLibraryName } from "../util/LibraryOptions";
import useGlobalError from "../error/ErrorHooks";
import { AccountRequest } from "../../types";
import { checkIsUser } from "../util/TypeHelpers";
import AccountStatus from "../util/AccountStatus";

interface EventSettingsModalParams {
  show: boolean;
  request: AccountRequest;
  onClose: () => void;
  onDataChange: () => void;
}

/**
 * Modal tool to view and approve or deny an Instructor Account Request.
 */
const EventSettingsModal: FC<EventSettingsModalParams> = ({
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

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header>
        <div className="flex-row-div">
          <div className="left-flex">
            <span>Edit Event Settings</span>
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
          <div className="ui right-flex">
            <Button color="blue" loading={loading} onClick={handleClose}>
              Cancel
            </Button>
            <Button color="blue" loading={loading} onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default EventSettingsModal;
