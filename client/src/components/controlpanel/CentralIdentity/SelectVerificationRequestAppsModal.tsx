import { useState, useEffect } from "react";
import { Button, Form, Input, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface SelectVerificationRequestAppsModalProps extends ModalProps {
  show: boolean;
  requestId: string;
  onSave: () => void;
  onCancel: () => void;
}

const SelectVerificationRequestAppsModal: React.FC<
  SelectVerificationRequestAppsModalProps
> = ({ show, requestId, onSave, onCancel, ...rest }) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [decisionReason, setDecisionReason] = useState<string>("");

  // Methods

  return (
    <Modal open={show} onClose={onCancel} {...rest}>
      <Modal.Header>
        Select Apps To Approve for Verification Request
      </Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="pa-2r">
            <p></p>
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
        <Button>"Confirm Request Changes"</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default SelectVerificationRequestAppsModal;
