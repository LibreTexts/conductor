import { useState, useEffect } from "react";
import { Button, Form, Input, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface DenyVerificationRequestModalProps extends ModalProps {
  show: boolean;
  action: "denied" | "needs_change";
  requestId: string;
  onSave: () => void;
  onCancel: () => void;
}

const DenyVerificationRequestModal: React.FC<
  DenyVerificationRequestModalProps
> = ({ show, action, requestId, onSave, onCancel, ...rest }) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [decisionReason, setDecisionReason] = useState<string>("");

  // Methods
  async function submitUpdateRequest() {
    try {
      if (!requestId) return;

      setLoading(true);

      const res = await axios.patch(
        `/central-identity/verification-requests/${requestId}`,
        {
          action,
          decisionReason,
        }
      );

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onCancel} {...rest}>
      <Modal.Header>
        {action === "denied" ? "Deny Verification Request" : "Request Changes"}
      </Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="pa-2r">
            <p>
              {action === "denied"
                ? "Deny request with reason:"
                : "Request changes to this request"}
            </p>
            <Form>
              <Input
                fluid
                placeholder="Reason for decision..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
            </Form>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          color={action === "denied" ? "red" : "yellow"}
          onClick={submitUpdateRequest}
        >
          {action === "denied"
            ? "Confirm Deny Request"
            : "Confirm Request Changes"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DenyVerificationRequestModal;
