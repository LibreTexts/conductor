import React, { useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import {
  Badge,
  Button,
  Checkbox,
  Heading,
  Modal,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@libretexts/davis-react";
import {
  IconCheck,
  IconInfoCircle,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks";

const InfoField = ({ label, children }) => (
  <div>
    <Heading level={4} className="!mb-2 text-sm font-semibold text-gray-700">
      {label}
    </Heading>
    <div>{children}</div>
  </div>
);

InfoField.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

/**
 * Modal tool to view and approve or deny an Analytics Access Request.
 */
const ViewAnalyticsRequest = ({ show, onClose, request, onDataChange }) => {
  const DENY_MSG_MAX_CHARS = 500;

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // Data
  const [deleteCourse, setDeleteCourse] = useState(false);
  const [completeMode, setCompleteMode] = useState("deny");
  const [denyMessage, setDenyMessage] = useState("");
  const [denyMsgCharsRemain, setDenyMsgCharsRemain] = useState(DENY_MSG_MAX_CHARS);

  // UI
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [denyMsgError, setDenyMsgError] = useState(false);

  /**
   * Validates the Completion (Approval or Denial) form and sets error states if necessary.
   *
   * @returns {boolean} True if valid form, false otherwise.
   */
  function validateCompletion() {
    if (completeMode === "approve") {
      return true;
    }

    if (denyMessage.length > DENY_MSG_MAX_CHARS) {
      setDenyMsgError(true);
      return false;
    }

    return true;
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
    if (!validateCompletion()) {
      return;
    }

    try {
      setLoading(true);
      const completeData = {
        verb: completeMode,
        message: denyMessage.trim(),
      };
      const completeRes = await axios.put(
        `/analytics/accessrequest/${request._id}`,
        completeData
      );
      if (!completeRes.data.err) {
        onDataChange();
        handleClose();
      } else {
        throw new Error(completeRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submits a DELETE request to the server for the current Request,
   * then closes the tool on success.
   */
  async function submitDelete() {
    try {
      setLoading(true);
      const deleteRes = await axios.delete(
        `/analytics/accessrequest/${request._id}`,
        {
          params: {
            deleteCourse,
          },
        }
      );
      if (!deleteRes.data.err) {
        onDataChange();
        handleClose();
      } else {
        throw new Error(deleteRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Updates the number of characters remaining in the Reason for Denial field.
   *
   * @param {string} newDenyMsg - The new value of the field.
   */
  function updateDenyMsgCharsRemain(newDenyMsg) {
    const charsRemain = DENY_MSG_MAX_CHARS - newDenyMsg.length;
    setDenyMsgCharsRemain(charsRemain);
    setDenyMsgError(charsRemain < 0);
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
    setCompleteMode("deny");
    setDenyMessage("");
    setDenyMsgCharsRemain(DENY_MSG_MAX_CHARS);
    onClose();
  }

  function handleApprove() {
    setCompleteMode("approve");
    setShowConfirmComplete(true);
  }

  function handleDeny() {
    setCompleteMode("deny");
    setShowConfirmComplete(true);
  }

  function handleCloseConfirmComplete() {
    setShowConfirmComplete(false);
    setCompleteMode("deny");
    setDenyMessage("");
    setDenyMsgError(false);
    setDenyMsgCharsRemain(DENY_MSG_MAX_CHARS);
  }

  function handleOpenConfirmDelete() {
    setShowConfirmDelete(true);
  }

  function handleCloseConfirmDelete() {
    setDeleteCourse(false);
    setShowConfirmDelete(false);
  }

  function handleDenyMessageChange(value) {
    setDenyMessage(value);
    updateDenyMsgCharsRemain(value);
  }

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
    return (
      <span>
        <em>Unknown</em>
      </span>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <>
      <Modal open={show} onClose={() => handleClose()} size="xl">
        <Modal.Header>
          <Modal.Title>View Analytics Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="border-b border-neutral-200 pb-6 md:border-b-0 md:border-r md:pr-8 md:pb-0">
              <Heading level={3} className="!mb-6">
                Requester
              </Heading>
              <Stack direction="vertical" gap="lg">
                <InfoField label="Name">
                  <Text>
                    {request?.requester?.firstName} {request?.requester?.lastName}
                  </Text>
                </InfoField>
                <InfoField label="Email">
                  <Text>{request?.requester?.email}</Text>
                </InfoField>
                <InfoField label="Verified Instructor">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex"
                    >
                      <Badge
                        variant={request?.requester?.verifiedInstructor ? "success" : "warning"}
                      >
                      {request?.requester?.verifiedInstructor ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconX size={18} />
                      )}
                      {request?.requester?.verifiedInstructor ? "Yes" : "No"}
                      </Badge>
                    </span>
                    <Tooltip
                      placement="top"
                      content={
                        <p className="text-center max-w-xs">
                          {request?.requester?.verifiedInstructor
                            ? "A member of the LibreTexts team has already verified this user as an instructor"
                            : "This user has not yet been verified as an instructor by the LibreTexts team"}
                        </p>
                      }
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm text-neutral-500 underline decoration-dashed underline-offset-4"
                      >
                        <IconInfoCircle size={16} />
                        What&apos;s this?
                      </button>
                    </Tooltip>
                  </div>
                </InfoField>
              </Stack>
            </div>

            <div>
              <Heading level={3} className="!mb-6">
                Request Information
              </Heading>
              <Stack direction="vertical" gap="lg">
                <InfoField label="Analytics Course Name">
                  <Text>{request?.course?.title}</Text>
                </InfoField>
                <InfoField label="Requested LibreText">
                  <TextbookLink />
                </InfoField>
              </Stack>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="destructive"
              loading={loading}
              onClick={handleOpenConfirmDelete}
              icon={<IconTrash size={18} />}
            >
              Delete
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              loading={loading}
              onClick={handleDeny}
              icon={<IconX size={18} />}
            >
              Deny
            </Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={handleApprove}
              icon={<IconCheck size={18} />}
            >
              Approve
            </Button>
          </div>
          <div>
            <Button variant="secondary" loading={loading} onClick={handleClose}>
              Done
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal open={showConfirmComplete} onClose={() => handleCloseConfirmComplete()} size="md">
        <Modal.Header>
          <Modal.Title>Confirm</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Stack direction="vertical" gap="md">
            <Text>Are you sure you want to {completeMode} this request?</Text>
            {completeMode === "approve" && (
              <Text>
                The course creators will have access to live and archived textbook analytics data for{" "}
                <TextbookLink />.
              </Text>
            )}
            {completeMode === "deny" && (
              <div>
                <Textarea
                  name="analytics-request-deny-message"
                  label="Reason for denial"
                  placeholder="Reason for denial..."
                  value={denyMessage}
                  onChange={(e) => handleDenyMessageChange(e.target.value)}
                  error={denyMsgError}
                  errorMessage={denyMsgError ? "Message exceeds maximum length." : undefined}
                  helperText={`Characters remaining: ${denyMsgCharsRemain}`}
                  rows={5}
                />
              </div>
            )}
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseConfirmComplete}>
            Cancel
          </Button>
          <Button
            variant={completeMode === "approve" ? "primary" : "secondary"}
            loading={loading}
            onClick={submitComplete}
            icon={completeMode === "approve" ? <IconCheck size={18} /> : <IconX size={18} />}
          >
            {completeMode === "approve" ? "Approve" : "Deny"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal open={showConfirmDelete} onClose={() => handleCloseConfirmDelete()} size="md">
        <Modal.Header>
          <Modal.Title>Confirm</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Stack direction="vertical" gap="md">
            <Text>
              Are you sure you want to delete this request? <strong>This action cannot be undone.</strong>
            </Text>
            <Checkbox
              name="delete-originating-analytics-course"
              label="Also delete originating Analytics Course"
              checked={deleteCourse}
              onChange={setDeleteCourse}
            />
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseConfirmDelete}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={loading}
            onClick={submitDelete}
            icon={<IconTrash size={18} />}
          >
            Delete Request
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

ViewAnalyticsRequest.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
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
      pendingTextbookID: PropTypes.string,
    }),
    pendingTextbookID: PropTypes.string,
  }),
  onDataChange: PropTypes.func,
};

ViewAnalyticsRequest.defaultProps = {
  onClose: () => {},
  onDataChange: () => {},
  request: null,
};

export default ViewAnalyticsRequest;
